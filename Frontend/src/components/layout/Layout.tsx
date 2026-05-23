import type { ReactNode } from 'react';
import AppHeader from './AppHeader';
import { MobileBottomNav } from './MobileBottomNav';

/** Space for fixed mobile bottom tab bar (+ safe area). */
const MOBILE_NAV_OFFSET =
  'pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-0';

export const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <AppHeader />
      <main
        className={`grow container mx-auto px-4 py-6 sm:py-8 relative z-10 ${MOBILE_NAV_OFFSET}`}
      >
        {children}
      </main>
      <footer className="hidden md:block border-t border-border/40 py-6 text-center text-xs text-muted font-mono bg-background/50">
        <p>
          &copy; {new Date().getFullYear()} TripCraft AI Itinerary Planner · All
          rights reserved.
        </p>
      </footer>
      <MobileBottomNav />
    </div>
  );
};

export default Layout;
