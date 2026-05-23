import { useParams, Link } from 'react-router-dom';
import { Compass, ArrowRight, Printer } from 'lucide-react';
import { useSharedItineraryQuery } from '@/hooks/queries/useSharedItineraryQuery';
import { getErrorMessage } from '@/lib/apiError';
import { ROUTES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import Loader from '@/components/common/Loader';
import ItineraryTimeline from '@/components/itinerary/ItineraryTimeline';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/ErrorState';

export const SharedItineraryPage = () => {
  const { token } = useParams();
  const { data, isLoading, isError, error } = useSharedItineraryQuery(token);

  let isAuthenticated = false;
  try {
    const auth = useAuth();
    isAuthenticated = auth.isAuthenticated;
  } catch {
    // Public page — auth optional
  }

  if (isLoading) return <Loader variant="fullPage" />;

  if (isError || !data?.itinerary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <Compass className="h-12 w-12 text-muted-foreground" />
        <ErrorState message={getErrorMessage(error, 'Shared itinerary is invalid or has been revoked.')} />
        <Button asChild>
          <Link to={ROUTES.REGISTER}>
            Create your own with TripCraft
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  const { itinerary, ownerName } = data;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm no-print">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-semibold text-lg text-foreground">TripCraft</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            {!isAuthenticated && (
              <Button size="sm" asChild>
                <Link to={ROUTES.REGISTER}>Get started</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="grow container mx-auto px-3 sm:px-4 py-5 sm:py-8 max-w-5xl space-y-4 sm:space-y-8">
        <Card>
          <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6 space-y-2 sm:space-y-3">
            <Badge variant="secondary" className="h-5 text-[10px] sm:text-xs">
              Shared by {ownerName || 'TripCraft Traveler'}
            </Badge>
            <h1 className="text-xl sm:text-4xl font-semibold tracking-tight leading-tight">
              {itinerary.title}
            </h1>
            {itinerary.summary && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {itinerary.summary}
              </p>
            )}
          </CardContent>
        </Card>

        <ItineraryTimeline itinerary={itinerary} />
      </main>
    </div>
  );
};

export default SharedItineraryPage;
