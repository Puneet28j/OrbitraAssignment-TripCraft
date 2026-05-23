import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Printer, Calendar, MapPin } from 'lucide-react';
import { useItineraryQuery } from '@/hooks/queries/useItineraryQuery';
import { getErrorMessage } from '@/lib/apiError';
import { ROUTES } from '@/lib/constants';
import { formatDate } from '@/lib/formatters';
import Layout from '@/components/layout/Layout';
import Loader from '@/components/common/Loader';
import ShareModal from '@/components/itinerary/ShareModal';
import ItineraryTimeline from '@/components/itinerary/ItineraryTimeline';
import { TripDocumentsSection } from '@/components/itinerary/TripDocumentsSection';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/ErrorState';

export const ItineraryDetailPage = () => {
  const { id } = useParams();
  const { data: itinerary, isLoading, isError, error, refetch } = useItineraryQuery(id);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  if (isLoading) return <Loader variant="fullPage" />;

  if (isError || !itinerary) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-12 space-y-4">
          <ErrorState
            message={isError ? getErrorMessage(error) : 'Itinerary not found'}
            onRetry={isError ? () => refetch() : undefined}
          />
          <Link to={ROUTES.DASHBOARD} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @media print {
          header, footer, nav, button, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-8 print-full-width">
        <div className="flex items-center justify-between gap-2 no-print">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link to={ROUTES.DASHBOARD}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline sm:ml-1">Back</span>
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5"
              onClick={() => setIsShareModalOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6 space-y-2.5 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge variant="secondary" className="h-5 gap-1 text-[10px] sm:text-xs">
                <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {itinerary.destination}
              </Badge>
              {itinerary.startDate && (
                <Badge variant="outline" className="h-5 gap-1 text-[10px] sm:text-xs">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {formatDate(itinerary.startDate)}
                  {itinerary.endDate && ` – ${formatDate(itinerary.endDate)}`}
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">
              {itinerary.title}
            </h1>
            {itinerary.summary && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl border-l-2 border-primary/30 pl-3 sm:pl-4">
                {itinerary.summary}
              </p>
            )}
          </CardContent>
        </Card>

        {(itinerary.documents?.length ?? 0) > 0 && (
          <TripDocumentsSection documents={itinerary.documents!} />
        )}

        <ItineraryTimeline itinerary={itinerary} />
      </div>

      <ShareModal
        itineraryId={itinerary._id}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        isInitialPublic={itinerary.isPublic}
        initialShareToken={itinerary.shareToken}
      />
    </Layout>
  );
};

export default ItineraryDetailPage;
