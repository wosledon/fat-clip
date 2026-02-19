use arboard::Clipboard;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

use crate::clipboard::ClipboardManager;

/// Represents different types of clipboard content
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ClipboardContent {
    Text(String),
    Image {
        data: Vec<u8>,
        width: u32,
        height: u32,
    },
    Files(Vec<String>),
    Html {
        html: String,
        text: String,
    },
    Rtf {
        rtf: String,
        text: String,
    },
    None,
}

/// Clipboard monitor that watches for changes
pub struct ClipboardMonitor {
    clipboard_manager: Arc<ClipboardManager>,
    last_text_hash: Arc<Mutex<String>>,
    #[cfg(not(target_os = "linux"))]
    last_image_hash: Arc<Mutex<String>>,
    last_files_hash: Arc<Mutex<String>>,
    #[cfg(any(windows, target_os = "macos"))]
    last_html_hash: Arc<Mutex<String>>,
}

impl ClipboardMonitor {
    pub fn new(clipboard_manager: Arc<ClipboardManager>) -> Self {
        ClipboardMonitor {
            clipboard_manager,
            last_text_hash: Arc::new(Mutex::new(String::new())),
            #[cfg(not(target_os = "linux"))]
            last_image_hash: Arc::new(Mutex::new(String::new())),
            last_files_hash: Arc::new(Mutex::new(String::new())),
            #[cfg(any(windows, target_os = "macos"))]
            last_html_hash: Arc::new(Mutex::new(String::new())),
        }
    }

    /// Start monitoring clipboard in a background thread
    pub fn start_monitoring(&self, app_handle: tauri::AppHandle) {
        let clipboard_manager = self.clipboard_manager.clone();
        let last_text_hash = self.last_text_hash.clone();
        #[cfg(not(target_os = "linux"))]
        let last_image_hash = self.last_image_hash.clone();
        let last_files_hash = self.last_files_hash.clone();
        #[cfg(any(windows, target_os = "macos"))]
        let last_html_hash = self.last_html_hash.clone();

        thread::spawn(move || {
            let mut clipboard = match Clipboard::new() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to create clipboard: {}", e);
                    return;
                }
            };

            loop {
                // Check for text content
                if let Ok(text) = clipboard.get_text() {
                    if !text.trim().is_empty() {
                        let hash = generate_hash(&text);
                        let should_process = {
                            let mut last = last_text_hash.lock().unwrap();
                            if hash != *last {
                                *last = hash.clone();
                                true
                            } else {
                                false
                            }
                        };

                        if should_process {
                            println!("New text content detected: {}", &text[..text.len().min(50)]);
                            if let Err(e) =
                                clipboard_manager.save_text_clip(text, "Unknown".to_string())
                            {
                                eprintln!("Failed to save text clip: {}", e);
                            } else {
                                let _ = app_handle.emit("clipboard-updated", ());
                            }
                        }
                    }
                }

                // Check for image content (not on Linux due to arboard limitations)
                #[cfg(not(target_os = "linux"))]
                {
                    if let Ok(image_data) = clipboard.get_image() {
                        let hash = generate_image_hash(&image_data.bytes);
                        let should_process = {
                            let mut last = last_image_hash.lock().unwrap();
                            if hash != *last {
                                *last = hash.clone();
                                true
                            } else {
                                false
                            }
                        };

                        if should_process {
                            println!(
                                "New image content detected: {}x{}px",
                                image_data.width, image_data.height
                            );

                            // Convert image data to PNG
                            match convert_to_png(&image_data) {
                                Ok(png_data) => {
                                    if let Err(e) = clipboard_manager.save_image_clip(
                                        png_data,
                                        image_data.width as u32,
                                        image_data.height as u32,
                                        "png",
                                        "Unknown".to_string(),
                                    ) {
                                        eprintln!("Failed to save image clip: {}", e);
                                    } else {
                                        let _ = app_handle.emit("clipboard-updated", ());
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Failed to convert image to PNG: {}", e);
                                }
                            }
                        }
                    }
                }

                // Platform-specific clipboard format checks
                #[cfg(windows)]
                {
                    check_windows_clipboard(
                        &clipboard,
                        &clipboard_manager,
                        &last_html_hash,
                        &last_files_hash,
                        &app_handle,
                    );
                }

                #[cfg(target_os = "macos")]
                {
                    check_macos_clipboard(
                        &clipboard,
                        &clipboard_manager,
                        &last_html_hash,
                        &last_files_hash,
                        &app_handle,
                    );
                }

                #[cfg(target_os = "linux")]
                {
                    check_linux_clipboard(
                        &clipboard,
                        &clipboard_manager,
                        &last_files_hash,
                        &app_handle,
                    );
                }

                thread::sleep(Duration::from_millis(500));
            }
        });
    }
}

