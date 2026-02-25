use chrono::{NaiveDate, TimeZone, Utc};
use std::sync::{Arc, Mutex};

use tauri::{Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

mod clipboard;
mod clipboard_monitor;
mod db;
mod input_panel;
mod settings;
mod tray;

use clipboard::ClipboardManager;
use clipboard_monitor::ClipboardMonitor;
use db::{ensure_app_dir, Database};
use input_panel::InputPanelManager;
use settings::Settings;

// State to share between commands
pub struct AppState {
    clipboard_manager: Arc<ClipboardManager>,
    settings: Arc<Mutex<Settings>>,
    input_panel: Arc<InputPanelManager>,
    tray_manager: Arc<tray::TrayManager>,
}

// Commands
#[tauri::command]
async fn save_text_clip(
    state: tauri::State<'_, AppState>,
    text: String,
    source_app: String,
) -> Result<db::ClipItem, String> {
    state.clipboard_manager.save_text_clip(text, source_app)
}

#[tauri::command]
async fn save_image_clip(
    state: tauri::State<'_, AppState>,
    image_data: Vec<u8>,
    width: u32,
    height: u32,
    format: String,
    source_app: String,
) -> Result<db::ClipItem, String> {
    state
        .clipboard_manager
        .save_image_clip(image_data, width, height, &format, source_app)
}

#[tauri::command]
async fn save_rich_text_clip(
    state: tauri::State<'_, AppState>,
    html_content: Option<String>,
    rtf_content: Option<String>,
    plain_text: String,
    source_app: String,
) -> Result<db::ClipItem, String> {
    state
        .clipboard_manager
        .save_rich_text_clip(html_content, rtf_content, plain_text, source_app)
}

#[tauri::command]
async fn save_file_clip(
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>,
    source_app: String,
) -> Result<db::ClipItem, String> {
    state
        .clipboard_manager
        .save_file_clip(file_paths, source_app)
}

#[tauri::command]
async fn get_recent_clips(
    state: tauri::State<'_, AppState>,
    limit: i64,
) -> Result<Vec<db::ClipItem>, String> {
    state.clipboard_manager.get_recent_clips(limit)
}

#[tauri::command]
async fn search_clips(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: i64,
) -> Result<Vec<db::ClipItem>, String> {
    state.clipboard_manager.search_clips(&query, limit)
}

#[tauri::command]
async fn get_all_tags(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let db = state
        .clipboard_manager
        .db
        .lock()
        .map_err(|e| e.to_string())?;
    db.get_all_tags().map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_tags(
    state: tauri::State<'_, AppState>,
    query: String,
) -> Result<Vec<String>, String> {
    let db = state
        .clipboard_manager
        .db
        .lock()
        .map_err(|e| e.to_string())?;
    db.search_tags(&query).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_clip_tags(
    state: tauri::State<'_, AppState>,
    id: String,
    tags: Vec<String>,
) -> Result<(), String> {
    state.clipboard_manager.update_tags(&id, tags)
}

#[tauri::command]
async fn toggle_clip_pin(
    state: tauri::State<'_, AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    state.clipboard_manager.toggle_pin(&id, pinned)
}

#[tauri::command]
async fn delete_clip(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.clipboard_manager.delete_clip(&id)
}

#[tauri::command]
async fn write_to_clipboard(_app: tauri::AppHandle, content: String) -> Result<(), String> {
    use arboard::Clipboard;

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_image_to_clipboard(
    _app: tauri::AppHandle,
    image_data: Vec<u8>,
) -> Result<(), String> {
    use arboard::{Clipboard, ImageData};
    use image::ImageReader;
    use std::io::Cursor;

    // Decode PNG to get raw RGBA data
    let reader = ImageReader::new(Cursor::new(&image_data))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;

    let img = reader.decode().map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    let image_data = ImageData {
        width: width as usize,
        height: height as usize,
        bytes: rgba.into_raw().into(),
    };

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_image(image_data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_clip_image_data(
    state: tauri::State<'_, AppState>,
    clip_id: String,
) -> Result<Vec<u8>, String> {
    state.clipboard_manager.get_image_data(&clip_id)
}

#[tauri::command]
async fn get_clip_thumbnail_data(
    state: tauri::State<'_, AppState>,
    clip_id: String,
) -> Result<Vec<u8>, String> {
    state.clipboard_manager.get_thumbnail_data(&clip_id)
}

// Settings commands
#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<Settings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[derive(serde::Deserialize)]
struct CleanupRequest {
    mode: String,
    start_date: Option<String>,
    end_date: Option<String>,
    before_date: Option<String>,
    older_than_days: Option<i64>,
}

fn parse_date_start(date_str: &str) -> Result<chrono::DateTime<Utc>, String> {
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .map_err(|_| "Invalid date format. Use YYYY-MM-DD".to_string())?;
    let dt = date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| "Invalid date value".to_string())?;
    Ok(Utc.from_utc_datetime(&dt))
}

fn parse_date_end_exclusive(date_str: &str) -> Result<chrono::DateTime<Utc>, String> {
    let start = parse_date_start(date_str)?;
    Ok(start + chrono::Duration::days(1))
}

#[tauri::command]
async fn cleanup_clips(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    request: CleanupRequest,
) -> Result<usize, String> {
    let db = state
        .clipboard_manager
        .db
        .lock()
        .map_err(|e| e.to_string())?;

    let deleted = match request.mode.as_str() {
        "range" => {
            let start_date = request
                .start_date
                .ok_or_else(|| "start_date is required".to_string())?;
            let end_date = request
                .end_date
                .ok_or_else(|| "end_date is required".to_string())?;
            let start = parse_date_start(&start_date)?;
            let end_exclusive = parse_date_end_exclusive(&end_date)?;
            if end_exclusive <= start {
                return Err("End date must be after start date".to_string());
            }
            db.cleanup_between(start, end_exclusive)
                .map_err(|e| e.to_string())?
        }
        "before" => {
            let before_date = request
                .before_date
                .ok_or_else(|| "before_date is required".to_string())?;
            let before = parse_date_start(&before_date)?;
            db.cleanup_before(before).map_err(|e| e.to_string())?
        }
        "older_than" => {
            let days = request
                .older_than_days
                .ok_or_else(|| "older_than_days is required".to_string())?;
            if days <= 0 {
                return Err("older_than_days must be greater than 0".to_string());
            }
            db.cleanup_old_clips(days).map_err(|e| e.to_string())?
        }
        _ => return Err("Unsupported cleanup mode".to_string()),
    };

    let _ = app.emit("clipboard-updated", ());
    Ok(deleted)
}

#[tauri::command]
async fn save_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    let mut settings = settings;
    settings.enable_input_panel = false;

    let mut current = state.settings.lock().map_err(|e| e.to_string())?;

    // Check if always_on_top changed
    let old_always_on_top = current.always_on_top;
    let new_always_on_top = settings.always_on_top;

    let old_show_on_startup = current.show_on_startup;
    let new_show_on_startup = settings.show_on_startup;

    let old_start_minimized = current.start_minimized;
    let new_start_minimized = settings.start_minimized;

    // Check if language changed
    let old_language = current.language.clone();
    let new_language = settings.language.clone();

    let input_panel_enabled = false;
    let input_panel_trigger = settings.input_panel_trigger.clone();
    let input_panel_selection_modifier = settings.input_panel_selection_modifier.clone();

    // Global shortcut changes are handled by the plugin rebuild on restart

    *current = settings.clone();
    current.save().map_err(|e| e.to_string())?;
    drop(current); // Release the lock before async operations

    let autostart_result = if settings.autostart_enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    };

    if let Err(e) = autostart_result {
        eprintln!("Failed to update autostart setting: {}", e);
    }

    // Apply always_on_top change immediately
    if old_always_on_top != new_always_on_top {
        if let Some(window) = app.get_webview_window("main") {
            window
                .set_always_on_top(new_always_on_top)
                .map_err(|e| e.to_string())?;
        }
    }

    if old_show_on_startup != new_show_on_startup || old_start_minimized != new_start_minimized {
        if let Some(window) = app.get_webview_window("main") {
            let is_visible = window.is_visible().unwrap_or(false);
            if new_show_on_startup && !new_start_minimized {
                if !is_visible {
                    let _ = window.show();
                }
                let _ = window.set_focus();
            } else if is_visible {
                let _ = window.hide();
            }
        }
    }

    // Update tray menu language if changed
    if old_language != new_language {
        let _ = state.tray_manager.update_language(&app, &new_language);
    }

    state.input_panel.set_enabled(input_panel_enabled);
    state.input_panel.set_trigger(input_panel_trigger);
    state
        .input_panel
        .set_selection_modifier(input_panel_selection_modifier);

    // Notify frontend that shortcuts changed
    let _ = app.emit("shortcuts-changed", ());
    let _ = app.emit("settings-changed", &settings);

    Ok(())
}

#[tauri::command]
async fn validate_shortcuts(settings: Settings) -> Result<Vec<String>, String> {
    Ok(settings.validate_shortcuts())
}

/// Toggle the main window visibility
/// If window is visible, hide it; otherwise show and focus it
#[tauri::command]
async fn toggle_main_window(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            return Ok(true); // Was visible, now hidden
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            return Ok(false); // Was hidden, now shown
        }
    }
    Ok(false)
}

/// Show the main window (only if currently hidden)
#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        if !is_visible {
            window.show().map_err(|e| e.to_string())?;
        }
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the main window (only if currently visible)
#[tauri::command]
async fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn is_main_window_visible(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        return window.is_visible().map_err(|e| e.to_string());
    }
    Ok(false)
}

