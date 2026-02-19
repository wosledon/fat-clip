import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface NotificationSettings {
  show_notifications?: boolean;
}

export function useNotification() {
  const { t } = useTranslation();

  const notify = useCallback(
    async (key: string, params?: Record<string, any>) => {
      try {
        const window = getCurrentWindow();
        const isVisible = await window.isVisible();
        if (isVisible) {
          return;
        }

        const settings = await invoke<NotificationSettings>("get_settings");
        if (settings.show_notifications === false) {
          return;
        }

        const title = t("app.name");
        const body = t(key, params);
        await invoke("show_notification", { title, body });
      } catch (error) {
        console.error("Failed to show notification:", error);
      }
    },
    [t]
  );

  return { notify };
}