/// Check Windows-specific clipboard formats
#[cfg(windows)]
fn check_windows_clipboard(
    _clipboard: &Clipboard,
    clipboard_manager: &Arc<ClipboardManager>,
    last_html_hash: &Arc<Mutex<String>>,
    last_files_hash: &Arc<Mutex<String>>,
    app_handle: &tauri::AppHandle,
) {
    // Check for HTML content
    match get_windows_html_from_clipboard() {
        Ok(html) if !html.is_empty() => {
            let text = Clipboard::new().unwrap().get_text().unwrap_or_default();
            let combined = format!("{}{}", html, text);
            let hash = generate_hash(&combined);

            let should_process = {
                let mut last = last_html_hash.lock().unwrap();
                if hash != *last {
                    *last = hash.clone();
                    true
                } else {
                    false
                }
            };

            if should_process {
                println!("New HTML content detected");
                if let Err(e) = clipboard_manager.save_rich_text_clip(
                    Some(html),
                    None,
                    text,
                    "Unknown".to_string(),
                ) {
                    eprintln!("Failed to save HTML clip: {}", e);
                } else {
                    let _ = app_handle.emit("clipboard-updated", ());
                }
            }
        }
        _ => {}
    }

    // Check for files
    match get_windows_files_from_clipboard() {
        Ok(files) if !files.is_empty() => {
            let combined = files.join("\n");
            let hash = generate_hash(&combined);

            let should_process = {
                let mut last = last_files_hash.lock().unwrap();
                if hash != *last {
                    *last = hash.clone();
                    true
                } else {
                    false
                }
            };

            if should_process {
                println!("New files detected: {} items", files.len());
                if let Err(e) = clipboard_manager.save_file_clip(files, "Unknown".to_string()) {
                    eprintln!("Failed to save file clip: {}", e);
                } else {
                    let _ = app_handle.emit("clipboard-updated", ());
                }
            }
        }
        _ => {}
    }
}

/// Check macOS-specific clipboard formats
#[cfg(target_os = "macos")]
fn check_macos_clipboard(
    _clipboard: &Clipboard,
    clipboard_manager: &Arc<ClipboardManager>,
    last_html_hash: &Arc<Mutex<String>>,
    last_files_hash: &Arc<Mutex<String>>,
    app_handle: &tauri::AppHandle,
) {
    // Check for HTML content
    match get_macos_html_from_clipboard() {
        Ok(html) if !html.is_empty() => {
            let text = Clipboard::new().unwrap().get_text().unwrap_or_default();
            let combined = format!("{}{}", html, text);
            let hash = generate_hash(&combined);

            let should_process = {
                let mut last = last_html_hash.lock().unwrap();
                if hash != *last {
                    *last = hash.clone();
                    true
                } else {
                    false
                }
            };

            if should_process {
                println!("New HTML content detected on macOS");
                if let Err(e) = clipboard_manager.save_rich_text_clip(
                    Some(html),
                    None,
                    text,
                    "Unknown".to_string(),
                ) {
                    eprintln!("Failed to save HTML clip: {}", e);
                } else {
                    let _ = app_handle.emit("clipboard-updated", ());
                }
            }
        }
        _ => {}
    }

    // Check for files
    match get_macos_files_from_clipboard() {
        Ok(files) if !files.is_empty() => {
            let combined = files.join("\n");
            let hash = generate_hash(&combined);

            let should_process = {
                let mut last = last_files_hash.lock().unwrap();
                if hash != *last {
                    *last = hash.clone();
                    true
                } else {
                    false
                }
            };

            if should_process {
                println!("New files detected on macOS: {} items", files.len());
                if let Err(e) = clipboard_manager.save_file_clip(files, "Unknown".to_string()) {
                    eprintln!("Failed to save file clip: {}", e);
                } else {
                    let _ = app_handle.emit("clipboard-updated", ());
                }
            }
        }
        _ => {}
    }
}

