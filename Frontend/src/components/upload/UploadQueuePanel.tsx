import type { UploadItem } from "@/hooks/useUpload";
import { FilePreviewCard } from "./FilePreviewCard";
import { Badge } from "@/components/ui/badge";

interface UploadQueuePanelProps {
  uploads: UploadItem[];
  onRemove: (id: string) => void;
}

export function UploadQueuePanel({ uploads, onRemove }: UploadQueuePanelProps) {
  const ready = uploads.filter((u) => u.status === "ready").length;
  const processing = uploads.filter(
    (u) => u.status === "uploading" || u.status === "processing"
  ).length;
  const failed = uploads.filter((u) => u.status === "failed").length;

  return (
    <section className="space-y-2.5 sm:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">
          Upload queue
          <span className="ml-1.5 text-muted-foreground font-normal tabular-nums">
            ({uploads.length})
          </span>
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ready > 0 && (
            <Badge variant="default" className="h-5 text-[10px] px-1.5">
              {ready} ready
            </Badge>
          )}
          {processing > 0 && (
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
              {processing} in progress
            </Badge>
          )}
          {failed > 0 && (
            <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
              {failed} failed
            </Badge>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {uploads.map((item) => (
          <li key={item.id}>
            <FilePreviewCard
              id={item.id}
              file={item.file}
              progress={item.progress}
              status={item.status}
              error={item.error}
              fileSize={item.fileSize}
              fileType={item.fileType}
              thumbnailUrl={item.thumbnailUrl}
              previewUrl={item.previewUrl}
              onRemove={onRemove}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default UploadQueuePanel;
