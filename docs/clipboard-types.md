# 剪切板多类型支持

本文档描述了 Fat Clip 应用支持的剪切板内容类型。

## 支持的内容类型

### 1. 纯文本 (Plain Text)
- **类型标识**: `Plain`
- **存储方式**: 直接存储文本内容
- **预览**: 显示文本前200个字符
- **复制**: 直接复制文本到剪切板
- **监听**: ✅ 所有平台支持

### 2. 富文本 (Rich Text)
- **类型标识**: `Rich`
- **存储方式**: JSON 格式存储，包含以下字段:
  - `html`: HTML 格式内容（可选）
  - `rtf`: RTF 格式内容（可选）
  - `plain`: 纯文本内容
- **预览**: 显示 `[Rich Text]` 前缀 + 纯文本预览
- **复制**: 提取纯文本内容复制到剪切板
- **监听**: 
  - Windows: ✅ 支持 (CF_HTML)
  - macOS: ✅ 支持 (NSPasteboard public.html)
  - Linux: ❌ 暂不支持
- **元数据**:
  - `has_html`: 是否包含 HTML
  - `has_rtf`: 是否包含 RTF
  - `html_preview`: HTML 预览片段

### 3. 图片 (Image)
- **类型标识**: `Image`
- **存储方式**: 
  - 图片文件存储在应用数据目录的 `images/` 子目录
  - 数据库中存储图片文件路径
  - 自动生成缩略图存储在 `thumbnails/` 子目录
- **预览**: 显示图片缩略图
- **复制**: 将图片数据复制到剪切板
- **监听**:
  - Windows: ✅ 支持
  - macOS: ✅ 支持
  - Linux: ❌ 不支持（arboard 限制）
- **元数据**:
  - `width`: 图片宽度（像素）
  - `height`: 图片高度（像素）
  - `format`: 图片格式（如 "png"）
  - `size_bytes`: 文件大小（字节）
  - `thumbnail_path`: 缩略图路径

### 4. 文件引用 (File)
- **类型标识**: `File`
- **存储方式**: JSON 数组存储文件路径列表
- **预览**: 显示文件数量和总大小
- **复制**: 复制文件路径列表到剪切板
- **监听**:
  - Windows: ✅ 支持 (CF_HDROP)
  - macOS: ✅ 支持 (NSPasteboard file URLs)
  - Linux: ✅ 支持 (text/uri-list)
- **元数据**:
  - `file_paths`: 文件路径数组
  - `total_size_bytes`: 总大小（字节）

## 跨平台支持矩阵

| 功能 | Windows | macOS | Linux |
|------|---------|-------|-------|
| 文本监听 | ✅ | ✅ | ✅ |
| 图片监听 | ✅ | ✅ | ❌ |
| HTML 监听 | ✅ | ✅ | ❌ |
| 文件监听 | ✅ | ✅ | ✅ |
| 图片复制到剪切板 | ✅ | ✅ | ✅ |
| 文本复制到剪切板 | ✅ | ✅ | ✅ |

## 数据库结构

### clip_items 表

```sql
CREATE TABLE IF NOT EXISTS clip_items (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,  -- "plain", "rich", "image", "file"
    content TEXT NOT NULL,       -- 文本内容或文件路径
    preview_text TEXT NOT NULL,  -- 用于列表显示的预览文本
    tags TEXT NOT NULL DEFAULT '[]',
    source_app TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    metadata TEXT                -- JSON 格式的元数据
);
```

## 文件存储结构

```
%APPDATA%/fat-clip/          (Windows)
~/Library/Application Support/fat-clip/  (macOS)
~/.local/share/fat-clip/     (Linux)
├── fat_clip.db          # SQLite 数据库
├── images/              # 存储图片文件
│   ├── <hash>.png
│   └── ...
└── thumbnails/          # 存储缩略图
    ├── <hash>_thumb.png
    └── ...
```

## 剪切板监控实现

### 文本监控
- **所有平台**: 使用 `arboard` crate
- **轮询间隔**: 500ms
- **去重**: 使用内容哈希

### 图片监控
- **Windows/macOS**: 使用 `arboard` crate
- **格式转换**: BGRA (Windows) / RGBA (macOS) → PNG
- **Linux**: 暂不支持（arboard 限制）

