import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Compass, ArrowRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useDashboardQuery } from '../hooks/queries/useDashboardQuery';
import { getErrorMessage } from '../lib/apiError';
import { ROUTES } from '../lib/constants';
import Layout from '../components/layout/Layout';
import Loader from '../components/common/Loader';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { TripCard } from '@/components/dashboard/TripCard';

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useDashboardQuery();

  useEffect(() => {
    if (isError) {
      toast.error(getErrorMessage(error, 'Failed to load dashboard'));
    }
  }, [isError, error]);

  if (isLoading) return <Loader variant="fullPage" />;

  const recentItineraries = data?.recentItineraries ?? [];
  const stats = {
    itinerariesCount: data?.itinerariesCount ?? 0,
    documentsCount: data?.documentsCount ?? 0,
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Dashboard
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Hello, {user?.name?.split(' ')[0] || 'Traveler'}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Your trips and the documents used to build each itinerary.
            </p>
          </div>
          <Button onClick={() => navigate(ROUTES.UPLOAD)} className="shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Plan a new trip
          </Button>
        </header>

        {/* Stats */}
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
          <div className="border-r border-border bg-background px-4 py-4 sm:px-5">
            <dt className="text-xs text-muted-foreground">Trips</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {stats.itinerariesCount}
            </dd>
          </div>
          <div className="bg-background px-4 py-4 sm:px-5">
            <dt className="text-xs text-muted-foreground">Documents uploaded</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {stats.documentsCount}
            </dd>
          </div>
        </dl>

        {/* Recent trips */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Recent trips</h2>
            {recentItineraries.length > 0 && (
              <Link
                to={ROUTES.HISTORY}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {recentItineraries.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border divide-y divide-border bg-card">
              {recentItineraries.map((itinerary) => (
                <TripCard key={itinerary._id} itinerary={itinerary} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Compass className="h-6 w-6" />}
              title="No trips yet"
              description="Upload travel documents and generate your first AI itinerary."
              action={
                <Button size="sm" onClick={() => navigate(ROUTES.UPLOAD)}>
                  <Plus className="h-4 w-4" />
                  Plan your first trip
                </Button>
              }
            />
          )}
        </section>
      </div>
    </Layout>
  );
};

export default DashboardPage;
