import { useState, useEffect, useCallback } from "react";
import { Box, TextField, Chip, Typography } from "@mui/material";
import { Keyboard as KeyboardIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface ShortcutConfig {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

interface ShortcutInputProps {
  value: ShortcutConfig;
  onChange: (shortcut: ShortcutConfig) => void;
  label: string;
  description?: string;
  error?: string;
}

const MODIFIER_KEYS = ["Control", "Alt", "Shift", "Meta", "OS"];
/* const SPECIAL_KEYS = [
  "Enter", "Escape", "Tab", "Backspace", "Delete",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Home", "End", "PageUp", "PageDown",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
  "Space", " ", "/"
]; */

export function ShortcutInput({ value, onChange, label, description, error }: ShortcutInputProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [tempKeys, setTempKeys] = useState<Set<string>>(new Set());

  const formatShortcut = useCallback((config: ShortcutConfig): string => {
    const parts: string[] = [];
    if (config.ctrl) parts.push("Ctrl");
    if (config.alt) parts.push("Alt");
    if (config.shift) parts.push("Shift");
    if (config.meta) parts.push("Meta");
    if (config.key) {
      // Format special keys
      let key = config.key;
      if (key === " ") key = "Space";
      parts.push(key);
    }
    return parts.join(" + ");
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    const key = e.key;

    // If it's a modifier key, just add it to temp keys
    if (MODIFIER_KEYS.includes(key)) {
      setTempKeys(prev => new Set([...prev, key]));
      return;
    }

    // Build the shortcut config
    const newShortcut: ShortcutConfig = {
      key: key === " " ? "Space" : key,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    };

    // Don't allow single modifier keys
    if (MODIFIER_KEYS.includes(key) && !newShortcut.ctrl && !newShortcut.alt && !newShortcut.shift && !newShortcut.meta) {
      return;
    }

    onChange(newShortcut);
    setIsRecording(false);
    setTempKeys(new Set());
  }, [isRecording, onChange]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;

    const key = e.key;
    if (MODIFIER_KEYS.includes(key)) {
      setTempKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown, true);
      window.addEventListener("keyup", handleKeyUp, true);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isRecording, handleKeyDown, handleKeyUp]);

  const displayValue = isRecording 
    ? (tempKeys.size > 0 ? Array.from(tempKeys).join(" + ") + " + ..." : t("settings.shortcuts.pressKeys"))
    : formatShortcut(value);

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      {description && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          {description}
        </Typography>
      )}
      
      <TextField
        fullWidth
        size="small"
        value={displayValue}
        onClick={() => setIsRecording(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsRecording(false);
            setTempKeys(new Set());
          }, 200);
        }}
        InputProps={{
          readOnly: true,
          startAdornment: (
            <KeyboardIcon sx={{ mr: 1, color: isRecording ? "primary.main" : "text.secondary", fontSize: 18 }} />
          ),
          endAdornment: isRecording && (
            <Chip 
              label={t("settings.shortcuts.recording")} 
              color="primary" 
              size="small" 
              sx={{ height: 20, fontSize: "0.7rem" }} 
            />
          ),
          sx: {
            cursor: "pointer",
            bgcolor: isRecording ? "primary.50" : "background.paper",
            borderColor: isRecording ? "primary.main" : undefined,
            fontFamily: "monospace",
            fontSize: "0.9rem",
          }
        }}
        error={!!error}
        helperText={error}
      />
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
        {t("settings.shortcuts.clickToRecord")}
      </Typography>
    </Box>
  );
}

// Convert ShortcutConfig to string format for backend
export function shortcutToString(config: ShortcutConfig): string {
  const parts: string[] = [];
  if (config.ctrl) parts.push("Ctrl");
  if (config.alt) parts.push("Alt");
  if (config.shift) parts.push("Shift");
  if (config.meta) parts.push("Meta");
  if (config.key) parts.push(config.key);
  return parts.join("+");
}

// Parse string format to ShortcutConfig
export function stringToShortcut(str: string): ShortcutConfig {
  const parts = str.split("+");
  return {
    key: parts[parts.length - 1] || "",
    ctrl: parts.includes("Ctrl"),
    alt: parts.includes("Alt"),
    shift: parts.includes("Shift"),
    meta: parts.includes("Meta") || parts.includes("Cmd") || parts.includes("Super"),
  };
}

// Default shortcuts
export const DEFAULT_SHORTCUTS = {
  toggle_window: { key: "V", ctrl: true, alt: false, shift: true, meta: false },
  focus_search: { key: "/", ctrl: false, alt: false, shift: false, meta: false },
  navigate_up: { key: "ArrowUp", ctrl: false, alt: false, shift: false, meta: false },
  navigate_down: { key: "ArrowDown", ctrl: false, alt: false, shift: false, meta: false },
  expand_item: { key: "Space", ctrl: false, alt: false, shift: false, meta: false },
  copy_selected: { key: "Enter", ctrl: false, alt: false, shift: false, meta: false },
  pin_selected: { key: "P", ctrl: false, alt: false, shift: false, meta: false },
  delete_selected: { key: "Delete", ctrl: false, alt: false, shift: false, meta: false },
  open_tags: { key: "T", ctrl: false, alt: false, shift: false, meta: false },
  close_window: { key: "Escape", ctrl: false, alt: false, shift: false, meta: false },
};

export type ShortcutsConfig = typeof DEFAULT_SHORTCUTS;