### HTML 监控
- **Windows**: Win32 API (CF_HTML format)
- **macOS**: NSPasteboard (public.html)
- **Linux**: 暂不支持

### 文件监控
- **Windows**: Win32 API (CF_HDROP format)
- **macOS**: NSPasteboard (file URLs via AppleScript)
- **Linux**: xclip/wl-paste (text/uri-list MIME type)

## API 命令

### 保存剪切板内容

```rust
// 保存文本
save_text_clip(text: String, source_app: String) -> ClipItem

// 保存图片
save_image_clip(
    image_data: Vec<u8>,
    width: u32,
    height: u32,
    format: String,
    source_app: String
) -> ClipItem

// 保存富文本
save_rich_text_clip(
    html_content: Option<String>,
    rtf_content: Option<String>,
    plain_text: String,
    source_app: String
) -> ClipItem

// 保存文件
save_file_clip(file_paths: Vec<String>, source_app: String) -> ClipItem
```

### 读取剪切板内容

```rust
// 获取图片数据
get_clip_image_data(clip_id: String) -> Vec<u8>

// 获取缩略图数据
get_clip_thumbnail_data(clip_id: String) -> Vec<u8>
```

### 写入剪切板

```rust
// 写入文本
write_to_clipboard(content: String)

// 写入图片
write_image_to_clipboard(image_data: Vec<u8>)
```

## 搜索语法

支持以下搜索过滤语法：

- **标签搜索**: `tag:工作` 或 `#工作`
- **类型过滤**: `type:image`（搜索图片）
- **普通搜索**: 直接输入关键词搜索文本内容

## 前端组件

### 内容类型图标

| 类型 | 图标 | 标签 |
|------|------|------|
| Plain | 📝 | 文本 |
| Rich | 🎨 | 富文本 |
| Image | 🖼️ | 图片 |
| File | 📎 | 文件 |

### 内容渲染

- **文本**: 显示在可滚动的代码块中
- **富文本**: 显示 HTML 预览（如果有）+ 纯文本内容
- **图片**: 显示图片缩略图，点击可查看大图
- **文件**: 显示文件列表，最多显示5个文件，显示文件图标

### 内容类型过滤

顶部标签页支持按类型过滤：
- 全部
- 文本
- 富文本
- 图片
- 文件

## 依赖

### Rust 依赖

```toml
[dependencies]
arboard = { version = "3.4", features = ["image"] }
image = { version = "0.25", default-features = false, features = ["png", "jpeg", "bmp"] }
```

### Windows 特定依赖

```toml
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.59", features = [
    "Win32_Foundation",
    "Win32_Security",
    "Win32_System_Threading",
    "Win32_System_DataExchange",
    "Win32_System_Memory",
    "Win32_UI_Shell"
] }
```

### Linux 系统依赖

- `xclip`: X11 剪切板支持
- `wl-clipboard`: Wayland 剪切板支持

安装命令：
```bash
# Ubuntu/Debian
sudo apt-get install xclip wl-clipboard

# Fedora
sudo dnf install xclip wl-clipboard

# Arch
sudo pacman -S xclip wl-clipboard
```

## 实现细节

### 图片处理

1. **格式转换**: 使用 `image` crate 将各种格式转换为 PNG
2. **BGRA 到 RGBA**: Windows 剪切板返回 BGRA 格式，需要转换为 RGBA
3. **缩略图**: 预留缩略图生成接口（当前保存原图）

### 去重机制

- **文本**: 使用内容哈希
- **图片**: 使用图片数据哈希
- **文件**: 使用文件路径组合哈希

### 通知

复制内容时，如果主窗口隐藏，会显示系统通知：
- 文本: 显示前30个字符
- 图片: 显示 "[Image] 宽度x高度"
- 文件: 显示 "[Files] N items"
- 富文本: 显示 "[Rich Text] 预览"

## 待完善功能

1. **Linux 图片监听**: 等待 arboard 或寻找替代方案
2. **Linux HTML 监听**: 实现 text/html MIME 类型支持
3. **缩略图生成**: 实现真正的缩略图生成而非保存原图
4. **图片编辑**: 支持旋转、裁剪等基本编辑
5. **批量操作**: 支持多选图片/文件进行批量操作
6. **文件拖放**: 支持从应用拖拽文件到外部
