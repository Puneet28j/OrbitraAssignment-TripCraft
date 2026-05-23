import { useState, useEffect } from 'react';
import { Copy, Check, ShieldAlert, Globe, Link2 } from 'lucide-react';
import { useShareItineraryMutation } from '@/hooks/mutations/useShareItineraryMutation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ShareModalProps {
  itineraryId: string;
  isOpen: boolean;
  onClose: () => void;
  isInitialPublic?: boolean;
  initialShareToken?: string | null;
}

export const ShareModal = ({
  itineraryId,
  isOpen,
  onClose,
  isInitialPublic = false,
  initialShareToken = null,
}: ShareModalProps) => {
  const [isPublic, setIsPublic] = useState(isInitialPublic);
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [copied, setCopied] = useState(false);
  const shareMutation = useShareItineraryMutation();

  useEffect(() => {
    if (isOpen) {
      setIsPublic(isInitialPublic);
      setShareToken(initialShareToken);
    }
  }, [isOpen, isInitialPublic, initialShareToken]);

  const shareUrl = shareToken ? `${window.location.origin}/shared/${shareToken}` : '';

  const handlePublicChange = (enabled: boolean) => {
    shareMutation.mutate(
      { itineraryId, enable: enabled },
      {
        onSuccess: (data, { enable }) => {
          if (enable) {
            setIsPublic(true);
            setShareToken(data?.shareToken ?? null);
          } else {
            setIsPublic(false);
            setShareToken(null);
          }
        },
      }
    );
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Share itinerary
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can view this trip timeline. Your raw documents stay private.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="share-public" className="text-sm font-medium">
              Public access
            </Label>
            <p className="text-xs text-muted-foreground">
              {isPublic ? 'Link is active' : 'Enable a shareable link'}
            </p>
          </div>
          <Switch
            id="share-public"
            size="sm"
            checked={isPublic}
            disabled={shareMutation.isPending}
            onCheckedChange={handlePublicChange}
            aria-label="Enable public sharing"
          />
        </div>

        {isPublic && shareUrl && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Shareable link
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative grow min-w-0">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="h-8 pl-8 font-mono text-[11px] sm:text-xs"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="h-8 shrink-0 px-2.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="sr-only">{copied ? 'Copied' : 'Copy link'}</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 p-2.5 sm:p-3 text-[11px] sm:text-xs rounded-md bg-muted/30 border text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 mt-0.5" />
          <p>
            Only the generated timeline is shared. Passports, invoices, and other uploads remain
            private.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;
