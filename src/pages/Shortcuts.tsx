import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Divider,
  Grid,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Keyboard as KeyboardIcon,
} from "@mui/icons-material";
import { ShortcutInput, ShortcutsConfig, DEFAULT_SHORTCUTS } from "../components/ShortcutInput";

interface SettingsData {
  shortcuts: ShortcutsConfig;
}

export function Shortcuts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [shortcuts, setShortcuts] = useState<ShortcutsConfig>(DEFAULT_SHORTCUTS);
  const [originalShortcuts, setOriginalShortcuts] = useState<ShortcutsConfig>(DEFAULT_SHORTCUTS);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await invoke<SettingsData>("get_settings");
      if (result.shortcuts) {
        setShortcuts(result.shortcuts);
        setOriginalShortcuts(result.shortcuts);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleShortcutChange = (key: keyof ShortcutsConfig, value: any) => {
    const newShortcuts = { ...shortcuts, [key]: value };
    setShortcuts(newShortcuts);
    checkConflicts(newShortcuts);
    setHasChanges(JSON.stringify(newShortcuts) !== JSON.stringify(originalShortcuts));
  };

  const checkConflicts = async (newShortcuts: ShortcutsConfig) => {
    try {
      const result = await invoke<string[]>("validate_shortcuts", { 
        settings: { shortcuts: newShortcuts } 
      });
      setConflicts(result);
    } catch (error) {
      console.error("Failed to validate shortcuts:", error);
    }
  };

  const handleSave = async () => {
    if (conflicts.length > 0) return;
    
    try {
      const currentSettings = await invoke<SettingsData>("get_settings");
      await invoke("save_settings", {
        settings: { ...currentSettings, shortcuts }
      });
      setOriginalShortcuts(shortcuts);
      setHasChanges(false);
      setShowSaved(true);
    } catch (error) {
      console.error("Failed to save shortcuts:", error);
    }
  };

  const handleReset = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    checkConflicts(DEFAULT_SHORTCUTS);
    setHasChanges(true);
  };

  // Use translation keys for shortcut descriptions
  const shortcutDescriptions: Record<keyof ShortcutsConfig, { labelKey: string; descKey: string }> = {
    toggle_window: {
      labelKey: "settings.shortcuts.toggleWindow.label",
      descKey: "settings.shortcuts.toggleWindow.desc"
    },
    focus_search: {
      labelKey: "settings.shortcuts.focusSearch.label",
      descKey: "settings.shortcuts.focusSearch.desc"
    },
    navigate_up: {
      labelKey: "settings.shortcuts.navigateUp.label",
      descKey: "settings.shortcuts.navigateUp.desc"
    },
    navigate_down: {
      labelKey: "settings.shortcuts.navigateDown.label",
      descKey: "settings.shortcuts.navigateDown.desc"
    },
    expand_item: {
      labelKey: "settings.shortcuts.expandItem.label",
      descKey: "settings.shortcuts.expandItem.desc"
    },
    copy_selected: {
      labelKey: "settings.shortcuts.copySelected.label",
      descKey: "settings.shortcuts.copySelected.desc"
    },
    pin_selected: {
      labelKey: "settings.shortcuts.pinSelected.label",
      descKey: "settings.shortcuts.pinSelected.desc"
    },
    delete_selected: {
      labelKey: "settings.shortcuts.deleteSelected.label",
      descKey: "settings.shortcuts.deleteSelected.desc"
    },
    open_tags: {
      labelKey: "settings.shortcuts.openTags.label",
      descKey: "settings.shortcuts.openTags.desc"
    },
    close_window: {
      labelKey: "settings.shortcuts.closeWindow.label",
      descKey: "settings.shortcuts.closeWindow.desc"
    },
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 0, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title={t("common.back")}>
            <IconButton onClick={() => navigate("/settings")} size="small">
              <BackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <KeyboardIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            {t("settings.shortcuts.pageTitle")}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={handleReset}
            size="small"
            sx={{ mr: 1 }}
          >
            {t("settings.shortcuts.resetToDefault")}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || conflicts.length > 0}
            size="small"
          >
            {t("settings.shortcuts.saveChanges")}
          </Button>
        </Box>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
        <Box sx={{ maxWidth: 800, mx: "auto" }}>
          {/* Global Shortcut Warning */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>{t("settings.shortcuts.toggleWindow.label")}</strong> {t("settings.shortcuts.globalShortcutsDesc")}
          </Alert>

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("settings.shortcuts.conflicts")}
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {conflicts.map((conflict, index) => (
                  <li key={index}>{conflict}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Global Shortcuts Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("settings.shortcuts.globalShortcuts")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.shortcuts.globalShortcutsDesc")}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <ShortcutInput
              value={shortcuts.toggle_window}
              onChange={(value) => handleShortcutChange("toggle_window", value)}
              label={t(shortcutDescriptions.toggle_window.labelKey)}
              description={t(shortcutDescriptions.toggle_window.descKey)}
            />
          </Paper>

          {/* Navigation Shortcuts */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("settings.shortcuts.navigation")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.shortcuts.navigationDesc")}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.focus_search}
                  onChange={(value) => handleShortcutChange("focus_search", value)}
                  label={t(shortcutDescriptions.focus_search.labelKey)}
                  description={t(shortcutDescriptions.focus_search.descKey)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.navigate_up}
                  onChange={(value) => handleShortcutChange("navigate_up", value)}
                  label={t(shortcutDescriptions.navigate_up.labelKey)}
                  description={t(shortcutDescriptions.navigate_up.descKey)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.navigate_down}
                  onChange={(value) => handleShortcutChange("navigate_down", value)}
                  label={t(shortcutDescriptions.navigate_down.labelKey)}
                  description={t(shortcutDescriptions.navigate_down.descKey)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.expand_item}
                  onChange={(value) => handleShortcutChange("expand_item", value)}
                  label={t(shortcutDescriptions.expand_item.labelKey)}
                  description={t(shortcutDescriptions.expand_item.descKey)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Action Shortcuts */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("settings.shortcuts.actions")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.shortcuts.actionsDesc")}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.copy_selected}
                  onChange={(value) => handleShortcutChange("copy_selected", value)}
                  label={t(shortcutDescriptions.copy_selected.labelKey)}
                  description={t(shortcutDescriptions.copy_selected.descKey)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.pin_selected}
                  onChange={(value) => handleShortcutChange("pin_selected", value)}
                  label={t(shortcutDescriptions.pin_selected.labelKey)}
                  description={t(shortcutDescriptions.pin_selected.descKey)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.delete_selected}
                  onChange={(value) => handleShortcutChange("delete_selected", value)}
                  label={t(shortcutDescriptions.delete_selected.labelKey)}
                  description={t(shortcutDescriptions.delete_selected.descKey)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ShortcutInput
                  value={shortcuts.open_tags}
                  onChange={(value) => handleShortcutChange("open_tags", value)}
                  label={t(shortcutDescriptions.open_tags.labelKey)}
                  description={t(shortcutDescriptions.open_tags.descKey)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* System Shortcuts */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {t("settings.shortcuts.system")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.shortcuts.systemDesc")}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <ShortcutInput
              value={shortcuts.close_window}
              onChange={(value) => handleShortcutChange("close_window", value)}
              label={t(shortcutDescriptions.close_window.labelKey)}
              description={t(shortcutDescriptions.close_window.descKey)}
            />
          </Paper>

          {/* Number Keys Note */}
          <Alert severity="info" sx={{ mt: 3 }}>
            <strong>{t("common.note")}:</strong> {t("settings.shortcuts.numberKeysNote")}
          </Alert>
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
          {t("settings.shortcuts.saved")}
        </Alert>
      </Snackbar>
    </Box>
  );
}
