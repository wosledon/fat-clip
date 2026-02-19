use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentType {
    Plain,
    Rich,
    Image,
    File,
}

impl ContentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ContentType::Plain => "plain",
            ContentType::Rich => "rich",
            ContentType::Image => "image",
            ContentType::File => "file",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "plain" => Some(ContentType::Plain),
            "rich" => Some(ContentType::Rich),
            "image" => Some(ContentType::Image),
            "file" => Some(ContentType::File),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipItem {
    pub id: String,
    pub content_type: ContentType,
    pub content: String,
    pub preview_text: String,
    pub tags: Vec<String>,
    pub source_app: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
    pub pinned: bool,
    pub metadata: Option<serde_json::Value>,
}

/// Metadata for image content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String, // "png", "jpeg", etc.
    pub size_bytes: u64,
    pub thumbnail_path: Option<String>,
}

/// Metadata for file content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_paths: Vec<String>,
    pub total_size_bytes: u64,
}

/// Metadata for rich text content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RichTextMetadata {
    pub has_html: bool,
    pub has_rtf: bool,
    pub html_preview: Option<String>,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> SqliteResult<Self> {
        let db_path = app_dir.join("fat_clip.db");
        let conn = Connection::open(db_path)?;

        let db = Database { conn };
        db.init_tables()?;

        Ok(db)
    }

    fn init_tables(&self) -> SqliteResult<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS clip_items (
                id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                content TEXT NOT NULL,
                preview_text TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                source_app TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_used_at TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                metadata TEXT
            )",
            [],
        )?;

        // Create index for faster queries
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_created_at ON clip_items(created_at DESC)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pinned ON clip_items(pinned DESC)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_content_type ON clip_items(content_type)",
            [],
        )?;

        Ok(())
    }

    pub fn insert_clip(&self, item: &ClipItem) -> SqliteResult<()> {
        let tags_json = serde_json::to_string(&item.tags).unwrap_or_default();
        let metadata_json = item.metadata.as_ref().map(|m| m.to_string());

        self.conn.execute(
            "INSERT INTO clip_items (id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
             last_used_at = excluded.last_used_at,
             content = excluded.content",
            params![
                item.id,
                item.content_type.as_str(),
                item.content,
                item.preview_text,
                tags_json,
                item.source_app,
                item.created_at.to_rfc3339(),
                item.last_used_at.to_rfc3339(),
                item.pinned as i32,
                metadata_json,
            ],
        )?;

        Ok(())
    }

    pub fn get_clips(&self, limit: i64, offset: i64) -> SqliteResult<Vec<ClipItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata
             FROM clip_items
             ORDER BY pinned DESC, created_at DESC
             LIMIT ?1 OFFSET ?2"
        )?;

        let clips = stmt
            .query_map(params![limit, offset], |row| {
                let content_type_str: String = row.get(1)?;
                let tags_json: String = row.get(4)?;
                let metadata_str: Option<String> = row.get(9)?;

                Ok(ClipItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&content_type_str)
                        .unwrap_or(ContentType::Plain),
                    content: row.get(2)?,
                    preview_text: row.get(3)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    source_app: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    pinned: row.get::<_, i32>(8)? != 0,
                    metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(clips)
    }

    pub fn search_clips(&self, query: &str, limit: i64) -> SqliteResult<Vec<ClipItem>> {
        let query_lower = query.to_lowercase();

        // Check if it's a tag search
        if query_lower.starts_with("tag:") || query_lower.starts_with("#") {
            let tag = if query_lower.starts_with("tag:") {
                query[4..].trim()
            } else {
                query[1..].trim()
            };
            return self.search_by_tag(tag, limit);
        }

        // Check if it's a content type filter
        if let Some(content_type) = query_lower.strip_prefix("type:") {
            let content_type = content_type.trim();
            return self.search_by_content_type(content_type, limit);
        }

        // Simple LIKE search on preview_text and content
        let search_pattern = format!("%{}%", query_lower);

        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata
             FROM clip_items
             WHERE LOWER(preview_text) LIKE ?1 OR LOWER(content) LIKE ?1
             ORDER BY pinned DESC, created_at DESC
             LIMIT ?2"
        )?;

        let clips = stmt
            .query_map(params![search_pattern, limit], |row| {
                let content_type_str: String = row.get(1)?;
                let tags_json: String = row.get(4)?;
                let metadata_str: Option<String> = row.get(9)?;

                Ok(ClipItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&content_type_str)
                        .unwrap_or(ContentType::Plain),
                    content: row.get(2)?,
                    preview_text: row.get(3)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    source_app: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    pinned: row.get::<_, i32>(8)? != 0,
                    metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(clips)
    }

    pub fn search_by_tag(&self, tag: &str, limit: i64) -> SqliteResult<Vec<ClipItem>> {
        let tag_lower = tag.to_lowercase();
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata
             FROM clip_items
             WHERE LOWER(tags) LIKE ?1
             ORDER BY pinned DESC, created_at DESC
             LIMIT ?2"
        )?;

        let tag_pattern = format!("%\"{}\"%", tag_lower);
        let clips = stmt
            .query_map(params![tag_pattern, limit], |row| {
                let content_type_str: String = row.get(1)?;
                let tags_json: String = row.get(4)?;
                let metadata_str: Option<String> = row.get(9)?;

                Ok(ClipItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&content_type_str)
                        .unwrap_or(ContentType::Plain),
                    content: row.get(2)?,
                    preview_text: row.get(3)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    source_app: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    pinned: row.get::<_, i32>(8)? != 0,
                    metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(clips)
    }

    pub fn search_by_content_type(
        &self,
        content_type: &str,
        limit: i64,
    ) -> SqliteResult<Vec<ClipItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata
             FROM clip_items
             WHERE LOWER(content_type) = ?1
             ORDER BY pinned DESC, created_at DESC
             LIMIT ?2"
        )?;

        let clips = stmt
            .query_map(params![content_type.to_lowercase(), limit], |row| {
                let content_type_str: String = row.get(1)?;
                let tags_json: String = row.get(4)?;
                let metadata_str: Option<String> = row.get(9)?;

                Ok(ClipItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&content_type_str)
                        .unwrap_or(ContentType::Plain),
                    content: row.get(2)?,
                    preview_text: row.get(3)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    source_app: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    pinned: row.get::<_, i32>(8)? != 0,
                    metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(clips)
    }

    pub fn update_clip_tags(&self, id: &str, tags: Vec<String>) -> SqliteResult<()> {
        let tags_json = serde_json::to_string(&tags).unwrap_or_default();
        self.conn.execute(
            "UPDATE clip_items SET tags = ?1 WHERE id = ?2",
            params![tags_json, id],
        )?;
        Ok(())
    }

    pub fn toggle_pin(&self, id: &str, pinned: bool) -> SqliteResult<()> {
        self.conn.execute(
            "UPDATE clip_items SET pinned = ?1 WHERE id = ?2",
            params![pinned as i32, id],
        )?;
        Ok(())
    }

    pub fn delete_clip(&self, id: &str) -> SqliteResult<()> {
        self.conn
            .execute("DELETE FROM clip_items WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_clip_by_content_hash(&self, hash: &str) -> SqliteResult<Option<ClipItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata
             FROM clip_items
             WHERE id = ?1"
        )?;

        let result = stmt.query_row(params![hash], |row| {
            let content_type_str: String = row.get(1)?;
            let tags_json: String = row.get(4)?;
            let metadata_str: Option<String> = row.get(9)?;

            Ok(ClipItem {
                id: row.get(0)?,
                content_type: ContentType::from_str(&content_type_str)
                    .unwrap_or(ContentType::Plain),
                content: row.get(2)?,
                preview_text: row.get(3)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                source_app: row.get(5)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                last_used_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                pinned: row.get::<_, i32>(8)? != 0,
                metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
            })
        });

        match result {
            Ok(item) => Ok(Some(item)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn cleanup_old_clips(&self, days: i64) -> SqliteResult<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(days);
        let result = self.conn.execute(
            "DELETE FROM clip_items WHERE pinned = 0 AND created_at < ?1",
            params![cutoff.to_rfc3339()],
        )?;
        Ok(result)
    }

    pub fn cleanup_before(&self, before: DateTime<Utc>) -> SqliteResult<usize> {
        let result = self.conn.execute(
            "DELETE FROM clip_items WHERE pinned = 0 AND created_at < ?1",
            params![before.to_rfc3339()],
        )?;
        Ok(result)
    }

    pub fn cleanup_between(
        &self,
        start: DateTime<Utc>,
        end_exclusive: DateTime<Utc>,
    ) -> SqliteResult<usize> {
        let result = self.conn.execute(
            "DELETE FROM clip_items WHERE pinned = 0 AND created_at >= ?1 AND created_at < ?2",
            params![start.to_rfc3339(), end_exclusive.to_rfc3339()],
        )?;
        Ok(result)
    }

    pub fn get_all_tags(&self) -> SqliteResult<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT tags FROM clip_items")?;
        let rows = stmt.query_map([], |row| {
            let tags_json: String = row.get(0)?;
            Ok(tags_json)
        })?;

        let mut all_tags = std::collections::HashSet::new();
        for tags_json in rows {
            if let Ok(tags) = serde_json::from_str::<Vec<String>>(&tags_json?) {
                for tag in tags {
                    // Keep original case for display
                    all_tags.insert(tag);
                }
            }
        }

        let mut tags: Vec<String> = all_tags.into_iter().collect();
        tags.sort_by_key(|a| a.to_lowercase());
        Ok(tags)
    }

    pub fn search_tags(&self, query: &str) -> SqliteResult<Vec<String>> {
        let all_tags = self.get_all_tags()?;
        let query_lower = query.to_lowercase();

        let filtered: Vec<String> = all_tags
            .into_iter()
            .filter(|tag| tag.to_lowercase().contains(&query_lower))
            .take(10)
            .collect();

        Ok(filtered)
    }

    #[allow(dead_code)]
    /// Get clips by content type
    pub fn get_clips_by_type(
        &self,
        content_type: ContentType,
        limit: i64,
    ) -> SqliteResult<Vec<ClipItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, content, preview_text, tags, source_app, created_at, last_used_at, pinned, metadata
             FROM clip_items
             WHERE content_type = ?1
             ORDER BY pinned DESC, created_at DESC
             LIMIT ?2"
        )?;

        let clips = stmt
            .query_map(params![content_type.as_str(), limit], |row| {
                let content_type_str: String = row.get(1)?;
                let tags_json: String = row.get(4)?;
                let metadata_str: Option<String> = row.get(9)?;

                Ok(ClipItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&content_type_str)
                        .unwrap_or(ContentType::Plain),
                    content: row.get(2)?,
                    preview_text: row.get(3)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    source_app: row.get(5)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    pinned: row.get::<_, i32>(8)? != 0,
                    metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(clips)
    }
}

pub fn get_app_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("fat-clip")
}

pub fn get_images_dir() -> PathBuf {
    get_app_dir().join("images")
}

pub fn get_thumbnails_dir() -> PathBuf {
    get_app_dir().join("thumbnails")
}

pub fn ensure_app_dir() -> std::io::Result<PathBuf> {
    let app_dir = get_app_dir();
    std::fs::create_dir_all(&app_dir)?;
    std::fs::create_dir_all(get_images_dir())?;
    std::fs::create_dir_all(get_thumbnails_dir())?;
    Ok(app_dir)
}

pub fn generate_content_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub fn generate_image_hash(image_data: &[u8]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    image_data.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
