import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

/**
 * Hook for managing main window visibility with consistent toggle behavior
 */
export function useWindowToggle() {
  const [isVisible, setIsVisible] = useState(false);

  /**
   * Toggle the main window visibility
   * @returns true if window was visible (now hidden), false if was hidden (now shown)
   */
  const toggle = useCallback(async (): Promise<boolean> => {
    try {
      const wasVisible = await invoke<boolean>("toggle_main_window");
      setIsVisible(!wasVisible);
      return wasVisible;
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
      setIsVisible(true);
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
      setIsVisible(false);
    } catch (error) {
      console.error("Failed to hide window:", error);
    }
  }, []);

  /**
   * Check current window visibility
   */
  const checkVisibility = useCallback(async () => {
    try {
      const visible = await invoke<boolean>("is_main_window_visible");
      setIsVisible(visible);
      return visible;
    } catch (error) {
      console.error("Failed to check window visibility:", error);
      return false;
    }
  }, []);

  return {
    isVisible,
    toggle,
    show,
    hide,
    checkVisibility,
  };
}
