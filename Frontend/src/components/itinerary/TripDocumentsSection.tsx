import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TripDocument } from '@/types/document';
import { Badge } from '@/components/ui/badge';
import { TripDocumentsList } from './TripDocumentsList';

interface TripDocumentsSectionProps {
  documents: TripDocument[];
  /** Start expanded (default: collapsed to save space) */
  defaultOpen?: boolean;
  className?: string;
}

export function TripDocumentsSection({
  documents,
  defaultOpen = false,
  className,
}: TripDocumentsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const count = documents.length;

  if (count === 0) return null;

  const panelId = 'trip-source-documents-panel';

  return (
    <section className={cn('no-print', className)}>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          id="trip-source-documents-trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 sm:px-4 sm:py-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Source documents
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
              {count}
            </Badge>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            aria-hidden
          />
        </button>

        <div
          id={panelId}
          role="region"
          aria-labelledby="trip-source-documents-trigger"
          hidden={!isOpen}
          className="border-t border-border"
        >
          <div className="space-y-2 px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Tap a file to preview the full document.
            </p>
            <TripDocumentsList documents={documents} variant="compact" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default TripDocumentsSection;