// Notification command
#[tauri::command]
async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .icon("icon")
        .show()
        .map_err(|e| e.to_string())
}

// Check if running as administrator (Windows only)
#[tauri::command]
async fn is_running_as_admin() -> Result<bool, String> {
    #[cfg(windows)]
    {
        use std::mem::size_of;
        use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
        use windows_sys::Win32::Security::{
            GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
        };
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        unsafe {
            let mut token: HANDLE = std::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return Err("Failed to open process token".to_string());
            }

            let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
            let mut return_length: u32 = 0;
            let success = GetTokenInformation(
                token,
                TokenElevation,
                &mut elevation as *mut TOKEN_ELEVATION as *mut _,
                size_of::<TOKEN_ELEVATION>() as u32,
                &mut return_length,
            );

            CloseHandle(token);

            if success == 0 {
                Err("Failed to query token elevation".to_string())
            } else {
                Ok(elevation.TokenIsElevated != 0)
            }
        }
    }
    #[cfg(not(windows))]
    {
        Ok(false) // Not applicable on non-Windows
    }
}

// Restart as administrator (Windows only)
#[tauri::command]
async fn restart_as_admin(_app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::env;
        use std::process::Command;

        let exe_path = env::current_exe().map_err(|e| format!("Failed to get exe path: {}", e))?;

        // Use PowerShell to start the process with admin privileges
        let ps_script = format!(
            "Start-Process '{}' -Verb runAs",
            exe_path.to_string_lossy().replace("'", "''")
        );

        Command::new("powershell")
            .args(["-Command", &ps_script])
            .spawn()
            .map_err(|e| format!("Failed to restart as admin: {}", e))?;

        // Exit current process
        _app.exit(0);
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Not supported on this platform".to_string())
    }
}

