use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn default_input_panel_selection_modifier() -> String {
    "ctrl".to_string()
}

fn default_timeline_mode() -> String {
    "standard".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub key: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool, // Cmd on macOS, Windows key on Windows
}

impl std::fmt::Display for ShortcutConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut parts = Vec::new();
        if self.ctrl {
            parts.push("Ctrl");
        }
        if self.alt {
            parts.push("Alt");
        }
        if self.shift {
            parts.push("Shift");
        }
        if self.meta {
            parts.push("Meta");
        }
        parts.push(&self.key);
        write!(f, "{}", parts.join("+"))
    }
}

impl ShortcutConfig {
    pub fn to_config_string(&self) -> String {
        self.to_string()
    }

    pub fn default_global() -> Self {
        ShortcutConfig {
            key: "V".to_string(),
            ctrl: true,
            alt: false,
            shift: true,
            meta: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shortcuts {
    // Global shortcuts
    pub toggle_window: ShortcutConfig,

    // Navigation shortcuts (local, when window is focused)
    pub focus_search: ShortcutConfig,
    pub navigate_up: ShortcutConfig,
    pub navigate_down: ShortcutConfig,
    pub expand_item: ShortcutConfig,
    pub copy_selected: ShortcutConfig,
    pub pin_selected: ShortcutConfig,
    pub delete_selected: ShortcutConfig,
    pub open_tags: ShortcutConfig,
    pub close_window: ShortcutConfig,
    // Number keys for items 1-9 (hardcoded, not configurable)
    // These are handled separately
}

impl Default for Shortcuts {
    fn default() -> Self {
        Shortcuts {
            toggle_window: ShortcutConfig::default_global(),
            focus_search: ShortcutConfig {
                key: "/".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            navigate_up: ShortcutConfig {
                key: "ArrowUp".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            navigate_down: ShortcutConfig {
                key: "ArrowDown".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            expand_item: ShortcutConfig {
                key: " ".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            copy_selected: ShortcutConfig {
                key: "Enter".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            pin_selected: ShortcutConfig {
                key: "P".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            delete_selected: ShortcutConfig {
                key: "Delete".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            open_tags: ShortcutConfig {
                key: "T".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
            close_window: ShortcutConfig {
                key: "Escape".to_string(),
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    // General
    pub autostart_enabled: bool,
    pub show_on_startup: bool,
    pub start_minimized: bool,

    // Shortcuts
    pub shortcuts: Shortcuts,

    // Appearance
    pub theme: String,
    pub accent_color: String,
    pub language: String,

    // Storage
    pub max_history_items: i64,
    pub auto_cleanup_days: Option<i64>,

    // Behavior
    pub paste_on_select: bool,
    pub show_notifications: bool,

    // Window
    pub always_on_top: bool,

    // Display
    pub display_mode: String,
    #[serde(default = "default_timeline_mode")]
    pub timeline_mode: String,

    // Experimental features
    pub enable_input_panel: bool,
    pub input_panel_trigger: String,
    #[serde(default = "default_input_panel_selection_modifier")]
    pub input_panel_selection_modifier: String,

    // Linux specific
    #[cfg(target_os = "linux")]
    pub linux_display_server: String, // "auto", "x11", "wayland"

    // Windows specific
    #[cfg(windows)]
    pub run_as_administrator: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            autostart_enabled: false,
            show_on_startup: true,
            start_minimized: false,
            shortcuts: Shortcuts::default(),
            theme: "system".to_string(),
            accent_color: "#6366f1".to_string(),
            language: "system".to_string(),
            max_history_items: 1000,
            auto_cleanup_days: Some(30),
            paste_on_select: false,
            show_notifications: true,
            always_on_top: true,
            display_mode: "compact".to_string(),
            timeline_mode: default_timeline_mode(),
            enable_input_panel: false,
            input_panel_trigger: "/v".to_string(),
            input_panel_selection_modifier: default_input_panel_selection_modifier(),
            #[cfg(target_os = "linux")]
            linux_display_server: "auto".to_string(),
            #[cfg(windows)]
            run_as_administrator: false,
        }
    }
}

impl Settings {
    pub fn load(app_dir: &PathBuf) -> Result<Self, String> {
        let settings_path = app_dir.join("settings.json");
        if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
            let mut settings: Settings =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;
            settings.enable_input_panel = false;
            Ok(settings)
        } else {
            let settings = Settings::default();
            settings.save_to(app_dir)?;
            Ok(settings)
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let app_dir = crate::db::ensure_app_dir().map_err(|e| e.to_string())?;
        self.save_to(&app_dir)
    }

    fn save_to(&self, app_dir: &PathBuf) -> Result<(), String> {
        std::fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;
        let settings_path = app_dir.join("settings.json");
        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&settings_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Validate shortcuts for conflicts
    pub fn validate_shortcuts(&self) -> Vec<String> {
        let mut conflicts = Vec::new();
        let shortcut_list = vec![
            ("toggle_window", &self.shortcuts.toggle_window),
            ("focus_search", &self.shortcuts.focus_search),
            ("navigate_up", &self.shortcuts.navigate_up),
            ("navigate_down", &self.shortcuts.navigate_down),
            ("expand_item", &self.shortcuts.expand_item),
            ("copy_selected", &self.shortcuts.copy_selected),
            ("pin_selected", &self.shortcuts.pin_selected),
            ("delete_selected", &self.shortcuts.delete_selected),
            ("open_tags", &self.shortcuts.open_tags),
            ("close_window", &self.shortcuts.close_window),
        ];

        for (i, (name1, shortcut1)) in shortcut_list.iter().enumerate() {
            for (name2, shortcut2) in shortcut_list.iter().skip(i + 1) {
                if shortcut1.to_config_string() == shortcut2.to_config_string() {
                    conflicts.push(format!("{} conflicts with {}", name1, name2));
                }
            }
        }

        conflicts
    }
}
