//! macOS-specific clipboard monitoring using AppleScript

use std::process::Command;

/// Get HTML content from NSPasteboard
pub fn get_macos_html() -> Result<String, String> {
    // Try using pbpaste with HTML format
    let result = Command::new("pbpaste")
        .arg("-Prefer")
        .arg("html")
        .output();
    
    match result {
        Ok(output) if output.status.success() => {
            let html = String::from_utf8_lossy(&output.stdout);
            let html = html.trim();
            
            // Check if it's actually HTML
            if html.starts_with('<') || html.contains('<html') || html.contains('<body') {
                return Ok(html.to_string());
            }
        }
        _ => {}
    }
    
    // Fallback: try using osascript
    let script = r#"try
    tell application "System Events"
        set pb to current application's NSPasteboard's generalPasteboard()
        set htmlData to pb's dataForType:"public.html"
        if htmlData is not missing value then
            set htmlString to (current application's NSString's alloc()'s initWithData:htmlData encoding:(current application's NSUTF8StringEncoding))
            return htmlString as string
        end if
    end tell
    return ""
end try"#;
    
    match Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output() 
    {
        Ok(output) if output.status.success() => {
            let html = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !html.is_empty() {
                Ok(html)
            } else {
                Err("No HTML content found".to_string())
            }
        }
        _ => Err("Failed to get HTML from clipboard".to_string()),
    }
}

/// Get file URLs from NSPasteboard
pub fn get_macos_files() -> Result<Vec<String>, String> {
    // Try using osascript to get file URLs
    let script = r#"try
    tell application "System Events"
        set pb to current application's NSPasteboard's generalPasteboard()
        set fileURLs to pb's readObjectsForClasses:{current application's NSURL's class} options:{NSPasteboardURLReadingFileURLsOnlyKey:true}
        set pathList to {}
        repeat with url in fileURLs
            set end of pathList to url's |path|() as string
        end repeat
        return pathList as string
    end tell
    return ""
on error
    return ""
end try"#;
    
    match Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output() 
    {
        Ok(output) if output.status.success() => {
            let paths_str = String::from_utf8_lossy(&output.stdout);
            let files: Vec<String> = paths_str
                .trim_matches(|c| c == '{' || c == '}' || c == '"' || c == '\n' || c == '\r')
                .split(", ")
                .map(|s| s.trim().trim_matches('"').to_string())
                .filter(|s| !s.is_empty() && s.starts_with('/'))
                .collect();
            
            if files.is_empty() {
                // Try alternative method: check if clipboard contains a single file path
                get_macos_single_file()
            } else {
                Ok(files)
            }
        }
        _ => get_macos_single_file(),
    }
}

/// Try to get a single file path from clipboard
fn get_macos_single_file() -> Result<Vec<String>, String> {
    let result = Command::new("pbpaste").output();
    
    match result {
        Ok(output) if output.status.success() => {
            let content = String::from_utf8_lossy(&output.stdout);
            let path = content.trim();
            
            // Check if it's a file path
            if path.starts_with('/') && std::path::Path::new(path).exists() {
                Ok(vec![path.to_string()])
            } else {
                Err("No file path found".to_string())
            }
        }
        _ => Err("Failed to get file from clipboard".to_string()),
    }
}
