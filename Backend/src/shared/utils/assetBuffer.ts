import type { FileType } from "../../models/Document.js";

export function inferAssetFormat(
  cloudinaryUrl: string,
  fileType: FileType
): string {
  if (fileType === "pdf") return "pdf";

  try {
    const pathname = new URL(cloudinaryUrl).pathname;
    const segment = pathname.split("/").pop() ?? "";
    const dot = segment.lastIndexOf(".");
    if (dot > 0) {
      return segment.slice(dot + 1).toLowerCase();
    }
  } catch {
    // ignore invalid URL
  }

  return "";
}

export function validateAssetBuffer(
  buffer: Buffer,
  fileType: FileType
): void {
  if (buffer.length < 32) {
    throw new Error("Downloaded file is too small or empty");
  }

  const head = buffer.subarray(0, Math.min(64, buffer.length)).toString("utf8");
  if (head.toLowerCase().includes("<!doctype") || head.toLowerCase().includes("<html")) {
    throw new Error("Received an HTML error page instead of the file");
  }

  if (fileType === "pdf") {
    const magic = buffer.subarray(0, 5).toString("ascii");
    if (!magic.startsWith("%PDF")) {
      throw new Error("Downloaded content is not a valid PDF");
    }
    return;
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isGif = buffer.subarray(0, 3).toString("ascii") === "GIF";
  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  if (!isJpeg && !isPng && !isGif && !isWebp) {
    throw new Error("Downloaded content is not a valid image");
  }
}
