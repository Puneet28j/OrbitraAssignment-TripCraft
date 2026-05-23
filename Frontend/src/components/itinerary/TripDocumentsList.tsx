import { useState } from 'react';
import { FileText, ImageIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/formatters';
import type { TripDocument } from '@/types/document';
import { Badge } from '@/components/ui/badge';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

interface TripDocumentsListProps {
  documents: TripDocument[];
  /** compact = single-line chips for dashboard cards */
  variant?: 'default' | 'compact';
  className?: string;
}

export function TripDocumentsList({
  documents,
  variant = 'default',
  className,
}: TripDocumentsListProps) {
  const [previewDoc, setPreviewDoc] = useState<TripDocument | null>(null);

  if (!documents.length) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        No source documents linked to this trip.
      </p>
    );
  }

  const openPreview = (doc: TripDocument) => setPreviewDoc(doc);

  const previewDialog = (
    <DocumentPreviewDialog
      document={previewDoc}
      open={previewDoc !== null}
      onOpenChange={(open) => {
        if (!open) setPreviewDoc(null);
      }}
    />
  );

  if (variant === 'compact') {
    return (
      <>
        <ul
          className={cn('flex flex-wrap gap-1.5', className)}
          aria-label={`${documents.length} uploaded documents`}
        >
          {documents.map((doc) => (
            <li key={doc._id}>
              <button
                type="button"
                onClick={() => openPreview(doc)}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`View ${doc.originalName}`}
              >
                <DocumentTypeIcon
                  fileType={doc.fileType}
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                />
                <span className="truncate max-w-[9rem] sm:max-w-[14rem]">
                  {doc.originalName}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {previewDialog}
      </>
    );
  }

  return (
    <>
      <ul
        className={cn(
          'divide-y divide-border rounded-lg border border-border overflow-hidden',
          className
        )}
      >
        {documents.map((doc) => (
          <li key={doc._id}>
            <button
              type="button"
              onClick={() => openPreview(doc)}
              className="flex w-full items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 bg-background text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {doc.thumbnailUrl && doc.fileType === 'image' ? (
                  <img
                    src={doc.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <DocumentTypeIcon
                    fileType={doc.fileType}
                    className="h-4 w-4 text-muted-foreground"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {doc.originalName}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {formatFileSize(doc.fileSize)} · Click to view
                </p>
              </div>
              <Badge
                variant="outline"
                className="h-5 shrink-0 text-[10px] uppercase hidden sm:inline-flex"
              >
                {doc.fileType}
              </Badge>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {previewDialog}
    </>
  );
}

function DocumentTypeIcon({
  fileType,
  className,
}: {
  fileType: TripDocument['fileType'];
  className?: string;
}) {
  if (fileType === 'pdf') {
    return <FileText className={className} aria-hidden />;
  }
  return <ImageIcon className={className} aria-hidden />;
}

export default TripDocumentsList;
