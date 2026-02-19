use crate::db::{
    generate_content_hash, generate_image_hash, get_images_dir, get_thumbnails_dir, ClipItem,
    ContentType, Database, FileMetadata, ImageMetadata, RichTextMetadata,
};
use chrono::Utc;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct ClipboardManager {
    pub db: Arc<Mutex<Database>>,
}

impl ClipboardManager {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        ClipboardManager { db }
    }

    /// Save plain text clip
    pub fn save_text_clip(&self, text: String, source_app: String) -> Result<ClipItem, String> {
        // Check for duplicates
        let content_hash = generate_content_hash(&text);

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = db
                .get_clip_by_content_hash(&content_hash)
                .map_err(|e| e.to_string())?
            {
                // Update last_used_at for existing item
                let mut updated = existing.clone();
                updated.last_used_at = Utc::now();
                db.insert_clip(&updated).map_err(|e| e.to_string())?;
                return Ok(updated);
            }
        }

        // Create preview text (first 200 chars)
        let preview_text = if text.len() > 200 {
            format!("{}...", &text[..200])
        } else {
            text.clone()
        };

        let item = ClipItem {
            id: content_hash,
            content_type: ContentType::Plain,
            content: text,
            preview_text,
            tags: vec![],
            source_app,
            created_at: Utc::now(),
            last_used_at: Utc::now(),
            pinned: false,
            metadata: None,
        };

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            db.insert_clip(&item).map_err(|e| e.to_string())?;
        }

        Ok(item)
    }

    /// Save image clip from clipboard
    pub fn save_image_clip(
        &self,
        image_data: Vec<u8>,
        width: u32,
        height: u32,
        format: &str,
        source_app: String,
    ) -> Result<ClipItem, String> {
        // Generate hash from image data
        let content_hash = generate_image_hash(&image_data);

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = db
                .get_clip_by_content_hash(&content_hash)
                .map_err(|e| e.to_string())?
            {
                // Update last_used_at for existing item
                let mut updated = existing.clone();
                updated.last_used_at = Utc::now();
                db.insert_clip(&updated).map_err(|e| e.to_string())?;
                return Ok(updated);
            }
        }

        // Save image to file system
        let images_dir = get_images_dir();
        let image_filename = format!("{}.png", content_hash);
        let image_path = images_dir.join(&image_filename);

        // Convert and save as PNG for consistency
        let png_data = self.convert_to_png(&image_data, width, height, format)?;
        std::fs::write(&image_path, &png_data)
            .map_err(|e| format!("Failed to save image: {}", e))?;

        // Generate thumbnail
        let thumbnail_path = self.generate_thumbnail(&png_data, &content_hash, width, height)?;

        let size_bytes = png_data.len() as u64;

        // Create metadata
        let metadata = ImageMetadata {
            width,
            height,
            format: "png".to_string(),
            size_bytes,
            thumbnail_path: thumbnail_path.to_str().map(|s| s.to_string()),
        };

        // Preview text for image
        let preview_text = format!(
            "[Image] {}x{}px ({:.1} KB)",
            width,
            height,
            size_bytes as f64 / 1024.0
        );

        let item = ClipItem {
            id: content_hash.clone(),
            content_type: ContentType::Image,
            content: image_path.to_string_lossy().to_string(),
            preview_text,
            tags: vec![],
            source_app,
            created_at: Utc::now(),
            last_used_at: Utc::now(),
            pinned: false,
            metadata: Some(serde_json::to_value(metadata).unwrap_or_default()),
        };

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            db.insert_clip(&item).map_err(|e| e.to_string())?;
        }

        Ok(item)
    }

    /// Save rich text (HTML/RTF) clip
    pub fn save_rich_text_clip(
        &self,
        html_content: Option<String>,
        rtf_content: Option<String>,
        plain_text: String,
        source_app: String,
    ) -> Result<ClipItem, String> {
        // Create a combined content hash
        let content_to_hash = format!(
            "{}{}{}",
            html_content.as_ref().unwrap_or(&String::new()),
            rtf_content.as_ref().unwrap_or(&String::new()),
            plain_text
        );
        let content_hash = generate_content_hash(&content_to_hash);

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = db
                .get_clip_by_content_hash(&content_hash)
                .map_err(|e| e.to_string())?
            {
                // Update last_used_at for existing item
                let mut updated = existing.clone();
                updated.last_used_at = Utc::now();
                db.insert_clip(&updated).map_err(|e| e.to_string())?;
                return Ok(updated);
            }
        }

        // Store as JSON containing all formats
        let content = serde_json::json!({
            "html": html_content,
            "rtf": rtf_content,
            "plain": plain_text.clone(),
        })
        .to_string();

        // Create preview text from plain text
        let preview_text = if plain_text.len() > 200 {
            format!("{}...", &plain_text[..200])
        } else {
            plain_text.clone()
        };

        // Create metadata
        let metadata = RichTextMetadata {
            has_html: html_content.is_some(),
            has_rtf: rtf_content.is_some(),
            html_preview: html_content.map(|h| {
                if h.len() > 100 {
                    format!("{}...", &h[..100])
                } else {
                    h
                }
            }),
        };

        let item = ClipItem {
            id: content_hash,
            content_type: ContentType::Rich,
            content,
            preview_text: format!("[Rich Text] {}", preview_text),
            tags: vec![],
            source_app,
            created_at: Utc::now(),
            last_used_at: Utc::now(),
            pinned: false,
            metadata: Some(serde_json::to_value(metadata).unwrap_or_default()),
        };

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            db.insert_clip(&item).map_err(|e| e.to_string())?;
        }

        Ok(item)
    }

    /// Save file paths clip
    pub fn save_file_clip(
        &self,
        file_paths: Vec<String>,
        source_app: String,
    ) -> Result<ClipItem, String> {
        // Create content hash from file paths
        let content = file_paths.join("\n");
        let content_hash = generate_content_hash(&content);

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            if let Some(existing) = db
                .get_clip_by_content_hash(&content_hash)
                .map_err(|e| e.to_string())?
            {
                // Update last_used_at for existing item
                let mut updated = existing.clone();
                updated.last_used_at = Utc::now();
                db.insert_clip(&updated).map_err(|e| e.to_string())?;
                return Ok(updated);
            }
        }

        // Calculate total size
        let mut total_size: u64 = 0;
        let mut valid_paths = Vec::new();

        for path_str in &file_paths {
            if let Ok(metadata) = std::fs::metadata(path_str) {
                total_size += metadata.len();
                valid_paths.push(path_str.clone());
            }
        }

        // Create preview text
        let file_count = valid_paths.len();
        let preview_text = if file_count == 1 {
            format!(
                "[File] {}",
                std::path::Path::new(&valid_paths[0])
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&valid_paths[0])
            )
        } else {
            format!(
                "[Files] {} items ({:.1} MB)",
                file_count,
                total_size as f64 / (1024.0 * 1024.0)
            )
        };

        // Create metadata
        let metadata = FileMetadata {
            file_paths: valid_paths.clone(),
            total_size_bytes: total_size,
        };

        let item = ClipItem {
            id: content_hash,
            content_type: ContentType::File,
            content: serde_json::to_string(&valid_paths).unwrap_or_default(),
            preview_text,
            tags: vec![],
            source_app,
            created_at: Utc::now(),
            last_used_at: Utc::now(),
            pinned: false,
            metadata: Some(serde_json::to_value(metadata).unwrap_or_default()),
        };

        {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            db.insert_clip(&item).map_err(|e| e.to_string())?;
        }

        Ok(item)
    }

    /// Convert image to PNG format
    fn convert_to_png(
        &self,
        image_data: &[u8],
        _width: u32,
        _height: u32,
        format: &str,
    ) -> Result<Vec<u8>, String> {
        // For now, assume the data is already in a format we can handle
        // In a full implementation, you'd use the `image` crate to convert
        // Since we're using arboard which gives us raw bytes, we'll save as-is
        // and mark it properly

        // If it's already PNG, return as-is
        if format.eq_ignore_ascii_case("png") {
            return Ok(image_data.to_vec());
        }

        // For other formats, we'd need to decode and re-encode
        // This is a simplified version - in production you'd want proper image conversion
        Ok(image_data.to_vec())
    }

    /// Generate thumbnail for image
    fn generate_thumbnail(
        &self,
        image_data: &[u8],
        hash: &str,
        original_width: u32,
        original_height: u32,
    ) -> Result<PathBuf, String> {
        let thumbnails_dir = get_thumbnails_dir();
        let thumbnail_path = thumbnails_dir.join(format!("{}_thumb.png", hash));

        // Calculate thumbnail dimensions (max 200px)
        let max_size = 200u32;
        let (_thumb_width, _thumb_height) = if original_width > original_height {
            let ratio = original_height as f32 / original_width as f32;
            (max_size, (max_size as f32 * ratio) as u32)
        } else {
            let ratio = original_width as f32 / original_height as f32;
            ((max_size as f32 * ratio) as u32, max_size)
        };

        // For a full implementation, you'd use the `image` crate to resize
        // For now, we'll save a placeholder or the original
        // In production, implement proper thumbnail generation
        std::fs::write(&thumbnail_path, image_data)
            .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

        Ok(thumbnail_path)
    }

    pub fn get_recent_clips(&self, limit: i64) -> Result<Vec<ClipItem>, String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        db.get_clips(limit, 0).map_err(|e| e.to_string())
    }

    pub fn search_clips(&self, query: &str, limit: i64) -> Result<Vec<ClipItem>, String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        db.search_clips(query, limit).map_err(|e| e.to_string())
    }

    pub fn update_tags(&self, id: &str, tags: Vec<String>) -> Result<(), String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        db.update_clip_tags(id, tags).map_err(|e| e.to_string())
    }

    pub fn toggle_pin(&self, id: &str, pinned: bool) -> Result<(), String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        db.toggle_pin(id, pinned).map_err(|e| e.to_string())
    }

    pub fn delete_clip(&self, id: &str) -> Result<(), String> {
        // Get clip info first to delete associated files if it's an image
        let clip = {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            db.get_clip_by_content_hash(id).map_err(|e| e.to_string())?
        };

        if let Some(clip) = clip {
            if clip.content_type == ContentType::Image {
                // Delete image file
                let _ = std::fs::remove_file(&clip.content);

                // Delete thumbnail if exists
                if let Some(metadata) = clip.metadata {
                    if let Ok(img_metadata) = serde_json::from_value::<ImageMetadata>(metadata) {
                        if let Some(thumb_path) = img_metadata.thumbnail_path {
                            let _ = std::fs::remove_file(thumb_path);
                        }
                    }
                }
            }
        }

        let db = self.db.lock().map_err(|e| e.to_string())?;
        db.delete_clip(id).map_err(|e| e.to_string())
    }

    /// Get image data for a clip
    pub fn get_image_data(&self, clip_id: &str) -> Result<Vec<u8>, String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        let clip = db
            .get_clip_by_content_hash(clip_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Clip not found".to_string())?;

        if clip.content_type != ContentType::Image {
            return Err("Clip is not an image".to_string());
        }

        std::fs::read(&clip.content).map_err(|e| format!("Failed to read image: {}", e))
    }

    /// Get thumbnail data for a clip
    pub fn get_thumbnail_data(&self, clip_id: &str) -> Result<Vec<u8>, String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        let clip = db
            .get_clip_by_content_hash(clip_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Clip not found".to_string())?;

        if clip.content_type != ContentType::Image {
            return Err("Clip is not an image".to_string());
        }

        if let Some(metadata) = clip.metadata {
            if let Ok(img_metadata) = serde_json::from_value::<ImageMetadata>(metadata) {
                if let Some(thumb_path) = img_metadata.thumbnail_path {
                    return std::fs::read(thumb_path)
                        .map_err(|e| format!("Failed to read thumbnail: {}", e));
                }
            }
        }

        // Fallback to full image
        self.get_image_data(clip_id)
    }
}