/// Check Linux-specific clipboard formats
#[cfg(target_os = "linux")]
fn check_linux_clipboard(
    _clipboard: &Clipboard,
    clipboard_manager: &Arc<ClipboardManager>,
    last_files_hash: &Arc<Mutex<String>>,
    app_handle: &tauri::AppHandle,
) {
    // Check for files (GNOME/KDE use text/uri-list)
    match get_linux_files_from_clipboard() {
        Ok(files) if !files.is_empty() => {
            let combined = files.join("\n");
            let hash = generate_hash(&combined);

            let should_process = {
                let mut last = last_files_hash.lock().unwrap();
                if hash != *last {
                    *last = hash.clone();
                    true
                } else {
                    false
                }
            };

            if should_process {
                println!("New files detected on Linux: {} items", files.len());
                if let Err(e) = clipboard_manager.save_file_clip(files, "Unknown".to_string()) {
                    eprintln!("Failed to save file clip: {}", e);
                } else {
                    let _ = app_handle.emit("clipboard-updated", ());
                }
            }
        }
        _ => {}
    }
}

/// Generate hash for content deduplication
fn generate_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Generate hash for image data
#[cfg(not(target_os = "linux"))]
fn generate_image_hash(data: &[u8]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Convert arboard ImageData to PNG bytes
#[cfg(not(target_os = "linux"))]
fn convert_to_png(image_data: &arboard::ImageData) -> Result<Vec<u8>, String> {
    use image::{ImageBuffer, ImageFormat, Rgba};
    use std::io::Cursor;

    // Create image buffer from raw bytes
    let width = image_data.width as u32;
    let height = image_data.height as u32;

    // arboard returns bytes in BGRA format on Windows, RGBA on macOS
    // We need to convert to RGBA for the image crate
    let rgba_bytes = if cfg!(target_os = "windows") {
        // Convert BGRA to RGBA
        image_data
            .bytes
            .chunks_exact(4)
            .flat_map(|chunk| [chunk[2], chunk[1], chunk[0], chunk[3]])
            .collect::<Vec<u8>>()
    } else {
        image_data.bytes.to_vec()
    };

    let img = ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, rgba_bytes)
        .ok_or_else(|| "Failed to create image buffer".to_string())?;

    // Encode as PNG
    let mut cursor = Cursor::new(Vec::new());
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    Ok(cursor.into_inner())
}

// ==================== Windows Implementations ====================

/// Get HTML content from clipboard (Windows)
#[cfg(windows)]
fn get_windows_html_from_clipboard() -> Result<String, String> {
    use windows_sys::Win32::Foundation::{HANDLE, HGLOBAL};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, OpenClipboard,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};

    const CF_HTML: u32 = 49383; // Registered clipboard format for HTML

    unsafe {
        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return Err("Failed to open clipboard".to_string());
        }

        let handle: HANDLE = GetClipboardData(CF_HTML);
        if handle.is_null() {
            CloseClipboard();
            return Err("No HTML data in clipboard".to_string());
        }

        let ptr = GlobalLock(handle as HGLOBAL);
        if ptr.is_null() {
            CloseClipboard();
            return Err("Failed to lock global memory".to_string());
        }

        // CF_HTML is UTF-8 encoded
        let data = std::ffi::CStr::from_ptr(ptr as *const i8)
            .to_string_lossy()
            .to_string();

        GlobalUnlock(handle as HGLOBAL);
        CloseClipboard();

        // Parse CF_HTML format to extract actual HTML
        if let Some(start) = data.find("<!--StartFragment-->") {
            if let Some(end) = data.find("<!--EndFragment-->") {
                let html = &data[start + 20..end];
                return Ok(html.to_string());
            }
        }

        Ok(data)
    }
}

