import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface ClipboardListenerProps {
  onNewClip: () => void;
}

// Content type for clipboard items
export type ContentType = "Plain" | "Rich" | "Image" | "File";

// Interface for clip item
export interface ClipItem {
  id: string;
  content_type: ContentType;
  content: string;
  preview_text: string;
  tags: string[];
  source_app: string;
  created_at: string;
  last_used_at: string;
  pinned: boolean;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size_bytes?: number;
    thumbnail_path?: string;
    has_html?: boolean;
    has_rtf?: boolean;
    html_preview?: string;
    file_paths?: string[];
    total_size_bytes?: number;
  };
}

// Notification type
interface ClipboardNotification {
  type: ContentType;
  preview: string;
}

export function ClipboardListener({ onNewClip }: ClipboardListenerProps) {
  const { t } = useTranslation();
  const lastContentRef = useRef<string>("");
  const isProcessingRef = useRef<boolean>(false);

  const showNotification = useCallback(async (notification: ClipboardNotification) => {
    try {
      // Only show notification when window is hidden
      const window = getCurrentWindow();
      const isVisible = await window.isVisible();
      if (!isVisible) {
        const typeLabel = getContentTypeInfo(notification.type).label;
        await invoke("show_notification", {
          title: `${t("app.name")} - ${typeLabel}`,
          body: notification.preview,
        });
      }
    } catch (error) {
      console.debug("Notification failed:", error);
    }
  }, [t]);

  const checkClipboard = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    try {
      isProcessingRef.current = true;
      
      // Try to read text first (most common)
      const text = await readText();
      
      if (text && text !== lastContentRef.current) {
        console.log("New clipboard content detected:", text.slice(0, 50));
        lastContentRef.current = text;
        
        // Save to database
        try {
          const result = await invoke<ClipItem>("save_text_clip", {
            text,
            sourceApp: "Unknown",
          });
          console.log("Clip saved successfully:", result);
          
          // Show notification with preview (only when window is hidden)
          const preview = text.slice(0, 30) + (text.length > 30 ? "..." : "");
          await showNotification({ type: "Plain", preview });
          
          // Notify parent to refresh
          onNewClip();
        } catch (saveError) {
          console.error("Failed to save clip:", saveError);
        }
      }
    } catch (error) {
      console.debug("Clipboard check failed:", error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [onNewClip, showNotification]);

  useEffect(() => {
    const interval = setInterval(checkClipboard, 500);
    return () => clearInterval(interval);
  }, [checkClipboard]);

  return null;
}

// Helper function to get content type icon/label
export function getContentTypeInfo(type: ContentType): { icon: string; label: string } {
  switch (type) {
    case "Plain":
      return { icon: "📝", label: "文本" };
    case "Rich":
      return { icon: "🎨", label: "富文本" };
    case "Image":
      return { icon: "🖼️", label: "图片" };
    case "File":
      return { icon: "📎", label: "文件" };
    default:
      return { icon: "📄", label: "未知" };
  }
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Helper function to get image URL from clip data
export async function getImageDataUrl(clipId: string): Promise<string | null> {
  try {
    const imageData = await invoke<Uint8Array>("get_clip_image_data", { clipId });
    if (imageData) {
      // Convert Uint8Array to base64
      const bytes = new Uint8Array(imageData);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:image/png;base64,${base64}`;
    }
  } catch (error) {
    console.error("Failed to get image data:", error);
  }
  return null;
}

// Helper function to get thumbnail URL from clip data
export async function getThumbnailDataUrl(clipId: string): Promise<string | null> {
  try {
    const imageData = await invoke<Uint8Array>("get_clip_thumbnail_data", { clipId });
    if (imageData) {
      // Convert Uint8Array to base64
      const bytes = new Uint8Array(imageData);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:image/png;base64,${base64}`;
    }
  } catch (error) {
    console.error("Failed to get thumbnail data:", error);
  }
  return null;
}

// Helper function to parse rich text content
export function parseRichTextContent(content: string): { html?: string; rtf?: string; plain: string } {
  try {
    const parsed = JSON.parse(content);
    return {
      html: parsed.html,
      rtf: parsed.rtf,
      plain: parsed.plain || content,
    };
  } catch {
    return { plain: content };
  }
}

// Helper function to parse file content
export function parseFileContent(content: string): string[] {
  try {
    return JSON.parse(content) as string[];
  } catch {
    return content.split("\n").filter(Boolean);
  }
}

// Helper function to get file name from path
export function getFileNameFromPath(path: string): string {
  // Handle both Windows and Unix paths
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// Helper function to get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

// Helper function to get icon for file type
export function getFileIcon(filename: string): string {
  const ext = getFileExtension(filename);
  const iconMap: Record<string, string> = {
    // Images
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    bmp: "🖼️",
    webp: "🖼️",
    svg: "🖼️",
    // Documents
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    txt: "📃",
    rtf: "📃",
    md: "📃",
    // Spreadsheets
    xls: "📊",
    xlsx: "📊",
    csv: "📊",
    // Presentations
    ppt: "📽️",
    pptx: "📽️",
    // Archives
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    tar: "📦",
    gz: "📦",
    // Code
    js: "💻",
    ts: "💻",
    jsx: "💻",
    tsx: "💻",
    html: "🌐",
    css: "🎨",
    py: "🐍",
    rs: "🦀",
    java: "☕",
    cpp: "⚙️",
    c: "⚙️",
    go: "🐹",
    // Audio
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    // Video
    mp4: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mov: "🎬",
  };
  return iconMap[ext] || "📄";
}
