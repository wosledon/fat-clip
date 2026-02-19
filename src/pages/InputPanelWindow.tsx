import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  ListItem,
  ListItemButton,
  Typography,
  Chip,
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
} from "@mui/icons-material";

interface ClipItem {
  id: string;
  content_type: "Plain" | "Rich" | "Image" | "File";
  content: string;
  preview_text: string;
  tags: string[];
  pinned: boolean;
}

interface InputPanelShowPayload {
  query?: string;
  triggerLen?: number;
  selectionModifier?: string;
}

interface InputPanelSelectPayload {
  index?: number;
  searchLen?: number;
}

interface NotificationSettings {
  show_notifications?: boolean;
}

interface InputPanelSettings {
  input_panel_selection_modifier?: string;
}

export function InputPanelWindow() {
  const { t } = useTranslation();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [filteredClips, setFilteredClips] = useState<ClipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [triggerLen, setTriggerLen] = useState(2);
  const [selectionModifier, setSelectionModifier] = useState<"ctrl" | "alt">("ctrl");
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filteredClipsRef = useRef<ClipItem[]>([]);
  const searchQueryRef = useRef("");
  const window = getCurrentWindow();

  useEffect(() => {
    filteredClipsRef.current = filteredClips;
  }, [filteredClips]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const filterClips = useCallback((query: string, items: ClipItem[]) => {
    if (!query.trim()) {
      setFilteredClips(items);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = items.filter(
      (clip) =>
        clip.content.toLowerCase().includes(lowerQuery) ||
        clip.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
    setFilteredClips(filtered);
  }, []);

  const loadClips = useCallback(async () => {
    try {
      const result = await invoke<ClipItem[]>("get_recent_clips", { limit: 50 });
      setClips(result);
      filterClips(searchQueryRef.current, result);
      setLoadError(null);
    } catch (error) {
      console.error("Failed to load clips:", error);
      setLoadError(String(error));
    }
  }, [filterClips]);

  const loadInputPanelSettings = useCallback(async () => {
    try {
      const settings = await invoke<InputPanelSettings>("get_settings");
      const modifier = (settings.input_panel_selection_modifier || "ctrl").toLowerCase();
      setSelectionModifier(modifier === "alt" ? "alt" : "ctrl");
    } catch (error) {
      console.debug("Failed to load input panel settings:", error);
    }
  }, []);

  // Load clips on mount
  useEffect(() => {
    loadClips();
    loadInputPanelSettings();
  }, [loadClips, loadInputPanelSettings]);

  // Listen for events
  useEffect(() => {
    const unlistenShow = listen<InputPanelShowPayload>("input-panel-show", (event) => {
      const payload = event.payload || {};
      const query = payload.query || "";
      setSearchQuery(query);
      setTriggerLen(payload.triggerLen ?? 2);
      const payloadModifier = (payload.selectionModifier || "").toLowerCase();
      if (payloadModifier === "alt" || payloadModifier === "ctrl") {
        setSelectionModifier(payloadModifier);
      }
      setIsVisible(true);
      loadClips();
      filterClips(query, clips);
    });

    const unlistenHide = listen("input-panel-hide", () => {
      setIsVisible(false);
      setSearchQuery("");
    });

    const unlistenSearch = listen<string>("input-panel-search", (event) => {
      const query = event.payload || "";
      setSearchQuery(query);
      filterClips(query, clips);
    });

    const unlistenSelect = listen<InputPanelSelectPayload>("input-panel-select-index", (event) => {
      const payload = event.payload || {};
      const index = payload.index ?? -1;
      const searchLen = payload.searchLen ?? searchQueryRef.current.length;
      const currentFiltered = filteredClipsRef.current;
      if (index >= 0 && currentFiltered[index]) {
        handleSelect(currentFiltered[index], searchLen);
      }
    });

    const unlistenClipboard = listen("clipboard-updated", () => {
      loadClips();
    });

    return () => {
      unlistenShow.then((f) => f());
      unlistenHide.then((f) => f());
      unlistenSearch.then((f) => f());
      unlistenSelect.then((f) => f());
      unlistenClipboard.then((f) => f());
    };
  }, [clips, filterClips, loadClips]);

  // Handle keyboard - Ctrl+1~9 for selection
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+1~9 to select and paste
      const modifierMatched =
        selectionModifier === "alt" ? e.altKey : e.ctrlKey;

      if (modifierMatched && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (filteredClips[index]) {
          handleSelect(filteredClips[index]);
        }
      }
      // Escape to hide
      else if (e.key === "Escape") {
        window.hide();
        setIsVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, filteredClips, selectionModifier, window]);

  const handleSelect = async (clip: ClipItem, searchLenOverride?: number) => {
    try {
      const searchLen = searchLenOverride ?? searchQuery.length;

      // Call paste_and_cleanup to delete /v and search content, then paste
      await invoke("paste_and_cleanup", {
        content: clip.content,
        trigger_len: triggerLen,
        search_len: searchLen,
      });

      const isMainVisible = await invoke<boolean>("is_main_window_visible");
      if (!isMainVisible) {
        const settings = await invoke<NotificationSettings>("get_settings");
        if (settings.show_notifications !== false) {
          const preview = getShortPreview(clip.content, 32);
          await invoke("show_notification", {
            title: "Fat Clip",
            body: t("inputPanel.switchedTo", { preview }),
          });
        }
      }

      await window.hide();
      setIsVisible(false);
    } catch (error) {
      console.error("Failed to paste:", error);
    }
  };

  const getShortPreview = (text: string, maxLen: number = 45): string => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + "...";
  };

  if (!isVisible) return null;

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        p: 0.5,
        m: 0,
        overflow: "hidden",
      }}
    >
      <Paper
        elevation={8}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 1,
          border: "none",
          m: 0,
        }}
      >
        {/* Header */}
        <Box sx={{ 
          px: 1, 
          py: 0.5,
          borderBottom: 1, 
          borderColor: "divider", 
          bgcolor: "grey.50",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Typography variant="caption" color="text.secondary">
            {searchQuery
              ? t("inputPanel.searchStats", { query: searchQuery, count: filteredClips.length })
              : t("inputPanel.countOnly", { count: filteredClips.length })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("inputPanel.pasteHint", {
              modifier: selectionModifier === "alt" ? t("inputPanel.modifierAlt") : t("inputPanel.modifierCtrl"),
            })}
          </Typography>
        </Box>

        {/* Clip List */}
        <Box
          ref={listRef}
          component="ul"
          sx={{
            flex: 1,
            overflow: "auto",
            p: 0.5,
            bgcolor: "background.paper",
            listStyle: "none",
            m: 0,
          }}
        >
          {filteredClips.slice(0, 9).map((clip, index) => (
            <ListItem
              key={clip.id}
              disablePadding
              sx={{
                mb: 0.5,
                bgcolor: "transparent",
                borderRadius: 1,
              }}
            >
              <ListItemButton
                onClick={() => handleSelect(clip)}
                sx={{ py: 0.4, px: 1 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      minWidth: 40,
                      color: "primary.main",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  >
                    {(selectionModifier === "alt" ? "Alt" : "Ctrl") + `+${index + 1}`}
                  </Typography>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: clip.content_type === "Plain" ? "monospace" : "inherit",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: "0.75rem",
                      }}
                    >
                      {getShortPreview(clip.content)}
                    </Typography>

                    {clip.tags.length > 0 && (
                      <Box sx={{ display: "flex", gap: 0.5, mt: 0.25, flexWrap: "wrap" }}>
                        {clip.tags.slice(0, 2).map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{ height: 14, fontSize: "0.6rem" }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>

                  <CopyIcon sx={{ fontSize: 14, color: "grey.400" }} />
                </Box>
              </ListItemButton>
            </ListItem>
          ))}

          {filteredClips.length === 0 && (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                {loadError
                  ? t("inputPanel.loadFailed")
                  : clips.length === 0
                    ? t("common.noClips")
                    : t("inputPanel.noMatch")}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
