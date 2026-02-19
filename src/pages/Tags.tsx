import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Label as LabelIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";

interface ClipItem {
  id: string;
  content_type: "Plain" | "Rich" | "Image" | "File";
  content: string;
  preview_text: string;
  tags: string[];
  source_app: string;
  created_at: string;
  pinned: boolean;
}

export function Tags() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [taggedClips, setTaggedClips] = useState<ClipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [expandedClipId, setExpandedClipId] = useState<string | false>(false);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (selectedTag) {
      loadClipsByTag(selectedTag);
    }
  }, [selectedTag]);

  const loadTags = async () => {
    try {
      const tags = await invoke<string[]>("get_all_tags");
      setAllTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  const loadClipsByTag = async (tag: string) => {
    try {
      const clips = await invoke<ClipItem[]>("search_clips", {
        query: `tag:${tag}`,
        limit: 100,
      });
      setTaggedClips(clips);
      setExpandedClipId(false);
    } catch (error) {
      console.error("Failed to load clips by tag:", error);
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    
    try {
      // Remove tag from all clips that have it
      for (const clip of taggedClips) {
        if (clip.tags.includes(tagToDelete)) {
          const newTags = clip.tags.filter((t) => t !== tagToDelete);
          await invoke("update_clip_tags", { id: clip.id, tags: newTags });
        }
      }
      
      setDeleteDialogOpen(false);
      setTagToDelete(null);
      setSelectedTag(null);
      setTaggedClips([]);
      setExpandedClipId(false);
      loadTags();
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  const confirmDeleteTag = (tag: string) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const filteredTags = allTags.filter((tag) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const formatClipTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleString();
  };

  const getShortPreview = (text: string) => {
    const firstLine = text.split("\n")[0] || "";
    if (firstLine.length <= 72) return firstLine;
    return `${firstLine.slice(0, 72)}...`;
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 0, borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title={t("common.back")}>
            <IconButton onClick={() => navigate("/")} size="small">
              <BackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <LabelIcon sx={{ color: "primary.main", fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            {t("tags.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {allTags.length} {t("common.items")}
          </Typography>
        </Box>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Tags List */}
        <Box sx={{ width: 200, borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column" }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: "grey.500" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
            {filteredTags.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: "block" }}>
                {t("tags.noTags")}
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {filteredTags.map((tag) => (
                  <Paper
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    sx={{
                      p: 1,
                      cursor: "pointer",
                      bgcolor: selectedTag === tag ? "primary.main" : "background.paper",
                      color: selectedTag === tag ? "primary.contrastText" : "text.primary",
                      "&:hover": {
                        bgcolor: selectedTag === tag ? "primary.dark" : "action.hover",
                      },
                    }}
                  >
                    <Typography variant="body2" noWrap>
                      {tag}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Clips with selected tag */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selectedTag ? (
            <>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip label={selectedTag} color="primary" size="small" />
                  <Typography variant="body2" color="text.secondary">
                    {taggedClips.length} {t("common.items")}
                  </Typography>
                </Box>
                <Tooltip title={t("common.delete")}>
                  <IconButton size="small" color="error" onClick={() => confirmDeleteTag(selectedTag)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                  {taggedClips.map((clip) => {
                    const preview = getShortPreview(clip.preview_text || clip.content);
                    return (
                      <Accordion
                        key={clip.id}
                        expanded={expandedClipId === clip.id}
                        onChange={(_, expanded) => setExpandedClipId(expanded ? clip.id : false)}
                        disableGutters
                        sx={{
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1.5,
                          overflow: "hidden",
                          bgcolor: "background.paper",
                          "&:before": { display: "none" },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon fontSize="small" />}
                          sx={{
                            px: 1.25,
                            py: 0.75,
                            minHeight: 56,
                            "& .MuiAccordionSummary-content": {
                              my: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.75,
                              minWidth: 0,
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                            title={clip.preview_text || clip.content}
                            sx={{
                              minWidth: 0,
                              maxWidth: "100%",
                              fontFamily: clip.content_type === "Plain" ? "monospace" : "inherit",
                            }}
                          >
                            {preview}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatClipTime(clip.created_at)}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 1.25, pt: 0.25, pb: 1.25, bgcolor: "background.default" }}>
                          <Typography
                            component="pre"
                            sx={{
                              m: 0,
                              p: 1,
                              borderRadius: 1,
                              border: 1,
                              borderColor: "divider",
                              bgcolor: "background.paper",
                              fontSize: "0.8rem",
                              fontFamily: "monospace",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              maxHeight: 220,
                              overflowY: "auto",
                            }}
                          >
                            {clip.content}
                          </Typography>

                          {clip.tags.length > 0 && (
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                              {clip.tags.map((tag) => (
                                <Chip key={`${clip.id}-${tag}`} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                              ))}
                            </Box>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("tags.searchByTag")}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>
          {t("tags.remove")}
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t("tags.removeConfirm", { tag: tagToDelete })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDeleteTag} color="error" variant="contained" size="small">
            {t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
