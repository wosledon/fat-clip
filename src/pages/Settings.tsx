import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Paper,
  TextField,

  Switch,
  FormControlLabel,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Restore as ResetIcon,
  Settings as SettingsIcon,
  Keyboard as KeyboardIcon,
  Palette as PaletteIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Window as WindowIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { languages } from "../i18n";
import { usePlatform } from "../hooks/usePlatform";

// Admin status component for Windows
function AdminStatus() {
  const { t } = useTranslation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const result = await invoke<boolean>("is_running_as_admin");
      setIsAdmin(result);
    } catch (error) {
      console.error("Failed to check admin status:", error);
      setIsAdmin(false);
    }
  };

  const handleRestartAsAdmin = async () => {
    try {
      setRestarting(true);
      await invoke("restart_as_admin");
    } catch (error) {
      console.error("Failed to restart as admin:", error);
      setRestarting(false);
    }
  };

  if (isAdmin === null) {
    return (
      <Typography variant="caption" color="text.secondary">
        {t("settings.experimental.admin.checking")}
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Typography
        variant="caption"
        color={isAdmin ? "success.main" : "warning.main"}
        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
      >
        {isAdmin
          ? t("settings.experimental.admin.running")
          : t("settings.experimental.admin.notRunning")}
      </Typography>
      {!isAdmin && (
        <Button
          variant="outlined"
          size="small"
          onClick={handleRestartAsAdmin}
          disabled={restarting}
          sx={{ mt: 1, display: "block" }}
        >
          {restarting
            ? t("settings.experimental.admin.restarting")
            : t("settings.experimental.admin.restart")}
        </Button>
      )}
    </Box>
  );
}

interface SettingsData {
  autostart_enabled: boolean;
  show_on_startup: boolean;
  start_minimized: boolean;
  global_shortcut: string;
  theme: string;
  accent_color: string;
  language: string;
  max_history_items: number;
  auto_cleanup_days: number | null;
  paste_on_select: boolean;
  show_notifications: boolean;
  always_on_top: boolean;
  enable_input_panel: boolean;
  input_panel_trigger: string;
  input_panel_selection_modifier: "ctrl" | "alt";
  timeline_mode: "standard" | "compact" | "off";
  linux_display_server?: string;
  run_as_administrator?: boolean;
}

const defaultSettings: SettingsData = {
  autostart_enabled: false,
  show_on_startup: true,
  start_minimized: false,
  global_shortcut: "Ctrl+Shift+V",
  theme: "system",
  accent_color: "#6366f1",
  language: "system",
  max_history_items: 1000,
  auto_cleanup_days: 30,
  paste_on_select: false,
  show_notifications: true,
  always_on_top: true,
  enable_input_panel: false,
  input_panel_trigger: "/v",
  input_panel_selection_modifier: "ctrl",
  timeline_mode: "standard",
  linux_display_server: "auto",
  run_as_administrator: false,
};

