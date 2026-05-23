import { axiosInstance } from "../api/axiosInstance";
import { API_ENDPOINTS } from "../api/endpoints";
import type { ApiSuccessResponse } from "../types/api";
import type {
  DocumentStatusResponse,
  UnassignedDocument,
} from "../types/document";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  resourceType: "raw" | "image";
  fileName: string;
  originalName: string;
  fileType: "pdf" | "image";
  mimeType: string;
  fileSize: number;
}

/** Shape expected by POST /upload and POST /upload/batch */
function toUploadMetadataPayload(metadata: CloudinaryUploadResult) {
  return {
    fileName: metadata.fileName,
    originalName: metadata.originalName,
    fileType: metadata.fileType,
    mimeType: metadata.mimeType,
    fileSize: metadata.fileSize,
    cloudinaryUrl: metadata.url,
    publicId: metadata.publicId,
    resourceType: metadata.resourceType,
  };
}

export const uploadService = {
  /**
   * Fetch a secure signature and timestamp from the server for direct Cloudinary upload.
   */
  async getSignature(resourceType: "image" | "raw" = "image") {
    const response = await axiosInstance.post(API_ENDPOINTS.UPLOAD.SIGN, {
      resourceType,
    });
    return response.data.data;
  },

  /**
   * Upload a file directly to Cloudinary using XMLHttpRequest to monitor real-time progress.
   */
  uploadToCloudinary(
    file: File,
    signatureParams: {
      signature: string;
      timestamp: number;
      cloudName: string;
      apiKey: string;
      folder: string;
      resourceType: string;
    },
    onProgress: (percent: number) => void
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const { signature, timestamp, cloudName, apiKey, folder, resourceType } =
        signatureParams;

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      xhr.open("POST", uploadUrl, true);

      // Track progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round(
            (event.loaded * 100) / event.total
          );
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const isPDF = file.type === "application/pdf";

            resolve({
              url: response.secure_url,
              publicId: response.public_id,
              resourceType: isPDF ? "raw" : "image",
              fileName: response.public_id,
              originalName: file.name,
              fileType: isPDF ? "pdf" : "image",
              mimeType: file.type,
              fileSize: file.size,
            });
          } catch (err) {
            reject(new Error("Failed to parse Cloudinary response"));
          }
        } else {
          reject(new Error(xhr.responseText || "Cloudinary upload failed"));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload aborted"));

      // Construct payload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("signature", signature);
      formData.append("timestamp", String(timestamp));
      formData.append("api_key", apiKey);
      formData.append("folder", folder);

      xhr.send(formData);
    });
  },

  /**
   * Send Cloudinary upload metadata to the server to save the Document record in the DB
   * and trigger asynchronous text extraction.
   */
  async saveDocumentMetadata(metadata: CloudinaryUploadResult) {
    const response = await axiosInstance.post(
      API_ENDPOINTS.UPLOAD.BASE,
      toUploadMetadataPayload(metadata)
    );
    const savedData = response.data.data;
    return Array.isArray(savedData) ? savedData[0] : savedData;
  },

  /**
   * Save multiple Cloudinary uploads in one request and trigger parallel extraction.
   */
  async saveDocumentsMetadata(metadataList: CloudinaryUploadResult[]) {
    if (metadataList.length === 0) {
      return [];
    }
    if (metadataList.length === 1) {
      const doc = await this.saveDocumentMetadata(metadataList[0]);
      return [doc];
    }

    const response = await axiosInstance.post(API_ENDPOINTS.UPLOAD.BATCH, {
      documents: metadataList.map(toUploadMetadataPayload),
    });
    const savedData = response.data.data;
    return Array.isArray(savedData) ? savedData : [savedData];
  },

  /**
   * Poll extraction status for a single document (preferred over listing all docs).
   */
  /**
   * Fetch document bytes through the API (auth) for reliable PDF/image preview.
   */
  async fetchDocumentPreviewUrl(id: string): Promise<string> {
    const response = await axiosInstance.get<ArrayBuffer>(
      API_ENDPOINTS.UPLOAD.CONTENT(id),
      { responseType: "arraybuffer" }
    );

    const contentType =
      (response.headers["content-type"] as string | undefined) ??
      "application/octet-stream";
    const blob = new Blob([response.data], { type: contentType });
    return URL.createObjectURL(blob);
  },

  async getDocumentViewUrl(id: string) {
    const response = await axiosInstance.get(
      API_ENDPOINTS.UPLOAD.VIEW_URL(id)
    );
    return response.data.data as {
      id: string;
      originalName: string;
      fileType: "pdf" | "image";
      viewUrl: string;
    };
  },

  async getDocumentStatus(id: string) {
    const response = await axiosInstance.get<ApiSuccessResponse<DocumentStatusResponse>>(
      API_ENDPOINTS.UPLOAD.STATUS(id)
    );
    return response.data.data;
  },

  /**
   * Get paginated list of user's uploaded documents.
   */
  async getDocuments(page = 1, limit = 10) {
    const response = await axiosInstance.get(API_ENDPOINTS.UPLOAD.BASE, {
      params: { page, limit },
    });
    return response.data.data;
  },

  /** Documents saved on the server but not yet used in any itinerary. */
  async getUnassignedDocuments() {
    const response = await axiosInstance.get<
      ApiSuccessResponse<UnassignedDocument[]>
    >(API_ENDPOINTS.UPLOAD.UNASSIGNED);
    return response.data.data;
  },

  /**
   * Delete a document.
   */
  async deleteDocument(id: string) {
    const response = await axiosInstance.delete(API_ENDPOINTS.UPLOAD.BY_ID(id));
    return response.data;
  },
};
