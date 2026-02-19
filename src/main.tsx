import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./i18n";
import App from "./App";
import { InputPanelWindow } from "./pages/InputPanelWindow";

interface SettingsData {
  theme: string;
  accent_color: string;
  language: string;
}

const defaultSettings: SettingsData = {
  theme: "system",
  accent_color: "#6366f1",
  language: "system",
};

const getSystemMode = () => {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark" as const;
  }
  return "light" as const;
};

const createAppTheme = (settings: SettingsData) => {
  const isAcrylicLight = settings.theme === "acrylic-light";
  const isAcrylicDark = settings.theme === "acrylic-dark";
  const isSystem = settings.theme === "system";
  const mode = isSystem
    ? getSystemMode()
    : settings.theme === "dark" || isAcrylicDark
      ? "dark"
      : "light";

  const acrylic = isAcrylicLight || isAcrylicDark;
  const backgroundDefault = acrylic
    ? isAcrylicDark
      ? "rgba(10, 14, 20, 0.72)"
      : "rgba(248, 250, 252, 0.78)"
    : mode === "dark"
      ? "#0b0f19"
      : "#f8fafc";
  const backgroundPaper = acrylic
    ? isAcrylicDark
      ? "rgba(16, 20, 28, 0.76)"
      : "rgba(255, 255, 255, 0.82)"
    : mode === "dark"
      ? "#0f172a"
      : "#ffffff";
  const appBaseBackground = acrylic ? "transparent" : backgroundDefault;
  const scrollbarTrack = acrylic
    ? "rgba(15, 23, 42, 0.25)"
    : mode === "dark"
      ? "rgba(15, 23, 42, 0.6)"
      : "rgba(148, 163, 184, 0.2)";
  const scrollbarThumb = acrylic
    ? "rgba(148, 163, 184, 0.55)"
    : mode === "dark"
      ? "rgba(148, 163, 184, 0.45)"
      : "rgba(71, 85, 105, 0.35)";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: settings.accent_color || "#6366f1",
        light: "#818cf8",
        dark: "#4f46e5",
      },
      secondary: {
        main: "#ec4899",
      },
      background: {
        default: backgroundDefault,
        paper: backgroundPaper,
      },
      grey: {
        50: "#f8fafc",
        100: "#f1f5f9",
        200: "#e2e8f0",
        300: "#cbd5e1",
        400: "#94a3b8",
        500: "#64748b",
        600: "#475569",
        700: "#334155",
        800: "#1e293b",
        900: "#0f172a",
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h6: {
        fontWeight: 600,
      },
      subtitle2: {
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            height: "100%",
            backgroundColor: appBaseBackground,
          },
          body: {
            height: "100%",
            backgroundColor: appBaseBackground,
            backdropFilter: acrylic ? "blur(22px) saturate(120%)" : "none",
            WebkitBackdropFilter: acrylic ? "blur(22px) saturate(120%)" : "none",
          },
          "#root": {
            height: "100%",
            backgroundColor: appBaseBackground,
            backdropFilter: acrylic ? "blur(22px) saturate(120%)" : "none",
            WebkitBackdropFilter: acrylic ? "blur(22px) saturate(120%)" : "none",
          },
          "*": {
            scrollbarColor: `${scrollbarThumb} ${scrollbarTrack}`,
            scrollbarWidth: "thin",
          },
          "*::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
          },
          "*::-webkit-scrollbar-track": {
            backgroundColor: scrollbarTrack,
          },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: scrollbarThumb,
            borderRadius: "6px",
            border: `2px solid ${scrollbarTrack}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 8,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: "none",
            backgroundColor: backgroundPaper,
            backdropFilter: acrylic ? "blur(18px) saturate(120%)" : "none",
            border: acrylic ? "1px solid rgba(148, 163, 184, 0.18)" : "none",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 8,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
    },
  });
};

// Determine which component to render based on window label
const windowLabel = getCurrentWindow().label;

function ThemeRoot() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await invoke<SettingsData>("get_settings");
        setSettings({ ...defaultSettings, ...result });
      } catch (error) {
        console.debug("Failed to load theme settings:", error);
      }
    };

    loadSettings();

    const unlisten = listen<SettingsData>("settings-changed", (event) => {
      setSettings({ ...defaultSettings, ...(event.payload || {}) });
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const theme = useMemo(() => createAppTheme(settings), [settings]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {windowLabel === "input-panel" ? (
        <InputPanelWindow />
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeRoot />
  </React.StrictMode>
);