export function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isLinux, isWindows } = usePlatform();
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [, setShortcutError] = useState("");
  const [cleanupMode, setCleanupMode] = useState<"range" | "before" | "older_than">("older_than");
  const [cleanupStartDate, setCleanupStartDate] = useState("");
  const [cleanupEndDate, setCleanupEndDate] = useState("");
  const [cleanupBeforeDate, setCleanupBeforeDate] = useState("");
  const [cleanupOlderThanDays, setCleanupOlderThanDays] = useState("30");
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<number | null>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [showCleanupToast, setShowCleanupToast] = useState(false);

  useEffect(() => {
    loadSettings();

    const unlisten = listen<string>("navigate", (event) => {
      if (event.payload === "/settings") {
        navigate("/settings");
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [navigate]);

  const loadSettings = async () => {
    try {
      const result = await invoke<SettingsData>("get_settings");
      const normalized = {
        ...result,
        enable_input_panel: false,
      };
      setSettings(normalized);
      setOriginalSettings(normalized);
      
      // Apply language
      const lang = result.language === "system" ? navigator.language.split("-")[0] : result.language;
      i18n.changeLanguage(lang);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleChange = (field: keyof SettingsData, value: any) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
    
    if (field === "global_shortcut") {
      setShortcutError("");
    }
    
    // Apply language immediately for preview
    if (field === "language") {
      const lang = value === "system" ? navigator.language.split("-")[0] : value;
      i18n.changeLanguage(lang);
    }
  };

  const handleSave = async () => {
    try {
      const settingsToSave = {
        ...originalSettings,
        ...settings,
        enable_input_panel: false,
      };
      await invoke("save_settings", { settings: settingsToSave });
      setSettings(settingsToSave);
      setOriginalSettings(settingsToSave);
      setHasChanges(false);
      setShowSaved(true);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveError(String(error));
      setShowSaveError(true);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
    i18n.changeLanguage(navigator.language.split("-")[0]);
  };

  const isCleanupValid = () => {
    if (cleanupMode === "range") {
      return Boolean(cleanupStartDate && cleanupEndDate);
    }
    if (cleanupMode === "before") {
      return Boolean(cleanupBeforeDate);
    }
    return Boolean(parseInt(cleanupOlderThanDays, 10) > 0);
  };

  const handleCleanup = async () => {
    if (!isCleanupValid()) return;
    setCleanupRunning(true);
    setCleanupError("");
    try {
      const request = {
        mode: cleanupMode,
        start_date: cleanupMode === "range" ? cleanupStartDate : null,
        end_date: cleanupMode === "range" ? cleanupEndDate : null,
        before_date: cleanupMode === "before" ? cleanupBeforeDate : null,
        older_than_days:
          cleanupMode === "older_than" ? parseInt(cleanupOlderThanDays, 10) : null,
      };
      const deleted = await invoke<number>("cleanup_clips", { request });
      setCleanupResult(deleted);
      setShowCleanupToast(true);
    } catch (error) {
      setCleanupError(String(error));
    } finally {
      setCleanupRunning(false);
    }
  };

  /* const validateShortcut = (shortcut: string): boolean => {
    const parts = shortcut.split("+");
    if (parts.length < 2) {
      setShortcutError(t("settings.shortcuts.shortcutError"));
      return false;
    }
    
    const modifiers = ["Ctrl", "Alt", "Shift", "Cmd", "Super"];
    const hasModifier = parts.slice(0, -1).some((p) => 
      modifiers.some((m) => p.trim().toLowerCase() === m.toLowerCase())
    );
    
    if (!hasModifier) {
      setShortcutError(t("settings.shortcuts.shortcutError"));
      return false;
    }
    
    return true;
  }; */

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 0, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title={t("common.back")}>
            <IconButton onClick={() => navigate("/")} size="small">
              <BackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <SettingsIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            {t("settings.title")}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ResetIcon />}
            onClick={handleReset}
            size="small"
            sx={{ mr: 1 }}
          >
            {t("settings.reset")}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges}
            size="small"
          >
            {t("settings.saveChanges")}
          </Button>
        </Box>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        <Box sx={{ maxWidth: 700, mx: "auto" }}>
          {/* General Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <InfoIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">{t("settings.general.title")}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.autostart_enabled}
                    onChange={(e) => handleChange("autostart_enabled", e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{t("settings.general.autostart")}</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.show_on_startup}
                    onChange={(e) => handleChange("show_on_startup", e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{t("settings.general.showOnStartup")}</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.start_minimized}
                    onChange={(e) => handleChange("start_minimized", e.target.checked)}
                    disabled={!settings.show_on_startup}
                  />
                }
                label={<Typography variant="body2">{t("settings.general.startMinimized")}</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={settings.show_notifications}
                    onChange={(e) => handleChange("show_notifications", e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{t("settings.general.showNotifications")}</Typography>}
              />
            </Box>
          </Paper>

          {/* Window Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <WindowIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">{t("settings.window.title")}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.always_on_top}
                  onChange={(e) => handleChange("always_on_top", e.target.checked)}
                />
              }
              label={<Typography variant="body2">{t("settings.window.alwaysOnTop")}</Typography>}
            />
          </Paper>

          {/* Experimental Features Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <Typography variant="subtitle2" color="warning.main">🧪 {t("settings.experimental.title")}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary">
              {t("settings.experimental.enableInputPanel")}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {t("settings.experimental.disabledNotice")}
            </Typography>
            
            {/* Linux Display Server Selection */}
            {isLinux && (
              <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                <InputLabel>{t("settings.experimental.displayServer")}</InputLabel>
                <Select
                  value={settings.linux_display_server || "auto"}
                  onChange={(e) => handleChange("linux_display_server", e.target.value)}
                  label={t("settings.experimental.displayServer")}
                >
                  <MenuItem value="auto">{t("settings.experimental.displayServerAuto")}</MenuItem>
                  <MenuItem value="x11">{t("settings.experimental.displayServerX11")}</MenuItem>
                  <MenuItem value="wayland">{t("settings.experimental.displayServerWayland")}</MenuItem>
                </Select>
              </FormControl>
            )}
            
            {/* Windows Administrator Mode */}
            {isWindows && (
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={settings.run_as_administrator || false}
                      onChange={(e) => handleChange("run_as_administrator", e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{t("settings.experimental.admin.title")}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t("settings.experimental.admin.description")}
                      </Typography>
                    </Box>
                  }
                />
                <AdminStatus />
              </Box>
            )}
          </Paper>

          {/* Shortcuts Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <KeyboardIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">{t("settings.shortcuts.title")}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {/* Keyboard Shortcuts Button */}
            <Paper
              variant="outlined"
              onClick={() => navigate("/shortcuts")}
              sx={{
                p: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t("settings.shortcuts.configure")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("settings.shortcuts.configureDescription")}
                </Typography>
              </Box>
              <ChevronRightIcon color="action" />
            </Paper>
          </Paper>

          {/* Appearance Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <PaletteIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">{t("settings.appearance.title")}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{t("settings.appearance.theme")}</InputLabel>
              <Select
                value={settings.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
                label={t("settings.appearance.theme")}
              >
                <MenuItem value="light">{t("settings.appearance.themeLight")}</MenuItem>
                <MenuItem value="dark">{t("settings.appearance.themeDark")}</MenuItem>
                <MenuItem value="acrylic-light">{t("settings.appearance.themeAcrylicLight")}</MenuItem>
                <MenuItem value="acrylic-dark">{t("settings.appearance.themeAcrylicDark")}</MenuItem>
                <MenuItem value="system">{t("settings.appearance.themeSystem")}</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{t("settings.appearance.language")}</InputLabel>
              <Select
                value={settings.language}
                onChange={(e) => handleChange("language", e.target.value)}
                label={t("settings.appearance.language")}
              >
                <MenuItem value="system">System</MenuItem>
                {languages.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" gutterBottom>
              {t("settings.appearance.accentColor")}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {["#6366f1", "#ec4899", "#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444", "#3b82f6"].map(
                (color) => (
                  <Box
                    key={color}
                    onClick={() => handleChange("accent_color", color)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      bgcolor: color,
                      cursor: "pointer",
                      border: settings.accent_color === color ? "2px solid #000" : "2px solid transparent",
                      transition: "transform 0.2s",
                      "&:hover": { transform: "scale(1.1)" },
                    }}
                  />
                )
              )}
            </Box>

            <FormControl fullWidth size="small" sx={{ mt: 2 }}>
              <InputLabel>{t("settings.appearance.timelineMode")}</InputLabel>
              <Select
                value={settings.timeline_mode}
                onChange={(e) => handleChange("timeline_mode", e.target.value)}
                label={t("settings.appearance.timelineMode")}
              >
                <MenuItem value="standard">{t("settings.appearance.timelineStandard")}</MenuItem>
                <MenuItem value="compact">{t("settings.appearance.timelineCompact")}</MenuItem>
                <MenuItem value="off">{t("settings.appearance.timelineOff")}</MenuItem>
              </Select>
            </FormControl>
          </Paper>

          {/* Storage Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <StorageIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">{t("settings.storage.title")}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" gutterBottom>
              {t("settings.storage.maxItems")}: {settings.max_history_items}
            </Typography>
            <Slider
              value={settings.max_history_items}
              onChange={(_, value) => handleChange("max_history_items", value)}
              min={100}
              max={10000}
              step={100}
              marks={[
                { value: 100, label: "100" },
                { value: 5000, label: "5K" },
                { value: 10000, label: "10K" },
              ]}
              valueLabelDisplay="auto"
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth size="small">
              <InputLabel>{t("settings.storage.autoCleanup")}</InputLabel>
              <Select
                value={settings.auto_cleanup_days?.toString() || "never"}
                onChange={(e) => {
                  const value = e.target.value;
                  handleChange("auto_cleanup_days", value === "never" ? null : parseInt(value));
                }}
                label={t("settings.storage.autoCleanup")}
              >
                <MenuItem value="never">{t("settings.storage.cleanupNever")}</MenuItem>
                <MenuItem value="7">{t("settings.storage.cleanup7Days")}</MenuItem>
                <MenuItem value="14">{t("settings.storage.cleanup14Days")}</MenuItem>
                <MenuItem value="30">{t("settings.storage.cleanup30Days")}</MenuItem>
                <MenuItem value="90">{t("settings.storage.cleanup90Days")}</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t("settings.storage.manualCleanup")}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {t("settings.storage.manualCleanupDesc")}
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>{t("settings.storage.cleanupMode")}</InputLabel>
              <Select
                value={cleanupMode}
                onChange={(e) => setCleanupMode(e.target.value as "range" | "before" | "older_than")}
                label={t("settings.storage.cleanupMode")}
              >
                <MenuItem value="range">{t("settings.storage.cleanupModeRange")}</MenuItem>
                <MenuItem value="before">{t("settings.storage.cleanupModeBefore")}</MenuItem>
                <MenuItem value="older_than">{t("settings.storage.cleanupModeOlderThan")}</MenuItem>
              </Select>
            </FormControl>

            {cleanupMode === "range" && (
              <Box sx={{ display: "grid", gap: 1, mb: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t("settings.storage.cleanupStartDate")}
                  value={cleanupStartDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCleanupStartDate(e.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t("settings.storage.cleanupEndDate")}
                  value={cleanupEndDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCleanupEndDate(e.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}

            {cleanupMode === "before" && (
              <TextField
                fullWidth
                size="small"
                type="date"
                label={t("settings.storage.cleanupBeforeDate")}
                value={cleanupBeforeDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCleanupBeforeDate(e.target.value)
                }
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 1.5 }}
              />
            )}

            {cleanupMode === "older_than" && (
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t("settings.storage.cleanupOlderThanDays")}
                value={cleanupOlderThanDays}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCleanupOlderThanDays(e.target.value)
                }
                inputProps={{ min: 1 }}
                sx={{ mb: 1.5 }}
              />
            )}

            {cleanupError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {t("settings.storage.cleanupError")}
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={handleCleanup}
              disabled={!isCleanupValid() || cleanupRunning}
              size="medium"
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {t("settings.storage.cleanupAction")}
            </Button>
          </Paper>
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={showSaved}
        autoHideDuration={2000}
        onClose={() => setShowSaved(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setShowSaved(false)} sx={{ py: 0.5 }}>
          {t("settings.saved")}
        </Alert>
      </Snackbar>

      <Snackbar
        open={showSaveError}
        autoHideDuration={3000}
        onClose={() => setShowSaveError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setShowSaveError(false)} sx={{ py: 0.5 }}>
          {saveError || t("settings.saveFailed")}
        </Alert>
      </Snackbar>

      <Snackbar
        open={showCleanupToast}
        autoHideDuration={2000}
        onClose={() => setShowCleanupToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setShowCleanupToast(false)} sx={{ py: 0.5 }}>
          {t("settings.storage.cleanupSuccess", { count: cleanupResult ?? 0 })}
        </Alert>
      </Snackbar>
    </Box>
  );
}
