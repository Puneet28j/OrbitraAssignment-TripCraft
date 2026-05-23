/**
 * Reusable Loader component supporting fullPage, inline, and skeleton shimmer variants.
 */
export const Loader = ({ variant = 'inline', className = '' }: { variant?: 'fullPage' | 'inline' | 'skeleton'; className?: string }) => {
  if (variant === 'fullPage') {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm ${className}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin-slow rounded-full border-4 border-primary border-t-transparent animate-pulse-ring" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">TripCraft is loading...</p>
        </div>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="h-4 w-2/3 animate-shimmer rounded bg-muted" />
        <div className="h-4 w-full animate-shimmer rounded bg-muted" />
        <div className="h-4 w-4/5 animate-shimmer rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
};

export default Loader;