// Send backspace keys to delete trigger and search content, then paste
#[tauri::command]
async fn paste_and_cleanup(
    _app: tauri::AppHandle,
    content: String,
    trigger_len: i32,
    search_len: i32,
) -> Result<(), String> {
    use rdev::{simulate, EventType, Key};
    use std::{thread, time::Duration};

    let total_to_delete = trigger_len + search_len;

    // Send backspace to delete trigger and search content
    for _ in 0..total_to_delete {
        simulate(&EventType::KeyPress(Key::Backspace))
            .map_err(|e| format!("Failed to simulate backspace: {:?}", e))?;
        simulate(&EventType::KeyRelease(Key::Backspace))
            .map_err(|e| format!("Failed to simulate backspace: {:?}", e))?;
        thread::sleep(Duration::from_millis(10));
    }

    // Small delay before pasting
    thread::sleep(Duration::from_millis(50));

    // Write content to clipboard using arboard for better compatibility
    use arboard::Clipboard;
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())?;

    // Simulate Ctrl+V to paste
    simulate(&EventType::KeyPress(Key::ControlLeft))
        .map_err(|e| format!("Failed to simulate ctrl: {:?}", e))?;
    simulate(&EventType::KeyPress(Key::KeyV))
        .map_err(|e| format!("Failed to simulate v: {:?}", e))?;
    simulate(&EventType::KeyRelease(Key::KeyV))
        .map_err(|e| format!("Failed to simulate v: {:?}", e))?;
    simulate(&EventType::KeyRelease(Key::ControlLeft))
        .map_err(|e| format!("Failed to simulate ctrl: {:?}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ensure app directory exists
    let app_dir = ensure_app_dir().expect("Failed to create app directory");

    // Initialize database
    let db = Arc::new(Mutex::new(
        Database::new(app_dir.clone()).expect("Failed to initialize database"),
    ));

    // Initialize clipboard manager
    let clipboard_manager = Arc::new(ClipboardManager::new(db));

    // Initialize settings
    let settings = Arc::new(Mutex::new(Settings::load(&app_dir).unwrap_or_default()));

    // Initialize input panel manager
    let input_panel = Arc::new(InputPanelManager::new());

    let tray_manager = Arc::new(tray::TrayManager::new());

    let state = AppState {
        clipboard_manager: clipboard_manager.clone(),
        settings: settings.clone(),
        input_panel: input_panel.clone(),
        tray_manager: tray_manager.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            save_text_clip,
            save_image_clip,
            save_rich_text_clip,
            save_file_clip,
            get_recent_clips,
            search_clips,
            get_all_tags,
            search_tags,
            update_clip_tags,
            toggle_clip_pin,
            delete_clip,
            write_to_clipboard,
            write_image_to_clipboard,
            get_clip_image_data,
            get_clip_thumbnail_data,
            get_settings,
            save_settings,
            cleanup_clips,
            validate_shortcuts,
            toggle_main_window,
            show_main_window,
            hide_main_window,
            is_main_window_visible,
            show_notification,
            is_running_as_admin,
            restart_as_admin,
            paste_and_cleanup,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Get settings for window configuration
            let (always_on_top, show_on_startup, start_minimized, toggle_shortcut) = {
                let s = settings.lock().unwrap();
                (
                    s.always_on_top,
                    s.show_on_startup,
                    s.start_minimized,
                    s.shortcuts.toggle_window.to_config_string(),
                )
            };

            // Configure main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(always_on_top);
                if show_on_startup && !start_minimized {
                    let _ = window.show();
                    let _ = window.set_focus();
                } else {
                    let _ = window.hide();
                }
            }

            // Apply autostart setting
            {
                let s = settings.lock().unwrap();
                if s.autostart_enabled {
                    let _ = app_handle.autolaunch().enable();
                } else {
                    let _ = app_handle.autolaunch().disable();
                }
            }

            // Create tray icon
            #[cfg(desktop)]
            {
                tray_manager.create_tray(app)?;
            }

            // Setup global shortcut
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::ShortcutState;

                let shortcut_str = toggle_shortcut;

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts([shortcut_str.as_str()])
                        .unwrap()
                        .with_handler(move |app: &tauri::AppHandle, _shortcut, event| {
                            if event.state == ShortcutState::Pressed {
                                if let Some(window) = app.get_webview_window("main") {
                                    // Toggle window visibility
                                    let is_visible = window.is_visible().unwrap_or(false);
                                    if is_visible {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        })
                        .build(),
                )?;
            }

            // Setup input panel
            {
                input_panel.set_enabled(false);
                input_panel.set_app_handle(app_handle.clone());
            }

            // Setup clipboard monitor using arboard (supports text, images, files)
            {
                let monitor = ClipboardMonitor::new(clipboard_manager.clone());
                monitor.start_monitoring(app_handle.clone());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
