import { NavLink } from 'react-router-dom';
import { Compass, UploadCloud, History } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Home', path: ROUTES.DASHBOARD, icon: Compass },
  { label: 'Upload', path: ROUTES.UPLOAD, icon: UploadCloud },
  { label: 'Trips', path: ROUTES.HISTORY, icon: History },
] as const;

/**
 * Primary app navigation — fixed bottom bar on mobile/tablet portrait.
 */
export function MobileBottomNav() {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 md:hidden',
        'pb-[env(safe-area-inset-bottom,0px)]'
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                      isActive && 'bg-primary/10'
                    )}
                  >
                    <Icon
                      className={cn('h-5 w-5', isActive && 'stroke-[2.25px]')}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none',
                      isActive && 'text-primary'
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