/// Get file paths from clipboard (Windows)
#[cfg(windows)]
fn get_windows_files_from_clipboard() -> Result<Vec<String>, String> {
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::Foundation::{HANDLE, HGLOBAL, MAX_PATH};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, OpenClipboard,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};
    use windows_sys::Win32::UI::Shell::DragQueryFileW;

    const CF_HDROP: u32 = 15; // Standard clipboard format for file drop

    unsafe {
        if OpenClipboard(std::ptr::null_mut()) == 0 {
            return Err("Failed to open clipboard".to_string());
        }

        let handle: HANDLE = GetClipboardData(CF_HDROP);
        if handle.is_null() {
            CloseClipboard();
            return Err("No file data in clipboard".to_string());
        }

        let hdrop = GlobalLock(handle as HGLOBAL);
        if hdrop.is_null() {
            CloseClipboard();
            return Err("Failed to lock global memory".to_string());
        }

        let file_count = DragQueryFileW(hdrop, 0xFFFFFFFF, std::ptr::null_mut(), 0);

        let mut files = Vec::new();
        let mut buffer = vec![0u16; MAX_PATH as usize];

        for i in 0..file_count {
            let len = DragQueryFileW(hdrop, i, buffer.as_mut_ptr(), MAX_PATH);
            if len > 0 {
                let path = std::ffi::OsString::from_wide(&buffer[..len as usize])
                    .to_string_lossy()
                    .to_string();
                files.push(path);
            }
        }

        GlobalUnlock(handle as HGLOBAL);
        CloseClipboard();

        Ok(files)
    }
}

// ==================== macOS Implementations ====================

#[cfg(target_os = "macos")]
mod macos;

/// Get HTML content from clipboard (macOS)
#[cfg(target_os = "macos")]
fn get_macos_html_from_clipboard() -> Result<String, String> {
    macos::get_macos_html()
}

/// Get file paths from clipboard (macOS)
#[cfg(target_os = "macos")]
fn get_macos_files_from_clipboard() -> Result<Vec<String>, String> {
    macos::get_macos_files()
}

// ==================== Linux Implementations ====================

/// Get file paths from clipboard (Linux)
#[cfg(target_os = "linux")]
fn get_linux_files_from_clipboard() -> Result<Vec<String>, String> {
    use std::process::Command;

    // Try xclip first (X11)
    let result = Command::new("xclip")
        .args(["-selection", "clipboard", "-t", "text/uri-list", "-o"])
        .output();

    match result {
        Ok(output) if output.status.success() => {
            let urls = String::from_utf8_lossy(&output.stdout);
            let files: Vec<String> = urls
                .lines()
                .filter(|line| !line.starts_with('#'))
                .filter_map(|line| {
                    // Convert file:// URL to path
                    if let Some(path) = line.strip_prefix("file://") {
                        // URL decode the path
                        Some(url_decode(path))
                    } else {
                        None
                    }
                })
                .collect();

            if files.is_empty() {
                Err("No files found".to_string())
            } else {
                Ok(files)
            }
        }
        _ => {
            // Try wl-copy (Wayland)
            get_linux_files_from_wayland()
        }
    }
}

/// Get files from Wayland clipboard
#[cfg(target_os = "linux")]
fn get_linux_files_from_wayland() -> Result<Vec<String>, String> {
    use std::process::Command;

    let result = Command::new("wl-paste")
        .args(["--type", "text/uri-list"])
        .output();

    match result {
        Ok(output) if output.status.success() => {
            let urls = String::from_utf8_lossy(&output.stdout);
            let files: Vec<String> = urls
                .lines()
                .filter(|line| !line.starts_with('#'))
                .filter_map(|line| {
                    if let Some(path) = line.strip_prefix("file://") {
                        Some(url_decode(path))
                    } else {
                        None
                    }
                })
                .collect();

            if files.is_empty() {
                Err("No files found".to_string())
            } else {
                Ok(files)
            }
        }
        _ => Err("Failed to get files from clipboard".to_string()),
    }
}

/// URL decode a string
#[cfg(target_os = "linux")]
fn url_decode(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            } else {
                result.push('%');
                result.push_str(&hex);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }

    result
}
