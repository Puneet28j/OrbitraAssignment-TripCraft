import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadService } from "../services/uploadService";
import type { CloudinaryUploadResult } from "../services/uploadService";
import { useDeleteDocumentMutation } from "./mutations/useDeleteDocumentMutation";
import { useUnassignedDocumentsQuery } from "./queries/useUnassignedDocumentsQuery";
import { queryKeys } from "./queries/queryKeys";
import { getErrorMessage } from "../lib/apiError";
import { runPool } from "../lib/runPool";
import type {
  DocumentFileType,
  DocumentStatus,
  UnassignedDocument,
} from "../types/document";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "processing" | "ready" | "failed";
  error?: string;
  documentId?: string;
  extractedText?: string;
  fileSize?: number;
  fileType?: DocumentFileType;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  /** Loaded from the server after a page reload (not a fresh local pick). */
  restored?: boolean;
}

const UPLOAD_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 90;
const MAX_CONSECUTIVE_ERRORS = 3;

type SignatureParams = Awaited<ReturnType<typeof uploadService.getSignature>>;

function mapDocumentStatusToUpload(
  status: DocumentStatus
): UploadItem["status"] {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  return "processing";
}

function unassignedToUploadItem(doc: UnassignedDocument): UploadItem {
  const uploadStatus = mapDocumentStatusToUpload(doc.status);
  const isComplete = uploadStatus === "ready";
  return {
    id: `restored-${doc._id}`,
    file: new File([], doc.originalName, { type: doc.mimeType }),
    progress: isComplete ? 100 : 0,
    status: uploadStatus,
    documentId: doc._id,
    extractedText: doc.extractedText ?? undefined,
    error: doc.errorMessage ?? undefined,
    restored: true,
    fileSize: doc.fileSize,
    fileType: doc.fileType,
    thumbnailUrl: doc.thumbnailUrl ?? undefined,
  };
}

