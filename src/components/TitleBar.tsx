
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Box, IconButton, Typography } from "@mui/material";
import {
  Close as CloseIcon,
  Remove as MinimizeIcon,
} from "@mui/icons-material";

interface TitleBarProps {
  title?: string;
}

export function TitleBar({ title = "Fat Clip" }: TitleBarProps) {
  

  const handleMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleClose = async () => {
    // Hide to tray instead of close
    await invoke("hide_main_window");
  };

  return (
    <Box
      data-tauri-drag-region
      
      sx={{
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        cursor: "default",
        WebkitAppRegion: "drag",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, WebkitAppRegion: "no-drag" }}>
        <Box
          component="img"
          src="/app-icon.svg"
          alt="Fat Clip"
          sx={{ width: 18, height: 18, borderRadius: 0.5 }}
        />
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary" }}>
          {title}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 0.5, WebkitAppRegion: "no-drag" }}>
        <IconButton
          size="small"
          onClick={handleMinimize}
          sx={{
            width: 28,
            height: 28,
            color: "text.secondary",
            "&:hover": { bgcolor: "action.hover", color: "text.primary" },
          }}
        >
          <MinimizeIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{
            width: 28,
            height: 28,
            color: "text.secondary",
            "&:hover": { bgcolor: "error.main", color: "error.contrastText" },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
