use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub struct TrayManager {
    tray_icon: Mutex<Option<TrayIcon>>,
}

impl TrayManager {
    pub fn new() -> Self {
        Self {
            tray_icon: Mutex::new(None),
        }
    }

    pub fn create_tray(&self, app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let app_handle = app.handle().clone();

        // Get current language from settings
        let language =
            crate::settings::Settings::load(&crate::db::ensure_app_dir().unwrap_or_default())
                .map(|s| s.language)
                .unwrap_or_else(|_| "en".to_string());

        // Get localized text
        let texts = self.get_texts(&language);

        let show_i = MenuItem::with_id(&app_handle, "show", texts.show, true, None::<&str>)?;
        let hide_i = MenuItem::with_id(&app_handle, "hide", texts.hide, true, None::<&str>)?;
        let settings_i =
            MenuItem::with_id(&app_handle, "settings", texts.settings, true, None::<&str>)?;
        let quit_i = MenuItem::with_id(&app_handle, "quit", texts.quit, true, None::<&str>)?;

        let menu = Menu::with_items(&app_handle, &[&show_i, &hide_i, &settings_i, &quit_i])?;

        let tray = TrayIconBuilder::new()
            .icon(app_handle.default_window_icon().unwrap().clone())
            .menu(&menu)
            .on_menu_event(
                move |app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("navigate", "/settings");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                },
            )
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::DoubleClick { .. } = event {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            })
            .build(app)?;

        *self.tray_icon.lock().unwrap() = Some(tray);

        Ok(())
    }

    pub fn update_language(
        &self,
        app_handle: &tauri::AppHandle,
        language: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let texts = self.get_texts(language);

        // Recreate menu with new language
        let show_i = MenuItem::with_id(app_handle, "show", texts.show, true, None::<&str>)?;
        let hide_i = MenuItem::with_id(app_handle, "hide", texts.hide, true, None::<&str>)?;
        let settings_i =
            MenuItem::with_id(app_handle, "settings", texts.settings, true, None::<&str>)?;
        let quit_i = MenuItem::with_id(app_handle, "quit", texts.quit, true, None::<&str>)?;

        let menu = Menu::with_items(app_handle, &[&show_i, &hide_i, &settings_i, &quit_i])?;

        if let Some(tray) = self.tray_icon.lock().unwrap().as_ref() {
            tray.set_menu(Some(menu))?;
        }

        Ok(())
    }

    fn get_texts(&self, language: &str) -> TrayTexts {
        // Handle system locale or zh/zh-CN/zh-TW etc.
        let is_chinese = language.starts_with("zh")
            || (language == "system" && Self::get_system_language().starts_with("zh"));

        if is_chinese {
            TrayTexts {
                show: "显示",
                hide: "隐藏",
                settings: "设置",
                quit: "退出",
            }
        } else {
            TrayTexts {
                show: "Show",
                hide: "Hide",
                settings: "Settings",
                quit: "Quit",
            }
        }
    }

    fn get_system_language() -> String {
        sys_locale::get_locale()
            .unwrap_or_else(|| "en".to_string())
            .to_lowercase()
    }
}

struct TrayTexts {
    show: &'static str,
    hide: &'static str,
    settings: &'static str,
    quit: &'static str,
}
