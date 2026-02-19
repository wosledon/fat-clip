import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ShortcutConfig {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface ShortcutsConfig {
  toggle_window: ShortcutConfig;
  focus_search: ShortcutConfig;
  navigate_up: ShortcutConfig;
  navigate_down: ShortcutConfig;
  expand_item: ShortcutConfig;
  copy_selected: ShortcutConfig;
  pin_selected: ShortcutConfig;
  delete_selected: ShortcutConfig;
  open_tags: ShortcutConfig;
  close_window: ShortcutConfig;
}

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
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

// Convert shortcut config to a string for comparison
export function shortcutToString(config: ShortcutConfig): string {
  const parts: string[] = [];
  if (config.ctrl) parts.push("Ctrl");
  if (config.alt) parts.push("Alt");
  if (config.shift) parts.push("Shift");
  if (config.meta) parts.push("Meta");
  parts.push(config.key);
  return parts.join("+");
}

// Check if a keyboard event matches a shortcut config
export function matchesShortcut(e: KeyboardEvent, config: ShortcutConfig): boolean {
  // Handle special case for Space key
  const eventKey = e.key === " " ? "Space" : e.key;
  const configKey = config.key === " " ? "Space" : config.key;
  
  return (
    eventKey === configKey &&
    e.ctrlKey === config.ctrl &&
    e.altKey === config.alt &&
    e.shiftKey === config.shift &&
    e.metaKey === config.meta
  );
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutsConfig>(DEFAULT_SHORTCUTS);

  useEffect(() => {
    // Load shortcuts from backend
    const loadShortcuts = async () => {
      try {
        const settings = await invoke<{ shortcuts: ShortcutsConfig }>("get_settings");
        if (settings.shortcuts) {
          setShortcuts(settings.shortcuts);
        }
      } catch (error) {
        console.error("Failed to load shortcuts:", error);
      }
    };

    loadShortcuts();

    // Listen for shortcut changes
    const unlisten = listen("shortcuts-changed", () => {
      loadShortcuts();
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleShortcut = useCallback((
    e: KeyboardEvent,
    handlers: Partial<Record<keyof ShortcutsConfig, () => void>>
  ): boolean => {
    for (const [action, handler] of Object.entries(handlers)) {
      if (handler && matchesShortcut(e, shortcuts[action as keyof ShortcutsConfig])) {
        e.preventDefault();
        handler();
        return true;
      }
    }
    return false;
  }, [shortcuts]);

  return { shortcuts, handleShortcut };
}
