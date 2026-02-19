import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  IconButton,
  Chip,
  Typography,
  Paper,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Collapse,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Popper,
  ClickAwayListener,
  List,
  ListItem,
  ListItemButton,
  Snackbar,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Delete as DeleteIcon,
  Label as LabelIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  ViewCompact as CompactIcon,
  ViewList as DetailedIcon,
  FiberManualRecord as DotIcon,
  Image as ImageIcon,
  TextSnippet as TextIcon,
  Description as FileIcon,
  Code as CodeIcon,
} from "@mui/icons-material";
import { TitleBar } from "../components/TitleBar";
import { useNotification } from "../hooks/useNotification";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { 
  ClipItem, 
  getContentTypeInfo, 
  formatFileSize, 
  getImageDataUrl,
  parseRichTextContent,
  parseFileContent,
} from "../components/ClipboardListener";

interface SettingsData {
  timeline_mode?: "standard" | "compact" | "off";
}

// Content type filter
const contentTypeFilters: { value: string; label: string; icon?: React.ReactElement }[] = [
  { value: "all", label: "全部" },
  { value: "Plain", label: "文本", icon: <TextIcon fontSize="small" /> },
  { value: "Rich", label: "富文本", icon: <CodeIcon fontSize="small" /> },
  { value: "Image", label: "图片", icon: <ImageIcon fontSize="small" /> },
  { value: "File", label: "文件", icon: <FileIcon fontSize="small" /> },
];

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState<"compact" | "detailed">("compact");
  const [timelineMode, setTimelineMode] = useState<"standard" | "compact" | "off">("standard");
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [newTag, setNewTag] = useState("");
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsAnchorRef = useRef<HTMLDivElement>(null);
  const clipItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const daySectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});

  const loadClips = useCallback(async () => {
    try {
      const result = await invoke<ClipItem[]>("get_recent_clips", { limit: 50 });
      setClips(result);
      
      // Load image data for image clips
      const imageClips = result.filter(c => c.content_type === "Image");
      for (const clip of imageClips) {
        if (!imageDataUrls[clip.id]) {
          const dataUrl = await getImageDataUrl(clip.id);
          if (dataUrl) {
            setImageDataUrls(prev => ({ ...prev, [clip.id]: dataUrl }));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load clips:", error);
    }
  }, [imageDataUrls]);

  const loadTags = useCallback(async () => {
    try {
      const tags = await invoke<string[]>("get_all_tags");
      setAllTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }, []);

  useEffect(() => {
    loadClips();
    loadTags();

    const loadTimelineMode = async () => {
      try {
        const result = await invoke<SettingsData>("get_settings");
        if (result.timeline_mode) {
          setTimelineMode(result.timeline_mode);
        }
      } catch (error) {
        console.debug("Failed to load timeline mode:", error);
      }
    };

    loadTimelineMode();

    const unlistenFocus = listen("focus-window", () => {
      searchInputRef.current?.focus();
    });

    const unlistenSettings = listen<SettingsData>("settings-changed", (event) => {
      if (event.payload?.timeline_mode) {
        setTimelineMode(event.payload.timeline_mode);
      }
    });

    const unlistenClipboard = listen("clipboard-updated", () => {
      loadClips();
    });

    return () => {
      unlistenFocus.then((f) => f());
      unlistenSettings.then((f) => f());
      unlistenClipboard.then((f) => f());
    };
  }, [loadClips, loadTags]);

  useEffect(() => {
    const updateSuggestions = async () => {
      if (!searchQuery.trim()) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const query = searchQuery.toLowerCase();

      if (query.startsWith("tag:") || query.startsWith("#")) {
        const tagQuery = query.startsWith("tag:") ? query.slice(4) : query.slice(1);
        if (tagQuery) {
          try {
            const matchedTags = await invoke<string[]>("search_tags", { query: tagQuery });
            setSuggestions(matchedTags.map((tag) => `tag:${tag}`));
            setShowSuggestions(matchedTags.length > 0);
          } catch (error) {
            console.error("Failed to search tags:", error);
          }
        } else {
          setSuggestions(allTags.slice(0, 10).map((tag) => `tag:${tag}`));
          setShowSuggestions(allTags.length > 0);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    updateSuggestions();
  }, [searchQuery, allTags]);

  useEffect(() => {
    const displayedClips = getFilteredClips();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          return;
        }
        if (tagDialogOpen) {
          setTagDialogOpen(false);
        } else if (showSuggestions) {
          setShowSuggestions(false);
        } else if (expandedId) {
          setExpandedId(null);
        } else if (searchQuery || selectedTags.length > 0 || contentTypeFilter !== "all") {
          setSearchQuery("");
          setSelectedTags([]);
          setContentTypeFilter("all");
          loadClips();
        } else {
          getCurrentWindow().hide();
        }
        return;
      }

      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !tagDialogOpen && !showSuggestions) {
        if (displayedClips.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (e.key === "ArrowUp") {
            return Math.max(0, prev - 1);
          }
          return Math.min(displayedClips.length - 1, prev + 1);
        });
        return;
      }

      if (e.key === "Enter" && !tagDialogOpen && !showSuggestions) {
        if (displayedClips.length === 0) return;
        e.preventDefault();
        const current = displayedClips[selectedIndex];
        if (current) {
          handleCopy(current);
          setExpandedId((prev) => (prev === current.id ? null : current.id));
        }
        return;
      }

      if (e.key >= "1" && e.key <= "9" && !tagDialogOpen && !showSuggestions) {
        const index = parseInt(e.key) - 1;
        if (index < displayedClips.length) {
          const clip = displayedClips[index];
          handleCopy(clip);
          setSelectedIndex(index);
          setExpandedId((prev) => (prev === clip.id ? null : clip.id));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clips, selectedIndex, expandedId, searchQuery, tagDialogOpen, showSuggestions, selectedTags, loadClips, contentTypeFilter]);

  const getFilteredClips = () => {
    let filtered = [...clips.filter((c) => c.pinned), ...clips.filter((c) => !c.pinned)];
    
    // Apply content type filter
    if (contentTypeFilter !== "all") {
      filtered = filtered.filter(c => c.content_type === contentTypeFilter);
    }
    
    return filtered;
  };

  const handleSearch = useCallback(
    async (query: string, tags: string[] = selectedTags) => {
      setSearchQuery(query);
      setShowSuggestions(false);

      const searchTerms: string[] = [];
      if (query.trim()) searchTerms.push(query.trim());
      tags.forEach((tag) => searchTerms.push(`tag:${tag}`));

      if (searchTerms.length > 0) {
        try {
          const combinedQuery = searchTerms.join(" ");
          const result = await invoke<ClipItem[]>("search_clips", { query: combinedQuery, limit: 50 });
          setClips(result);
        } catch (error) {
          console.error("Search failed:", error);
        }
      } else {
        loadClips();
      }
    },
    [loadClips, selectedTags]
  );

  const handleSuggestionClick = (suggestion: string) => {
    const tag = suggestion.replace("tag:", "");
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      setSearchQuery("");
      handleSearch("", newTags);
    }
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleTagClick = async (tag: string) => {
    const isSelected = selectedTags.includes(tag);
    const newTags = isSelected ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setSelectedTags(newTags);
    handleSearch(searchQuery, newTags);
  };

  const handleCopy = async (clip: ClipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (clip.content_type === "Image") {
        // For images, we need to handle differently
        const imageData = await invoke<Uint8Array>("get_clip_image_data", { clipId: clip.id });
        if (imageData) {
          await invoke("write_image_to_clipboard", { imageData: Array.from(imageData) });
        }
      } else if (clip.content_type === "Rich") {
        // For rich text, extract plain text for now
        const { plain } = parseRichTextContent(clip.content);
        await invoke("write_to_clipboard", { content: plain });
      } else if (clip.content_type === "File") {
        // For files, copy the file paths
        const paths = parseFileContent(clip.content);
        await invoke("write_to_clipboard", { content: paths.join("\n") });
      } else {
        // Plain text
        await invoke("write_to_clipboard", { content: clip.content });
      }
      
      setCopiedId(clip.id);
      const isVisible = await getCurrentWindow().isVisible();
      if (isVisible) {
        setShowCopiedToast(true);
      } else {
        await notify("notifications.clipCopied");
      }
      setTimeout(() => setCopiedId(null), 1500);
      loadClips();
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleTogglePin = async (clip: ClipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke("toggle_clip_pin", { id: clip.id, pinned: !clip.pinned });
      loadClips();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const handleDelete = async (clip: ClipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke("delete_clip", { id: clip.id });
      if (expandedId === clip.id) setExpandedId(null);
      await notify("notifications.clipDeleted");
      loadClips();
      loadTags();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const openTagDialog = (clip: ClipItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedClip(clip);
    setEditingTags(clip.tags);
    setTagDialogOpen(true);
  };

  const saveTags = async () => {
    if (selectedClip) {
      try {
        await invoke("update_clip_tags", { id: selectedClip.id, tags: editingTags });
        loadClips();
        loadTags();
        setTagDialogOpen(false);
        setSelectedClip(null);
        await notify("notifications.tagAdded");
      } catch (error) {
        console.error("Failed to update tags:", error);
      }
    }
  };

  const addTag = () => {
    if (newTag.trim() && !editingTags.includes(newTag.trim())) {
      setEditingTags([...editingTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditingTags(editingTags.filter((tag) => tag !== tagToRemove));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("common.justNow");
    if (minutes < 60) return t("common.minutesAgo", { count: minutes });
    if (hours < 24) return t("common.hoursAgo", { count: hours });
    return t("common.daysAgo", { count: days });
  };

  const allClips = getFilteredClips();

  const getDayKey = (dateStr: string) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDayLabel = (dayKey: string) => {
    const today = getDayKey(new Date().toISOString());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getDayKey(yesterdayDate.toISOString());

    if (dayKey === today) return "今天";
    if (dayKey === yesterday) return "昨天";
    return dayKey;
  };

  const timelineGroups = useMemo(() => {
    const map = new Map<string, { dayKey: string; label: string; items: Array<{ clip: ClipItem; index: number }> }>();

    allClips.forEach((clip, index) => {
      const dayKey = getDayKey(clip.created_at);
      if (!map.has(dayKey)) {
        map.set(dayKey, {
          dayKey,
          label: getDayLabel(dayKey),
          items: [],
        });
      }
      map.get(dayKey)!.items.push({ clip, index });
    });

    return Array.from(map.values());
  }, [allClips]);

  const activeDayKey = useMemo(() => {
    for (const group of timelineGroups) {
      if (group.items.some((item) => item.index === selectedIndex)) {
        return group.dayKey;
      }
    }
    return timelineGroups[0]?.dayKey;
  }, [timelineGroups, selectedIndex]);

  useEffect(() => {
    if (allClips.length === 0) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= allClips.length) return allClips.length - 1;
      return prev;
    });
  }, [allClips.length]);

  useEffect(() => {
    const current = clipItemRefs.current[selectedIndex];
    if (current) {
      current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Render content based on type
  const renderClipContent = (clip: ClipItem) => {
    switch (clip.content_type) {
      case "Image":
        return renderImageContent(clip);
      case "Rich":
        return renderRichTextContent(clip);
      case "File":
        return renderFileContent(clip);
      case "Plain":
      default:
        return renderPlainTextContent(clip);
    }
  };

  const renderImageContent = (clip: ClipItem) => {
    const imageUrl = imageDataUrls[clip.id];
    const metadata = clip.metadata;
    
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt="Clipboard image"
            sx={{
              maxWidth: "100%",
              maxHeight: 200,
              objectFit: "contain",
              borderRadius: 1,
              bgcolor: "background.paper",
            }}
          />
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 100,
              bgcolor: "action.hover",
              borderRadius: 1,
            }}
          >
            <ImageIcon sx={{ fontSize: 40, color: "text.secondary" }} />
          </Box>
        )}
        {metadata && (
          <Typography variant="caption" color="text.secondary">
            {metadata.width} x {metadata.height} px
            {metadata.size_bytes && ` • ${formatFileSize(metadata.size_bytes)}`}
          </Typography>
        )}
      </Box>
    );
  };

  const renderRichTextContent = (clip: ClipItem) => {
    const { html, plain } = parseRichTextContent(clip.content);
    
    return (
      <Box>
        {clip.metadata?.has_html && html && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
              HTML Preview:
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1,
                mt: 0.5,
                bgcolor: "background.paper",
                maxHeight: 100,
                overflow: "auto",
              }}
            >
              <Typography
                variant="caption"
                component="code"
                sx={{
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {clip.metadata?.html_preview || html.slice(0, 200)}
              </Typography>
            </Paper>
          </Box>
        )}
        <Typography
          component="pre"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            m: 0,
          }}
        >
          {plain}
        </Typography>
      </Box>
    );
  };

  const renderFileContent = (clip: ClipItem) => {
    const filePaths = parseFileContent(clip.content);
    const metadata = clip.metadata;
    
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          {filePaths.length} 个文件
          {metadata?.total_size_bytes && ` • ${formatFileSize(metadata.total_size_bytes)}`}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {filePaths.slice(0, 5).map((path, idx) => (
            <Paper
              key={idx}
              variant="outlined"
              sx={{
                p: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "background.paper",
              }}
            >
              <FileIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {path.split("/").pop() || path.split("\\").pop() || path}
              </Typography>
            </Paper>
          ))}
          {filePaths.length > 5 && (
            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
              +{filePaths.length - 5} 更多文件...
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderPlainTextContent = (clip: ClipItem) => {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          bgcolor: "background.paper",
          maxHeight: displayMode === "detailed" ? 150 : 300,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <Typography
          component="pre"
          sx={{
            fontFamily: "monospace",
            fontSize: displayMode === "detailed" ? "0.75rem" : "0.8rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            m: 0,
            lineHeight: 1.5,
          }}
        >
          {clip.content}
        </Typography>
      </Paper>
    );
  };

  const renderClipCard = (clip: ClipItem, index: number) => {
    const typeInfo = getContentTypeInfo(clip.content_type);
    
    return (
      <Paper
        key={clip.id}
        ref={(el: HTMLDivElement | null) => {
          clipItemRefs.current[index] = el;
        }}
        elevation={expandedId === clip.id ? 2 : 0}
        sx={{
          mb: timelineMode === "compact" ? 0.5 : 1,
          border: 1,
          borderColor: selectedIndex === index ? "primary.main" : expandedId === clip.id ? "primary.main" : "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
          transition: "all 0.2s ease",
        }}
      >
        <Box
          onClick={() => {
            setSelectedIndex(index);
            setExpandedId(expandedId === clip.id ? null : clip.id);
          }}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: displayMode === "compact" ? 0.75 : 1.25,
            cursor: "pointer",
            bgcolor: selectedIndex === index ? "primary.50" : expandedId === clip.id ? "primary.50" : "transparent",
            "&:hover": { bgcolor: selectedIndex === index || expandedId === clip.id ? "primary.100" : "action.hover" },
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 16, fontSize: "0.7rem" }}>
            {index + 1}
          </Typography>

          {clip.pinned && <PinIcon sx={{ fontSize: 14, color: "primary.main" }} />}
          
          {/* Content type icon */}
          <Tooltip title={typeInfo.label}>
            <Typography sx={{ fontSize: "0.9rem" }}>{typeInfo.icon}</Typography>
          </Tooltip>

          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              maxWidth: "100%",
              fontFamily: clip.content_type === "Plain" ? "monospace" : "inherit",
              fontSize: displayMode === "compact" ? "0.8rem" : "0.9rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {clip.preview_text}
          </Typography>

          <Box sx={{ display: "flex", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
            <Tooltip title={clip.pinned ? t("common.unpin") : t("common.pin")}>
              <IconButton size="small" onClick={(e) => handleTogglePin(clip, e)} color={clip.pinned ? "primary" : "default"} sx={{ width: 26, height: 26 }}>
                {clip.pinned ? <PinIcon sx={{ fontSize: 14 }} /> : <PinOutlinedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title={t("common.tags")}>
              <IconButton size="small" onClick={(e) => openTagDialog(clip, e)} sx={{ width: 26, height: 26 }}>
                <LabelIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={copiedId === clip.id ? t("common.copied") : t("common.copy")}>
              <IconButton size="small" onClick={(e) => handleCopy(clip, e)} color={copiedId === clip.id ? "success" : "primary"} sx={{ width: 26, height: 26 }}>
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("common.delete")}>
              <IconButton size="small" onClick={(e) => handleDelete(clip, e)} color="error" sx={{ width: 26, height: 26 }}>
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={expandedId === clip.id ? t("display.hideDetail") : t("display.showDetail")}>
              <IconButton size="small" onClick={() => setExpandedId(expandedId === clip.id ? null : clip.id)} sx={{ width: 26, height: 26 }}>
                {expandedId === clip.id ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Collapse in={expandedId === clip.id || displayMode === "detailed"}>
          <Box
            sx={{
              px: 1.5,
              pb: 1.5,
              pt: displayMode === "detailed" && expandedId !== clip.id ? 0.5 : 0.5,
              bgcolor: "background.default",
              borderTop: 1,
              borderColor: "divider",
              display: displayMode === "detailed" && expandedId !== clip.id ? "block" : undefined,
            }}
          >
            {clip.tags.length > 0 && (
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {clip.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    color={selectedTags.includes(tag) ? "primary" : "default"}
                    variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                    onClick={() => handleTagClick(tag)}
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      bgcolor: selectedTags.includes(tag) ? "primary.main" : "transparent",
                    }}
                  />
                ))}
              </Box>
            )}

            {(expandedId === clip.id || displayMode === "detailed") && (
              renderClipContent(clip)
            )}

            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {formatDate(clip.created_at)}
            </Typography>
          </Box>
        </Collapse>
      </Paper>
    );
  };

  const pinnedClips = allClips.filter((c) => c.pinned);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <TitleBar />

      <Paper elevation={0} sx={{ px: 1.5, py: 1, borderRadius: 0, borderBottom: 1, borderColor: "divider", position: "relative" }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }} ref={suggestionsAnchorRef}>
          <TextField
            inputRef={searchInputRef}
            placeholder={`${t("common.search")} (${t("common.searchShortcut")})`}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery && setSuggestions([])}
            size="small"
            fullWidth
            autoFocus
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "action.hover" },
                "&.Mui-focused": { bgcolor: "background.default" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />

          <ToggleButtonGroup
            size="small"
            value={displayMode}
            exclusive
            onChange={(_, value) => value && setDisplayMode(value)}
          >
            <ToggleButton value="compact" sx={{ px: 1 }}>
              <CompactIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="detailed" sx={{ px: 1 }}>
              <DetailedIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title={t("tags.title")}>
            <IconButton size="small" onClick={() => navigate("/tags")} sx={{ color: "text.secondary" }}>
              <LabelIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={t("common.settings")}>
            <IconButton size="small" onClick={() => navigate("/settings")} sx={{ color: "text.secondary" }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Content type filter tabs */}
        <Tabs
          value={contentTypeFilter}
          onChange={(_, value) => setContentTypeFilter(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            mt: 1,
            minHeight: 36,
            "& .MuiTabs-flexContainer": { gap: 0.5 },
            "& .MuiTab-root": { 
              minHeight: 32, 
              py: 0.5,
              px: 1.5,
              minWidth: "auto",
              fontSize: "0.8rem",
            },
          }}
        >
          {contentTypeFilters.map((filter) => (
            <Tab
              key={filter.value}
              value={filter.value}
              label={filter.label}
              icon={filter.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>

        <Popper
          open={showSuggestions}
          anchorEl={suggestionsAnchorRef.current}
          placement="bottom-start"
          style={{ width: suggestionsAnchorRef.current?.offsetWidth, zIndex: 1400 }}
        >
          <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
            <Paper elevation={3} sx={{ mt: 0.5, maxHeight: 200, overflow: "auto" }}>
              <List dense>
                {suggestions.map((suggestion, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemButton onClick={() => handleSuggestionClick(suggestion)} sx={{ py: 0.5 }}>
                      <Chip
                        label={suggestion.replace("tag:", "")}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {t("tags.searchByTag")}
                      </Typography>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </ClickAwayListener>
        </Popper>

        {allTags.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
            {allTags.slice(0, 8).map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onClick={() => handleTagClick(tag)}
                color={selectedTags.includes(tag) ? "primary" : "default"}
                variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  bgcolor: selectedTags.includes(tag) ? "primary.main" : "transparent",
                }}
              />
            ))}
            {allTags.length > 8 && (
              <Chip
                label={`+${allTags.length - 8}`}
                size="small"
                variant="outlined"
                onClick={() => navigate("/tags")}
                sx={{ height: 20, fontSize: "0.7rem", cursor: "pointer" }}
              />
            )}
          </Box>
        )}
      </Paper>

      <Box sx={{ px: 1.5, py: 0.5, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", display: "flex", gap: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {allClips.length} {t("common.items")}
        </Typography>
        {pinnedClips.length > 0 && (
          <Typography variant="caption" color="primary.main">
            {pinnedClips.length} {t("common.pinned")}
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {timelineMode === "standard" && (
          <Box
            sx={{
              width: 110,
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "background.default",
              overflow: "auto",
              p: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              position: "relative",
            }}
          >
            {timelineGroups.map((group) => (
              <Box key={group.dayKey} sx={{ position: "relative", zIndex: 1 }}>
                <Paper
                  variant="outlined"
                  onClick={() => {
                    const target = daySectionRefs.current[group.dayKey];
                    target?.scrollIntoView({ block: "start", behavior: "smooth" });
                    const firstIndex = group.items[0]?.index ?? 0;
                    setSelectedIndex(firstIndex);
                  }}
                  sx={{
                    px: 1,
                    py: 0.75,
                    cursor: "pointer",
                    borderColor: activeDayKey === group.dayKey ? "primary.main" : "divider",
                    bgcolor: activeDayKey === group.dayKey ? "primary.50" : "background.paper",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography variant="caption" sx={{ display: "block", fontWeight: 600 }}>
                      {group.label}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {group.items.length} 条
                  </Typography>
                </Paper>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: 1 }}>
          {timelineMode === "off"
            ? allClips.map((clip, index) => renderClipCard(clip, index))
            : timelineMode === "compact"
              ? timelineGroups.map((group, groupIndex) => (
                  <Box
                    key={group.dayKey}
                    ref={(el: HTMLDivElement | null) => {
                      daySectionRefs.current[group.dayKey] = el;
                    }}
                    sx={{ mb: 1 }}
                  >
                    <Box sx={{ position: "relative", display: "flex", alignItems: "center", mb: 0.5, pl: 4.5 }}>
                      <Box
                        sx={{
                          position: "absolute",
                          left: 2,
                          width: 12,
                          height: 20,
                          flexShrink: 0,
                        }}
                      >
                        {groupIndex > 0 && (
                          <Box
                            sx={{
                              position: "absolute",
                              left: 4,
                              top: 0,
                              bottom: "50%",
                              width: 2,
                              bgcolor: "divider",
                              borderRadius: 1,
                            }}
                          />
                        )}
                        {groupIndex < timelineGroups.length - 1 && (
                          <Box
                            sx={{
                              position: "absolute",
                              left: 4,
                              top: "50%",
                              bottom: -8,
                              width: 2,
                              bgcolor: "divider",
                              borderRadius: 1,
                            }}
                          />
                        )}
                      </Box>
                      <DotIcon
                        sx={{
                          position: "absolute",
                          left: 4,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 14,
                          color: activeDayKey === group.dayKey ? "primary.main" : "text.secondary",
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: "text.secondary",
                          whiteSpace: "nowrap",
                          lineHeight: 1,
                        }}
                      >
                        {group.label} {group.items.length} 条
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {group.items.map(({ clip, index }) => renderClipCard(clip, index))}
                    </Box>
                  </Box>
                ))
              : timelineGroups.map((group) => (
                <Box
                  key={group.dayKey}
                  ref={(el: HTMLDivElement | null) => {
                    daySectionRefs.current[group.dayKey] = el;
                  }}
                  sx={{ mb: 1.5 }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", mb: 0.75, px: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", minWidth: 72 }}>
                      {group.label}
                    </Typography>
                    <Box sx={{ flex: 1, height: 1, bgcolor: "divider", ml: 1 }} />
                  </Box>

                  {group.items.map(({ clip, index }) => renderClipCard(clip, index))}
                </Box>
              ))}

          {allClips.length === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {searchQuery || selectedTags.length > 0 || contentTypeFilter !== "all" 
                  ? t("common.noClipsSearch") 
                  : t("common.noClips")}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ px: 1.5, py: 0.5, bgcolor: "background.paper", borderTop: 1, borderColor: "divider", display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary">1-9: {t("display.showDetail")}</Typography>
        <Typography variant="caption" color="text.secondary">/: {t("common.search")}</Typography>
        <Typography variant="caption" color="text.secondary">Esc: {t("common.close")}</Typography>
      </Box>

      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 1, fontSize: "1rem" }}>
          {t("tags.manage")}
          <IconButton onClick={() => setTagDialogOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2, minHeight: 32 }}>
            {editingTags.map((tag) => (
              <Chip key={tag} label={tag} onDelete={() => removeTag(tag)} color="primary" size="small" sx={{ height: 24 }} />
            ))}
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder={t("tags.add")}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button onClick={addTag} disabled={!newTag.trim()} size="small">
                    {t("common.add")}
                  </Button>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setTagDialogOpen(false)} size="small">{t("common.cancel")}</Button>
          <Button onClick={saveTags} variant="contained" size="small">{t("common.save")}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showCopiedToast}
        autoHideDuration={1200}
        onClose={() => setShowCopiedToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setShowCopiedToast(false)} sx={{ py: 0.5 }}>
          {t("common.copied")}
        </Alert>
      </Snackbar>
    </Box>
  );
}
