import { z } from "zod";

export const signUploadSchema = z.object({
  folder: z.string().optional(),
  resourceType: z.enum(["image", "raw"]).optional().default("image"),
});

const uploadMetadataInputSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  originalName: z.string().min(1, "Original file name is required"),
  fileType: z.enum(["pdf", "image"]),
  mimeType: z.string().min(1, "MIME type is required"),
  fileSize: z.coerce
    .number()
    .int()
    .positive("File size must be a positive integer"),
  /** Client may send `url` (Cloudinary direct upload) or `cloudinaryUrl` */
  cloudinaryUrl: z.url("Cloudinary URL must be valid").optional(),
  url: z.url("Cloudinary URL must be valid").optional(),
  publicId: z.string().min(1, "Cloudinary public ID is required"),
  resourceType: z.enum(["raw", "image"]),
});

export const uploadMetadataSchema = uploadMetadataInputSchema
  .refine((data) => Boolean(data.cloudinaryUrl ?? data.url), {
    message: "cloudinaryUrl or url is required",
    path: ["cloudinaryUrl"],
  })
  .transform((data) => ({
    fileName: data.fileName,
    originalName: data.originalName,
    fileType: data.fileType,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    cloudinaryUrl: (data.cloudinaryUrl ?? data.url) as string,
    publicId: data.publicId,
    resourceType: data.resourceType,
  }));

export const uploadBatchMetadataSchema = z.object({
  documents: z
    .array(uploadMetadataSchema)
    .min(1, "At least one document is required")
    .max(20, "Maximum 20 documents per batch"),
});
