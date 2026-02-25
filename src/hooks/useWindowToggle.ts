import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

/**
 * Hook for managing main window visibility with consistent toggle behavior
 * Note: Does not track actual window state - use checkVisibility() to get current state
 */
export function useWindowToggle() {
  /**
   * Toggle the main window visibility
   * @returns true if window was visible (now hidden), false if was hidden (now shown)
   */
  const toggle = useCallback(async (): Promise<boolean> => {
    try {
      return await invoke<boolean>("toggle_main_window");
    } catch (error) {
      console.error("Failed to toggle window:", error);
      return false;
    }
  }, []);

  /**
   * Show the main window
   */
  const show = useCallback(async () => {
    try {
      await invoke("show_main_window");
    } catch (error) {
      console.error("Failed to show window:", error);
    }
  }, []);

  /**
   * Hide the main window
   */
  const hide = useCallback(async () => {
    try {
      await invoke("hide_main_window");
    } catch (error) {
      console.error("Failed to hide window:", error);
    }
  }, []);

  /**
   * Check current window visibility
   */
  const checkVisibility = useCallback(async () => {
    try {
      return await invoke<boolean>("is_main_window_visible");
    } catch (error) {
      console.error("Failed to check window visibility:", error);
      return false;
    }
  }, []);

  return {
    toggle,
    show,
    hide,
    checkVisibility,
  };
}
