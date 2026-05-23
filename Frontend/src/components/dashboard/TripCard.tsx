import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, FileText, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { ROUTES } from '@/lib/constants';
import type { Itinerary } from '@/types/itinerary';
import { TripDocumentsList } from '@/components/itinerary/TripDocumentsList';
import { cn } from '@/lib/utils';

interface TripCardProps {
  itinerary: Itinerary;
  className?: string;
}

export function TripCard({ itinerary, className }: TripCardProps) {
  const documents = itinerary.documents ?? [];
  const dayCount = itinerary.days?.length ?? 0;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article
      className={cn(
        'group relative block px-4 py-3 sm:px-5 sm:py-3.5 transition-colors hover:bg-muted/30',
        className
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-4">
          <Link
            to={ROUTES.ITINERARY_DETAIL_FN(itinerary._id)}
            className="min-w-0 flex-1 space-y-1.5 focus:outline-none"
          >
            {/* Title */}
            <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
              {itinerary.title}
            </h3>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/75" />
                {itinerary.destination}
              </span>
              
              {itinerary.startDate && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                    {formatDate(itinerary.startDate)}
                    {itinerary.endDate && ` – ${formatDate(itinerary.endDate)}`}
                  </span>
                </>
              )}

              {dayCount > 0 && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span>
                    {dayCount} {dayCount === 1 ? 'day' : 'days'}
                  </span>
                </>
              )}
            </div>
          </Link>

          {/* Action Arrow Button */}
          <Link
            to={ROUTES.ITINERARY_DETAIL_FN(itinerary._id)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background shadow-sm hover:border-primary/30 group-hover:text-primary transition-all self-center shrink-0"
            aria-label={`View itinerary for ${itinerary.title}`}
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* Collapsible toggle & Document list */}
        {documents.length > 0 && (
          <div className="relative z-10 flex flex-col gap-1.5">
            <div>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded"
              >
                <FileText className="h-3 w-3" />
                <span>
                  {documents.length} source file{documents.length === 1 ? '' : 's'}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/70" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                )}
              </button>
            </div>

            {/* Documents content with premium collapsible CSS Grid height transition */}
            <div
              className={cn(
                "grid transition-all duration-200 ease-in-out",
                isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 pointer-events-none"
              )}
            >
              <div className="overflow-hidden">
                <TripDocumentsList documents={documents} variant="compact" />
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default TripCard;
