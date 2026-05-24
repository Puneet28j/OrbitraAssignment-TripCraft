import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, Trash2, ArrowRight, Compass, ArrowUpDown, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useItineraryHistoryQuery } from '../hooks/queries/useItineraryHistoryQuery';
import { useDeleteItineraryMutation } from '../hooks/mutations/useDeleteItineraryMutation';
import { ROUTES } from '../lib/constants';
import { formatDate, formatDestinationShort } from '../lib/formatters';
import Layout from '../components/layout/Layout';
import Loader from '../components/common/Loader';
import type { Itinerary } from '../types/itinerary';

export const HistoryPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const limit = 6;
  const { data, isLoading, isError } = useItineraryHistoryQuery({ page, limit, sort: sortBy });
  const deleteMutation = useDeleteItineraryMutation();

  const itineraries = data?.itineraries ?? [];
  const meta = data?.meta ?? { page: 1, limit, total: 0, totalPages: 1 };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId, {
      onSuccess: () => setDeletingId(null),
    });
  };

  const filteredItineraries = itineraries.filter(
    (itin: Itinerary) =>
      itin.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itin.destination?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete itinerary</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-5xl mx-auto space-y-8 animate-fade-up">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">Travel History</h1>
          <p className="text-sm sm:text-base text-secondary max-w-2xl">Browse and manage all travel itineraries created with TripCraft.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between no-print">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input type="text" placeholder="Search by destination or trip title..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-2 border border-border focus:border-primary rounded-md py-2 pl-9 pr-4 text-sm text-foreground outline-none transition duration-fast placeholder:text-muted/60" />
          </div>
          <button onClick={() => { setSortBy((prev) => (prev === 'newest' ? 'oldest' : 'newest')); setPage(1); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-border hover:border-accent-border/40 hover:bg-surface-2 text-foreground text-xs font-semibold rounded-md py-2.5 px-4 transition duration-fast active:scale-95 outline-none shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Sort: {sortBy === 'newest' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader variant="inline" /></div>
        ) : isError ? (
          <div className="card p-8 border border-destructive/30 text-center text-destructive text-sm">
            Failed to load itineraries. Please try again.
          </div>
        ) : filteredItineraries.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItineraries.map((itinerary) => (
                <Card key={itinerary._id}
                  className="p-5 flex flex-col justify-between h-48 relative group hover:border-primary/30 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] uppercase tracking-wider max-w-[85%] min-w-0 shrink"
                        title={itinerary.destination}
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {formatDestinationShort(itinerary.destination, 32)}
                        </span>
                      </Badge>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDeletingId(itinerary._id); }}
                        className="p-1.5 rounded border border-border hover:border-destructive/30 hover:bg-destructive/10 text-muted hover:text-destructive transition duration-fast active:scale-95" title="Delete itinerary">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h4 onClick={() => navigate(ROUTES.ITINERARY_DETAIL_FN(itinerary._id))}
                      className="font-semibold text-base text-foreground group-hover:text-primary transition duration-fast cursor-pointer line-clamp-2 pr-6">{itinerary.title}</h4>
                    {(itinerary.documents?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {itinerary.documents!.length} document{itinerary.documents!.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div onClick={() => navigate(ROUTES.ITINERARY_DETAIL_FN(itinerary._id))}
                    className="flex items-center justify-between text-xs text-muted mt-4 pt-3 border-t border-border/30 cursor-pointer">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="h-3.5 w-3.5" />{itinerary.startDate ? formatDate(itinerary.startDate) : 'No dates'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-accent font-medium group-hover:underline">
                      <span>View details</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition duration-fast" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>

            {meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-6 no-print">
                <button disabled={meta.page === 1} onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 border border-border hover:bg-surface-2 text-foreground text-xs font-semibold rounded-md py-2 px-3 transition duration-fast active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                  <ChevronLeft className="h-3.5 w-3.5" /><span>Previous</span>
                </button>
                <span className="text-xs text-secondary font-mono">Page {meta.page} of {meta.totalPages}</span>
                <button disabled={meta.page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 border border-border hover:bg-surface-2 text-foreground text-xs font-semibold rounded-md py-2 px-3 transition duration-fast active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                  <span>Next</span><ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card glass p-12 border border-dashed border-border/85 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-surface-2 border border-border flex items-center justify-center">
              <Compass className="h-6 w-6 text-muted" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-medium text-foreground">{searchTerm ? 'No matching itineraries found' : 'No travel history yet'}</p>
              <p className="text-xs text-muted leading-normal">{searchTerm ? 'Try modifying your search keywords.' : 'Start planning by uploading reservations.'}</p>
            </div>
            {!searchTerm && (
              <button onClick={() => navigate(ROUTES.UPLOAD)}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md py-2 px-4 hover:opacity-90 active:scale-95 transition duration-fast outline-none">
                <span>Plan a New Trip</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HistoryPage;
