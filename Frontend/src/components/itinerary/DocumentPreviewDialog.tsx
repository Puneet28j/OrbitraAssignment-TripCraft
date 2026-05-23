import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { uploadService } from '@/services/uploadService';
import { getErrorMessage } from '@/lib/apiError';
import type { TripDocument } from '@/types/document';

interface DocumentPreviewDialogProps {
  document: TripDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentPreviewDialog({
  document,
  open,
  onOpenChange,
}: DocumentPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !document) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setError(null);
    setPreviewUrl(null);

    uploadService
      .fetchDocumentPreviewUrl(document._id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPreviewUrl(url);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Could not load document preview'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open, document?._id]);

  if (!document) return null;

  const isPdf = document.fileType === 'pdf';

  const handleOpenNewTab = () => {
    if (!previewUrl) return;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[min(90dvh,880px)] max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-full [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]]:right-3"
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 sm:px-5">
          <DialogTitle className="truncate text-base font-medium">
            {document.originalName}
          </DialogTitle>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/20">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-center text-sm text-destructive">{error}</p>
            </div>
          )}

          {!isLoading && !error && previewUrl && (
            <>
              {isPdf ? (
                <iframe
                  src={previewUrl}
                  title={document.originalName}
                  className="h-full w-full border-0 bg-background"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center overflow-auto p-3 sm:p-4">
                  <img
                    src={previewUrl}
                    alt={document.originalName}
                    className="max-h-full max-w-full object-contain rounded-md border border-border bg-background"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="!m-0 shrink-0 gap-2 rounded-none border-t border-border bg-background px-4 py-3 sm:px-5 sm:py-3.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!previewUrl}
            onClick={handleOpenNewTab}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentPreviewDialog;