export const useUpload = () => {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [restoredCount, setRestoredCount] = useState(0);
  const queryClient = useQueryClient();
  const deleteDocumentMutation = useDeleteDocumentMutation();
  const unassignedQuery = useUnassignedDocumentsQuery();
  const hasRestoredRef = useRef(false);

  const pollIntervalRef = useRef<number | null>(null);
  const pendingByDocId = useRef<Map<string, string>>(new Map());
  const pollCounts = useRef<Record<string, number>>({});
  const pollErrors = useRef<Record<string, number>>({});
  const batchTotals = useRef<{
    ready: number;
    failed: number;
    total: number;
  } | null>(null);

  const stopPollingIfIdle = useCallback(() => {
    if (pendingByDocId.current.size === 0 && pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const markUploadFromStatus = useCallback(
    (
      uploadId: string,
      status: "ready" | "failed",
      errorMessage?: string,
      extractedText?: string,
      extractionIssues?: string[]
    ) => {
      const isComplete = status === "ready";
      setUploads((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                status,
                progress: isComplete ? 100 : item.progress,
                error: status === "failed" ? errorMessage : undefined,
                ...(isComplete && extractedText !== undefined
                  ? { extractedText }
                  : {}),
              }
            : item
        )
      );

      if (status === "ready" && extractionIssues?.length) {
        toast.warning("Extraction completed with warnings", {
          description: extractionIssues[0],
        });
      }

      if (batchTotals.current) {
        if (isComplete) {
          batchTotals.current.ready += 1;
        } else {
          batchTotals.current.failed += 1;
        }

        const { ready, failed, total } = batchTotals.current;
        if (ready + failed >= total) {
          if (failed === 0) {
            toast.success(
              total === 1
                ? "Document ready for itinerary generation"
                : `All ${total} documents are ready for itinerary generation`
            );
          } else if (ready === 0) {
            toast.error("Text extraction failed for all documents");
          } else {
            toast.warning(
              `${ready} of ${total} documents ready; ${failed} failed extraction`
            );
          }
          batchTotals.current = null;
        }
      }
    },
    []
  );

  const pollPendingDocuments = useCallback(async () => {
    const entries = Array.from(pendingByDocId.current.entries());
    if (entries.length === 0) {
      stopPollingIfIdle();
      return;
    }

    await Promise.all(
      entries.map(async ([docId, uploadId]) => {
        pollCounts.current[docId] = (pollCounts.current[docId] ?? 0) + 1;

        if (pollCounts.current[docId] > MAX_POLLS) {
          pendingByDocId.current.delete(docId);
          delete pollCounts.current[docId];
          delete pollErrors.current[docId];
          markUploadFromStatus(
            uploadId,
            "failed",
            "Text extraction timed out. Please try again."
          );
          return;
        }

        try {
          const statusData = await queryClient.fetchQuery({
            queryKey: queryKeys.documents.status(docId),
            queryFn: () => uploadService.getDocumentStatus(docId),
          });
          pollErrors.current[docId] = 0;

          if (statusData.status === "ready") {
            pendingByDocId.current.delete(docId);
            delete pollCounts.current[docId];
            delete pollErrors.current[docId];
            const issues = (
              statusData.extractionMeta as
                | { extractionIssues?: string[] }
                | undefined
            )?.extractionIssues;
            markUploadFromStatus(
              uploadId,
              "ready",
              undefined,
              statusData.extractedText ?? "",
              issues
            );
          } else if (statusData.status === "failed") {
            pendingByDocId.current.delete(docId);
            delete pollCounts.current[docId];
            delete pollErrors.current[docId];
            markUploadFromStatus(
              uploadId,
              "failed",
              statusData.errorMessage || "Text extraction failed"
            );
          }
        } catch (err: unknown) {
          const axiosErr = err as { response?: { status?: number } };
          if (
            axiosErr?.response?.status === 401 ||
            axiosErr?.response?.status === 403
          ) {
            pendingByDocId.current.delete(docId);
            markUploadFromStatus(
              uploadId,
              "failed",
              "Session expired while checking document status. Please sign in again."
            );
            return;
          }

          pollErrors.current[docId] = (pollErrors.current[docId] ?? 0) + 1;
          if (pollErrors.current[docId] >= MAX_CONSECUTIVE_ERRORS) {
            pendingByDocId.current.delete(docId);
            delete pollCounts.current[docId];
            delete pollErrors.current[docId];
            markUploadFromStatus(
              uploadId,
              "failed",
              "Could not verify extraction status. Please refresh and try again."
            );
          }
        }
      })
    );

    stopPollingIfIdle();
  }, [queryClient, markUploadFromStatus, stopPollingIfIdle]);

  const trackDocumentExtraction = useCallback(
    (uploadId: string, docId: string) => {
      pendingByDocId.current.set(docId, uploadId);
      pollCounts.current[docId] = 0;
      pollErrors.current[docId] = 0;

      if (!pollIntervalRef.current) {
        pollIntervalRef.current = window.setInterval(() => {
          void pollPendingDocuments();
        }, POLL_INTERVAL_MS);
      }
    },
    [pollPendingDocuments]
  );

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!unassignedQuery.isSuccess || hasRestoredRef.current) return;

    const unassigned = unassignedQuery.data ?? [];
    hasRestoredRef.current = true;

    if (unassigned.length === 0) return;

    const restoredItems = unassigned.map(unassignedToUploadItem);
    let toAdd: UploadItem[] = [];

    setUploads((prev) => {
      const existingDocIds = new Set(
        prev.map((item) => item.documentId).filter(Boolean)
      );
      toAdd = restoredItems.filter(
        (item) => item.documentId && !existingDocIds.has(item.documentId)
      );
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });

    if (toAdd.length === 0) return;

    for (const item of toAdd) {
      if (item.documentId && item.status === "processing") {
        trackDocumentExtraction(item.id, item.documentId);
      }
    }

    setRestoredCount(toAdd.length);
    toast.info(
      toAdd.length === 1
        ? "Restored 1 document from your last session"
        : `Restored ${toAdd.length} documents from your last session`
    );
  }, [
    unassignedQuery.isSuccess,
    unassignedQuery.data,
    trackDocumentExtraction,
  ]);

  const removeUpload = useCallback(
    async (id: string) => {
      const item = uploads.find((u) => u.id === id);

      if (item?.documentId) {
        pendingByDocId.current.delete(item.documentId);
        delete pollCounts.current[item.documentId];
        delete pollErrors.current[item.documentId];
        stopPollingIfIdle();
      }

      setUploads((prev) => prev.filter((u) => u.id !== id));

      if (item?.documentId) {
        try {
          await deleteDocumentMutation.mutateAsync(item.documentId);
        } catch (err) {
          toast.error(getErrorMessage(err, "Failed to delete document"));
        }
      }
    },
    [uploads, deleteDocumentMutation, stopPollingIfIdle]
  );

  const clearUploads = useCallback(() => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pendingByDocId.current.clear();
    pollCounts.current = {};
    pollErrors.current = {};
    batchTotals.current = null;
    setUploads([]);
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const newItems: UploadItem[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        file,
        progress: 0,
        status: "uploading",
        fileSize: file.size,
        fileType: file.type === "application/pdf" ? "pdf" : "image",
      }));

      setUploads((prev) => [...prev, ...newItems]);

      const hasImages = files.some((f) => f.type !== "application/pdf");
      const hasPdfs = files.some((f) => f.type === "application/pdf");

      let imageSignature: SignatureParams | null = null;
      let rawSignature: SignatureParams | null = null;

      try {
        [imageSignature, rawSignature] = await Promise.all([
          hasImages
            ? uploadService.getSignature("image")
            : Promise.resolve(null),
          hasPdfs ? uploadService.getSignature("raw") : Promise.resolve(null),
        ]);
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Could not start upload");
        setUploads((prev) =>
          prev.map((u) =>
            newItems.some((n) => n.id === u.id)
              ? { ...u, status: "failed", error: message }
              : u
          )
        );
        toast.error(message);
        return;
      }

      const cloudinaryByUploadId = new Map<string, CloudinaryUploadResult>();
      const failedUploadIds = new Set<string>();

      await runPool(newItems, UPLOAD_CONCURRENCY, async (item) => {
        const isPDF = item.file.type === "application/pdf";
        const signature = isPDF ? rawSignature : imageSignature;

        if (!signature) {
          failedUploadIds.add(item.id);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, status: "failed", error: "Missing upload signature" }
                : u
            )
          );
          return;
        }

        try {
          const cloudinaryResult = await uploadService.uploadToCloudinary(
            item.file,
            signature,
            (percent) => {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === item.id ? { ...u, progress: percent } : u
                )
              );
            }
          );

          cloudinaryByUploadId.set(item.id, cloudinaryResult);

          const isImageUpload =
            item.file.type.startsWith("image/") || item.fileType === "image";

          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? {
                    ...u,
                    status: "processing",
                    progress: 100,
                    ...(isImageUpload
                      ? { previewUrl: cloudinaryResult.url }
                      : {}),
                  }
                : u
            )
          );
        } catch (err: unknown) {
          const message = getErrorMessage(err, "Upload failed");
          failedUploadIds.add(item.id);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id ? { ...u, status: "failed", error: message } : u
            )
          );
        }
      });

      if (
        failedUploadIds.size > 0 &&
        failedUploadIds.size === newItems.length
      ) {
        toast.error("All uploads failed");
        return;
      }

      if (failedUploadIds.size > 0) {
        toast.error(`${failedUploadIds.size} file(s) failed to upload`);
      }

      const successfulMetadata = newItems
        .filter((item) => cloudinaryByUploadId.has(item.id))
        .map((item) => cloudinaryByUploadId.get(item.id)!);

      if (successfulMetadata.length === 0) return;

      try {
        const savedDocs = await uploadService.saveDocumentsMetadata(
          successfulMetadata
        );

        queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });

        const pendingDocs = savedDocs.filter((doc) => doc?.status !== "ready");

        if (pendingDocs.length === 0) {
          toast.success(
            savedDocs.length === 1
              ? "Document ready for itinerary generation"
              : `All ${savedDocs.length} documents are ready for itinerary generation`
          );
        } else {
          batchTotals.current = {
            ready: 0,
            failed: 0,
            total: pendingDocs.length,
          };
          toast.info(
            pendingDocs.length === 1
              ? "Extracting text from your document…"
              : `Extracting text from ${pendingDocs.length} documents in parallel…`
          );
        }

        savedDocs.forEach((savedDoc) => {
          const uploadItem = newItems.find(
            (item) =>
              cloudinaryByUploadId.get(item.id)?.publicId === savedDoc.publicId
          );
          if (!uploadItem || !savedDoc?._id) return;

          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id
                ? {
                    ...u,
                    documentId: savedDoc._id,
                    status:
                      savedDoc.status === "ready" ? "ready" : "processing",
                    extractedText: savedDoc.extractedText || "",
                    thumbnailUrl: savedDoc.thumbnailUrl ?? u.thumbnailUrl,
                  }
                : u
            )
          );

          if (savedDoc.status !== "ready") {
            trackDocumentExtraction(uploadItem.id, savedDoc._id);
          }
        });
      } catch (err: unknown) {
        const message = getErrorMessage(
          err,
          "Failed to save document metadata"
        );
        setUploads((prev) =>
          prev.map((u) =>
            cloudinaryByUploadId.has(u.id)
              ? { ...u, status: "failed", error: message }
              : u
          )
        );
        toast.error(message);
      }
    },
    [queryClient, trackDocumentExtraction]
  );

  return {
    uploads,
    uploadFiles,
    removeUpload,
    clearUploads,
    restoredCount,
    isRestoringUploads: unassignedQuery.isLoading,
  };
};

export default useUpload;
