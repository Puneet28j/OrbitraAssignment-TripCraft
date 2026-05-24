import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useGenerateItineraryMutation } from "../hooks/mutations/useGenerateItineraryMutation";
import { getErrorMessage } from "../lib/apiError";
import { ROUTES } from "../lib/constants";
import Layout from "../components/layout/Layout";
import DropzoneUploader from "../components/upload/DropzoneUploader";
import { UploadQueuePanel } from "../components/upload/UploadQueuePanel";
import useUpload from "../hooks/useUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ROTATING_MESSAGES = [
  "Reading your flight confirmations...",
  "Extracting hotel check-in times...",
  "Inferring transit connections...",
  "Analyzing chronologies and travel gaps...",
  "Crafting your custom TripCraft AI itinerary...",
  "Polishing details and descriptions...",
];

export const UploadPage = () => {
  const navigate = useNavigate();
  const {
    uploads,
    uploadFiles,
    removeUpload,
    restoredCount,
    isRestoringUploads,
  } = useUpload();
  const generateMutation = useGenerateItineraryMutation();

  const [generationError, setGenerationError] = useState("");
  const isGenerating = generateMutation.isPending;
  const [messageIndex, setMessageIndex] = useState(0);
  const [collapsedTextItems, setCollapsedTextItems] = useState<
    Record<string, boolean>
  >({});

  // Cycle through premium generation subtexts
  useEffect(() => {
    let interval: number;
    if (isGenerating) {
      interval = window.setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const readyDocuments = uploads.filter(
    (u) =>
      u.status === "ready" &&
      !!u.documentId &&
      (u.extractedText?.trim().length ?? 0) > 0
  );
  const waitingOnText = uploads.filter(
    (u) =>
      u.status === "ready" &&
      !!u.documentId &&
      !(u.extractedText?.trim().length ?? 0)
  );
  const stillProcessing = uploads.filter(
    (u) => u.status === "processing" || u.status === "uploading"
  );
  const isGenerationDisabled =
    readyDocuments.length === 0 || isGenerating || stillProcessing.length > 0;

  const toggleTextCollapse = (id: string) => {
    setCollapsedTextItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleGenerateItinerary = async () => {
    if (isGenerationDisabled) return;

    setGenerationError("");
    const documentIds = readyDocuments.map((doc) => doc.documentId!);

    try {
      const itinerary = await generateMutation.mutateAsync(documentIds);

      // Navigate to the newly generated itinerary detail page
      navigate(ROUTES.ITINERARY_DETAIL_FN(itinerary._id));
    } catch (err: unknown) {
      setGenerationError(
        getErrorMessage(err, "Failed to generate itinerary. Please try again.")
      );
    }
  };

  return (
    <Layout>
      {/* Dynamic Generation Loader Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6 max-w-sm text-center px-4 animate-fade-up">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/20 animate-spin-slow">
              <Sparkles className="h-8 w-8 text-primary animate-pulse-ring" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Creating Your Itinerary
              </h3>
              <p className="text-sm text-muted animate-pulse transition duration-normal">
                {ROTATING_MESSAGES[messageIndex]}
              </p>
            </div>
            <Loader2 className="h-5 w-5 text-primary animate-spin mt-4" />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-5 sm:space-y-8">
        <header className="space-y-1.5 border-b border-border pb-4 sm:pb-5">
          <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Upload documents
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Add tickets and bookings. We extract text locally, then AI builds
            your itinerary.
          </p>
        </header>

        {generationError && (
          <Alert variant="destructive">
            <AlertDescription>{generationError}</AlertDescription>
          </Alert>
        )}

        {stillProcessing.length > 0 && (
          <Alert>
            <AlertDescription>
              {stillProcessing.length === 1
                ? "1 document is still extracting text. Wait until all documents are ready before generating."
                : `${stillProcessing.length} documents are still extracting text. Wait until all are ready before generating.`}
            </AlertDescription>
          </Alert>
        )}

        {waitingOnText.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {waitingOnText.length === 1
                ? "1 document is marked ready but has no extracted text. Remove it and re-upload, or wait for extraction to finish."
                : `${waitingOnText.length} documents are marked ready but have no extracted text. Re-upload or wait for extraction.`}
            </AlertDescription>
          </Alert>
        )}

        {isRestoringUploads && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Loading your saved uploads…</AlertDescription>
          </Alert>
        )}

        {!isRestoringUploads && restoredCount > 0 && (
          <Alert>
            <AlertDescription>
              {restoredCount === 1
                ? "We restored 1 document from your last session. Generate an itinerary or remove it from the queue."
                : `We restored ${restoredCount} documents from your last session. Generate an itinerary or remove any you no longer need.`}
            </AlertDescription>
          </Alert>
        )}

        <DropzoneUploader
          onFilesAccepted={uploadFiles}
          disabled={isGenerating}
        />

        {uploads.length > 0 && (
          <UploadQueuePanel uploads={uploads} onRemove={removeUpload} />
        )}

        {readyDocuments.length > 0 && (
          <section className="space-y-2 pt-2 border-t border-border">
            <h2 className="text-sm font-medium text-foreground">
              Extracted text
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({readyDocuments.length})
              </span>
            </h2>
            <div className="space-y-2">
              {readyDocuments.map((item) => {
                const isCollapsed = collapsedTextItems[item.id] !== false;
                return (
                  <Card key={item.id} className="overflow-hidden py-0 gap-0">
                    <button
                      type="button"
                      onClick={() => toggleTextCollapse(item.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 sm:px-4"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate text-xs sm:text-sm font-medium">
                          {item.file.name}
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {!isCollapsed && (
                      <CardContent className="border-t border-border px-3 py-2.5 sm:px-4 sm:py-3 pt-2.5!">
                        <pre className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
                          {item.extractedText ||
                            "No text extracted from this document."}
                        </pre>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="text-sm font-medium text-foreground">
                {readyDocuments.length > 0
                  ? `${readyDocuments.length} document${readyDocuments.length === 1 ? "" : "s"} ready`
                  : "Upload at least one document"}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {readyDocuments.length > 1
                  ? `All ${readyDocuments.length} documents will be combined into one itinerary.`
                  : "Generate a day-by-day itinerary from extracted content."}
              </p>
            </div>
            <Button
              type="button"
              disabled={isGenerationDisabled}
              onClick={handleGenerateItinerary}
              className="w-full sm:w-auto shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              Generate itinerary
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UploadPage;
