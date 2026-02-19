import { useState, useEffect } from "react";
import { type } from "@tauri-apps/plugin-os";

export function usePlatform() {
  const [platform, setPlatform] = useState<string>("unknown");

  useEffect(() => {
    const detectPlatform = async () => {
      try {
        const osType = await type();
        setPlatform(osType);
      } catch {
        // Fallback to user agent
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes("win")) setPlatform("windows");
        else if (userAgent.includes("mac")) setPlatform("macos");
        else if (userAgent.includes("linux")) setPlatform("linux");
        else setPlatform("unknown");
      }
    };

    detectPlatform();
  }, []);

  return {
    platform,
    isWindows: platform === "windows",
    isMacOS: platform === "macos",
    isLinux: platform === "linux",
  };
}
