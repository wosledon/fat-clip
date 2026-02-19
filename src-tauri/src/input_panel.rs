pub struct InputPanelManager;

impl InputPanelManager {
    pub fn new() -> Self {
        InputPanelManager
    }

    #[cfg(target_os = "linux")]
    #[allow(dead_code)]
    pub fn set_display_server(&self, _server: String) {}

    pub fn set_app_handle(&self, _handle: tauri::AppHandle) {}

    pub fn set_enabled(&self, _enabled: bool) {}

    pub fn set_trigger(&self, _trigger: String) {}

    pub fn set_selection_modifier(&self, _modifier: String) {}
}
