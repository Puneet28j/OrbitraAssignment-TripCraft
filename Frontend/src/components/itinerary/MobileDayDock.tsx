import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateShort } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ItineraryDay } from '@/types/itinerary';
import { Button } from '@/components/ui/button';

interface MobileDayDockProps {
  days: ItineraryDay[];
  activeDayIndex: number;
  onDayChange: (index: number) => void;
}

/**
 * Fixed bottom bar for switching itinerary days on mobile.
 */
export function MobileDayDock({
  days,
  activeDayIndex,
  onDayChange,
}: MobileDayDockProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canPrev = activeDayIndex > 0;
  const canNext = activeDayIndex < days.length - 1;

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-dock-day="${activeDayIndex}"]`
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeDayIndex]);

  return (
    <div
      className="fixed inset-x-0 z-40 sm:hidden no-print pointer-events-none bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))]"
      aria-label="Day navigation"
    >
      <div className="pointer-events-auto mx-3 mb-2">
        <nav className="flex items-center gap-1 rounded-2xl border border-border/80 bg-background/92 p-1.5 shadow-lg shadow-black/10 ring-1 ring-foreground/5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Previous day"
            disabled={!canPrev}
            onClick={() => onDayChange(activeDayIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            ref={scrollRef}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory px-0.5"
            role="tablist"
          >
            {days.map((day, idx) => {
              const isActive = idx === activeDayIndex;
              return (
                <button
                  key={day.dayNumber}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-dock-day={idx}
                  onClick={() => onDayChange(idx)}
                  className={cn(
                    'flex shrink-0 snap-center flex-col items-center justify-center rounded-xl px-3 py-1.5 min-w-[3.25rem] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  <span className="text-[11px] font-semibold leading-none tabular-nums">
                    D{day.dayNumber}
                  </span>
                  {day.date && (
                    <span
                      className={cn(
                        'mt-0.5 text-[9px] leading-none font-mono',
                        isActive
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    >
                      {formatDateShort(day.date)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Next day"
            disabled={!canNext}
            onClick={() => onDayChange(activeDayIndex + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </div>
  );
}

export default MobileDayDock;
