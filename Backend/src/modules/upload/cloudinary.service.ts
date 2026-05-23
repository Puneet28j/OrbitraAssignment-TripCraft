import cloudinary from "../../config/cloudinary.js";
import ApiError from "../../shared/errors/ApiError.js";
import { fetchBuffer } from "../../shared/utils/fetchBuffer.js";
import {
  inferAssetFormat,
  validateAssetBuffer,
} from "../../shared/utils/assetBuffer.js";
import type { FileType } from "../../models/Document.js";

export interface UploadResult {
  url: string;
  publicId: string;
  resourceType: string;
  format: string;
  bytes: number;
}

const DELIVERY_TYPES = ["upload", "authenticated", "private"] as const;

export async function uploadBuffer(
  buffer: Buffer,
  {
    folder,
    resourceType = "image",
    publicId,
  }: {
    folder: string;
    resourceType?: "image" | "raw";
    publicId?: string;
  }
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOptions: Record<string, unknown> = {
      folder,
      resource_type: resourceType,
      ...(publicId && { public_id: publicId }),
    };

    if (resourceType === "image") {
      uploadOptions.format = "auto";
      uploadOptions.quality = "auto";
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error || !result) {
          reject(
            ApiError.internal(
              `Cloudinary upload failed: ${error?.message ?? "Unknown error"}`
            )
          );
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    (uploadStream as any).end(buffer);
  });
}

export async function deleteFile(
  publicId: string,
  resourceType: "image" | "raw" = "image"
) {
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw ApiError.internal(
      `Failed to delete file from storage: ${message}`
    );
  }
}

export function getThumbnailUrl(publicId: string, fileType: FileType): string {
  if (fileType === "pdf") {
    return cloudinary.url(publicId, {
      resource_type: "image",
      type: "upload",
      format: "jpg",
      page: 1,
      width: 400,
      height: 560,
      crop: "fill",
      quality: "auto",
      secure: true,
      sign_url: true,
    });
  }

  return cloudinary.url(publicId, {
    resource_type: "image",
    width: 400,
    crop: "fill",
    format: "webp",
    quality: "auto",
    secure: true,
    sign_url: true,
  });
}

/**
 * Signed URL for viewing a document in the browser (inline PDF / image).
 */
export function getSignedViewUrl(
  publicId: string,
  resourceType: "image" | "raw",
  fileType: FileType
): string {
  if (fileType === "pdf" || resourceType === "raw") {
    return cloudinary.url(publicId, {
      resource_type: "raw",
      type: "upload",
      secure: true,
      sign_url: true,
    });
  }

  return cloudinary.url(publicId, {
    resource_type: "image",
    type: "upload",
    secure: true,
    sign_url: true,
  });
}

/**
 * Download original file bytes using Cloudinary's signed download API.
 * Works when delivery URLs return 401 (restricted/authenticated delivery).
 */
export async function downloadAssetBuffer(params: {
  publicId: string;
  resourceType: "image" | "raw";
  fileType: FileType;
  cloudinaryUrl?: string;
}): Promise<Buffer> {
  const { publicId, resourceType, fileType, cloudinaryUrl } = params;
  const format =
    cloudinaryUrl != null
      ? inferAssetFormat(cloudinaryUrl, fileType)
      : fileType === "pdf"
        ? "pdf"
        : "";

  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const failures: string[] = [];

  for (const deliveryType of DELIVERY_TYPES) {
    try {
      const downloadUrl = cloudinary.utils.private_download_url(
        publicId,
        format,
        {
          resource_type: resourceType,
          type: deliveryType,
          expires_at: expiresAt,
        }
      );

      const buffer = await fetchBuffer(downloadUrl);
      validateAssetBuffer(buffer, fileType);
      return buffer;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${deliveryType}: ${message}`);
    }
  }

  if (cloudinaryUrl) {
    try {
      const signedDeliveryUrl = cloudinary.url(publicId, {
        resource_type: resourceType,
        type: "upload",
        secure: true,
        sign_url: true,
      });
      const buffer = await fetchBuffer(signedDeliveryUrl);
      validateAssetBuffer(buffer, fileType);
      return buffer;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`signed_delivery: ${message}`);
    }
  }

  throw ApiError.internal(
    `Failed to download file from storage: ${failures.join("; ")}`
  );
}

export function getSignedUploadParams(
  folder: string,
  resourceType: "image" | "raw" = "image"
) {
  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign = {
    timestamp,
    folder,
  };

  const apiSecret = cloudinary.config().api_secret;
  if (!apiSecret) {
    throw ApiError.internal("Cloudinary API secret is not configured");
  }

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    signature,
    timestamp,
    cloudName: cloudinary.config().cloud_name,
    apiKey: cloudinary.config().api_key,
    folder,
    resourceType,
  };
}
