import { useRef, useEffect, useState } from 'react';
import {
  Plane,
  Building,
  Car,
  Utensils,
  MapPin,
  Sparkles,
  HelpCircle,
  Clock,
  Bookmark,
} from 'lucide-react';
import { formatDate, formatDateShort, formatDuration } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Activity, ActivityType, Itinerary, ItineraryDay } from '@/types/itinerary';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileDayDock } from './MobileDayDock';

const getActivityConfig = (type: ActivityType | string) => {
  switch (type.toLowerCase()) {
    case 'flight':
      return { icon: Plane, label: 'Flight' };
    case 'hotel':
      return { icon: Building, label: 'Accommodation' };
    case 'transport':
      return { icon: Car, label: 'Transport' };
    case 'dining':
      return { icon: Utensils, label: 'Dining' };
    case 'sightseeing':
      return { icon: MapPin, label: 'Sightseeing' };
    case 'activity':
      return { icon: Sparkles, label: 'Activity' };
    default:
      return { icon: HelpCircle, label: 'Other' };
  }
};

interface ItineraryTimelineProps {
  itinerary: Itinerary;
  showDayTabs?: boolean;
}

export function ItineraryTimeline({ itinerary, showDayTabs = true }: ItineraryTimelineProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const days = itinerary.days ?? [];

  const hasDayTabs = showDayTabs && days.length > 1;

  return (
    <div
      className={cn(
        'space-y-4 sm:space-y-6',
        hasDayTabs &&
          'pb-[calc(9.5rem+env(safe-area-inset-bottom,0))] sm:pb-0'
      )}
    >
      {hasDayTabs && (
        <>
          <DayNavigator
            days={days}
            activeDayIndex={activeDayIndex}
            onDayChange={setActiveDayIndex}
          />
          <MobileDayDock
            days={days}
            activeDayIndex={activeDayIndex}
            onDayChange={setActiveDayIndex}
          />
        </>
      )}

      <div className="space-y-5 sm:space-y-8">
        {days.map((day: ItineraryDay, idx: number) => {
          const isDayVisible = activeDayIndex === idx || days.length <= 1;
          return (
            <div
              key={day.dayNumber}
              className={cn(
                'space-y-3 sm:space-y-5 mb-8 sm:mb-10 last:mb-0',
                isDayVisible ? 'block' : 'hidden print:block'
              )}
            >
              <DaySection
                day={day}
                showHeader={isDayVisible}
                hideHeaderOnMobile={hasDayTabs}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayNavigatorProps {
  days: ItineraryDay[];
  activeDayIndex: number;
  onDayChange: (index: number) => void;
}

function DayNavigator({ days, activeDayIndex, onDayChange }: DayNavigatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-day-index="${activeDayIndex}"]`
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeDayIndex]);

  return (
    <div className="no-print hidden sm:block">
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className={cn(
            'flex gap-1.5 min-w-max px-0.5',
            'sm:py-0.5'
          )}
          role="tablist"
          aria-label="Trip days"
        >
          {days.map((day, idx) => {
            const isActive = idx === activeDayIndex;
            return (
              <button
                key={day.dayNumber}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-day-index={idx}
                onClick={() => onDayChange(idx)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-left transition-colors sm:px-3 sm:py-1.5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className="block text-[11px] sm:text-xs font-semibold leading-none">
                  Day {day.dayNumber}
                </span>
                {day.date && (
                  <span
                    className={cn(
                      'block text-[10px] sm:text-[11px] mt-0.5 leading-none',
                      isActive ? 'text-primary-foreground/85' : 'text-muted-foreground'
                    )}
                  >
                    {formatDateShort(day.date)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DaySection({
  day,
  showHeader = true,
  hideHeaderOnMobile = false,
}: {
  day: ItineraryDay;
  showHeader?: boolean;
  /** Avoid duplicating the mobile day navigator card */
  hideHeaderOnMobile?: boolean;
}) {
  return (
    <>
      {showHeader && hideHeaderOnMobile && (
        <div className="sm:hidden pb-2 border-b border-border">
          <p className="text-base font-semibold text-foreground leading-tight">
            Day {day.dayNumber}
            {day.date && (
              <span className="font-normal text-muted-foreground">
                {' '}
                · {formatDateShort(day.date)}
              </span>
            )}
          </p>
          {day.title && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{day.title}</p>
          )}
        </div>
      )}

      {showHeader && (
        <div
          className={cn(
            'flex-col gap-0.5 sm:flex sm:flex-row sm:items-baseline sm:gap-3 pb-2 border-b border-border',
            hideHeaderOnMobile ? 'hidden sm:flex' : 'flex'
          )}
        >
          <h2 className="text-lg sm:text-2xl font-semibold text-foreground">
            Day {day.dayNumber}
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-muted-foreground">
            {day.date && (
              <span className="font-mono">{formatDate(day.date)}</span>
            )}
            {day.title && day.date && (
              <span className="hidden sm:inline text-border">|</span>
            )}
            {day.title && <span className="truncate max-w-full">{day.title}</span>}
          </div>
        </div>
      )}

      {day.activities && day.activities.length > 0 ? (
        <div className="relative pl-5 sm:pl-8 border-l border-border ml-2 sm:ml-4 space-y-2.5 sm:space-y-4">
          {day.activities.map((activity, actIdx) => (
            <ActivityItem key={activity._id ?? actIdx} activity={activity} />
          ))}
        </div>
      ) : (
        <Card className="p-4 sm:p-6 text-center text-xs sm:text-sm text-muted-foreground">
          No scheduled activities for this day.
        </Card>
      )}
    </>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const cfg = getActivityConfig(activity.type);
  const ActivityIcon = cfg.icon;

  return (
    <div className="relative">
      <div className="absolute -left-[1.625rem] sm:-left-11 top-1 h-5 w-5 sm:h-7 sm:w-7 rounded-full border border-border bg-muted flex items-center justify-center">
        <ActivityIcon className="h-2.5 w-2.5 sm:h-4 sm:w-4 text-muted-foreground" />
      </div>
      <Card className="p-3 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-2.5">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {activity.time && (
                <Badge
                  variant="secondary"
                  className="h-5 gap-0.5 px-1.5 text-[10px] sm:text-xs font-mono"
                >
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {activity.time}
                </Badge>
              )}
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:text-xs">
                {cfg.label}
              </Badge>
              {activity.duration && (
                <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                  · {formatDuration(activity.duration)}
                </span>
              )}
            </div>
            <h4 className="text-sm sm:text-lg font-medium text-foreground leading-snug">
              {activity.title}
            </h4>
          </div>
          {activity.bookingRef && (
            <Badge
              variant="secondary"
              className="h-5 font-mono text-[10px] sm:text-xs self-start shrink-0 max-w-full truncate"
            >
              <Bookmark className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 shrink-0" />
              {activity.bookingRef}
            </Badge>
          )}
        </div>
        {activity.description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-2">
            {activity.description}
          </p>
        )}
        {activity.location && (
          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary hover:underline truncate"
            >
              {activity.location}
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}

export default ItineraryTimeline;
