import { useEffect, useMemo } from "react";
import {
  FileText,
  ImageIcon,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { formatFileSize } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DocumentFileType } from "@/types/document";

interface FilePreviewCardProps {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "processing" | "ready" | "failed";
  error?: string;
  fileSize?: number;
  fileType?: DocumentFileType;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  onRemove: (id: string) => void;
}

const STATUS_CONFIG = {
  uploading: {
    label: "Uploading",
    variant: "secondary" as const,
    showProgress: true,
  },
  processing: {
    label: "Extracting",
    variant: "secondary" as const,
    showProgress: true,
  },
  ready: {
    label: "Ready",
    variant: "default" as const,
    showProgress: false,
  },
  failed: {
    label: "Failed",
    variant: "destructive" as const,
    showProgress: false,
  },
};

export const FilePreviewCard = ({
  id,
  file,
  progress,
  status,
  error,
  fileSize,
  fileType,
  thumbnailUrl,
  previewUrl: providedPreviewUrl,
  onRemove,
}: FilePreviewCardProps) => {
  const isPDF = file.type === "application/pdf" || fileType === "pdf";
  const isImage = file.type.startsWith("image/") || fileType === "image";
  const config = STATUS_CONFIG[status];

  const previewUrl = useMemo(() => {
    if (providedPreviewUrl) return providedPreviewUrl;
    if (thumbnailUrl) return thumbnailUrl;
    if (!isImage) return null;
    return URL.createObjectURL(file);
  }, [file, isImage, providedPreviewUrl, thumbnailUrl]);

  useEffect(() => {
    if (providedPreviewUrl || thumbnailUrl) return;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, providedPreviewUrl, thumbnailUrl]);

  const showIndeterminate = status === "processing";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition-colors",
        status === "ready" && "border-primary/25 bg-destructive/3",
        status === "failed" && "border-destructive/30 bg-destructive/3",
        status !== "ready" && status !== "failed" && "border-border"
      )}
    >
      <div className="flex items-start gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        {/* Thumbnail */}
        <div
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border sm:h-12 sm:w-12",
            status === "ready"
              ? "border-primary/20 bg-primary/5"
              : "border-border bg-muted/50"
          )}
        >
          {isPDF ? (
            <FileText className="h-5 w-5 text-primary" aria-hidden />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
          {(status === "uploading" || status === "processing") && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-1">
              <p
                className="truncate text-sm font-medium text-foreground leading-tight"
                title={file.name}
              >
                {file.name}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {formatFileSize(fileSize ?? file.size)}
                {isPDF ? " · PDF" : " · Image"}
              </p>
            </div>
            <Badge
              variant={config.variant}
              className={cn(
                "h-5 shrink-0 px-1.5 text-[10px] font-medium uppercase tracking-wide",
                status === "ready" && "bg-primary/90"
              )}
            >
              {status === "ready" && (
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
              )}
              {status === "failed" && (
                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
              )}
              {config.label}
            </Badge>
          </div>

          {config.showProgress && (
            <div className="space-y-1">
              {showIndeterminate ? (
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
                </div>
              ) : (
                <Progress value={progress} className="h-1" />
              )}
              <p className="text-[10px] text-muted-foreground">
                {showIndeterminate
                  ? "Extracting text…"
                  : `Uploading · ${progress}%`}
              </p>
            </div>
          )}

          {status === "failed" && error && (
            <p className="text-[11px] text-destructive line-clamp-2 leading-snug">
              {error}
            </p>
          )}

          {status === "ready" && (
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              Included in itinerary generation
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(id)}
          className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-0.5"
          title="Remove file"
          aria-label={`Remove ${file.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
};

export default FilePreviewCard;
