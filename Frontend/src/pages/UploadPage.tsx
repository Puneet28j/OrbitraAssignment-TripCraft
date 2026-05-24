import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, X } from "lucide-react";
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
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true);
  const [skipAutoForBatch, setSkipAutoForBatch] = useState(false);
  const autoTriggeredRef = useRef(false);
  const batchIdRef = useRef(0);

  const isGenerating = generateMutation.isPending;

  const readyDocuments = uploads.filter(
    (u) => u.status === "ready" && !!u.documentId
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
  const failedCount = uploads.filter((u) => u.status === "failed").length;
  const allTerminal =
    uploads.length > 0 &&
    stillProcessing.length === 0 &&
    uploads.every((u) => u.status === "ready" || u.status === "failed");

  const isGenerationDisabled =
    readyDocuments.length === 0 || isGenerating || stillProcessing.length > 0;

  const runGeneration = useCallback(
    async (documentIds: string[]) => {
      if (documentIds.length === 0) return;

      setGenerationError("");
      try {
        const itinerary = await generateMutation.mutateAsync(documentIds);
        navigate(ROUTES.ITINERARY_DETAIL_FN(itinerary._id));
      } catch (err: unknown) {
        setGenerationError(
          getErrorMessage(err, "Failed to generate itinerary. Please try again.")
        );
        autoTriggeredRef.current = false;
      }
    },
    [generateMutation, navigate]
  );

  const handleGenerateItinerary = () => {
    if (isGenerationDisabled) return;
    const documentIds = readyDocuments.map((doc) => doc.documentId!);
    void runGeneration(documentIds);
  };

  const handleCancelAuto = () => {
    setSkipAutoForBatch(true);
    setAutoGenerateEnabled(false);
  };

  useEffect(() => {
    if (uploads.some((u) => u.status === "uploading" || u.status === "processing")) {
      batchIdRef.current += 1;
      autoTriggeredRef.current = false;
      setSkipAutoForBatch(false);
    }
  }, [uploads]);

  useEffect(() => {
    if (
      !autoGenerateEnabled ||
      skipAutoForBatch ||
      !allTerminal ||
      readyDocuments.length === 0 ||
      isGenerating ||
      autoTriggeredRef.current
    ) {
      return;
    }

    autoTriggeredRef.current = true;
    const documentIds = readyDocuments.map((d) => d.documentId!);
    void runGeneration(documentIds);
  }, [
    allTerminal,
    autoGenerateEnabled,
    skipAutoForBatch,
    readyDocuments,
    isGenerating,
    runGeneration,
  ]);

  const phaseLabel = stillProcessing.length > 0
    ? "Extracting text from your documents…"
    : isGenerating
    ? "Building your itinerary…"
    : "";

  return (
    <Layout>
      {(isGenerating || stillProcessing.length > 0) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6 max-w-sm text-center px-4 animate-fade-up">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                {isGenerating ? "Building itinerary" : "Extracting documents"}
              </h3>
              <p className="text-sm text-muted-foreground">{phaseLabel}</p>
            </div>
            {!isGenerating && stillProcessing.length > 0 && autoGenerateEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelAuto}
              >
                <X className="h-4 w-4" />
                Cancel auto-generate
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-5 sm:space-y-8">
        <header className="space-y-1.5 border-b border-border pb-4 sm:pb-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Upload documents
          </p>
          <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Upload documents
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Add tickets and bookings. We extract text and barcodes locally, then
            build your itinerary automatically when ready.
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
                ? "1 document is still extracting. Your itinerary will generate when it finishes."
                : `${stillProcessing.length} documents are still extracting. Your itinerary will generate when all finish.`}
            </AlertDescription>
          </Alert>
        )}

        {failedCount > 0 && allTerminal && (
          <Alert variant="destructive">
            <AlertDescription>
              {failedCount === 1
                ? "1 document failed extraction and will be skipped."
                : `${failedCount} documents failed extraction and will be skipped.`}
            </AlertDescription>
          </Alert>
        )}

        {waitingOnText.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {waitingOnText.length === 1
                ? "1 document is marked ready but has no extracted text. Remove it and re-upload."
                : `${waitingOnText.length} documents are ready but missing text. Re-upload or wait.`}
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
                ? "We restored 1 document from your last session."
                : `We restored ${restoredCount} documents from your last session.`}
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

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="text-sm font-medium text-foreground">
                {readyDocuments.length > 0
                  ? `${readyDocuments.length} document${readyDocuments.length === 1 ? "" : "s"} ready`
                  : "Upload at least one document"}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {autoGenerateEnabled && !skipAutoForBatch
                  ? "Itinerary generates automatically when extraction finishes."
                  : "Click generate when you are ready."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {!autoGenerateEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setAutoGenerateEnabled(true);
                    setSkipAutoForBatch(false);
                    autoTriggeredRef.current = false;
                  }}
                >
                  Enable auto-generate
                </Button>
              )}
              <Button
                type="button"
                disabled={isGenerationDisabled}
                onClick={handleGenerateItinerary}
                className="w-full sm:w-auto shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                {skipAutoForBatch || !autoGenerateEnabled
                  ? "Generate itinerary"
                  : "Generate now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UploadPage;
