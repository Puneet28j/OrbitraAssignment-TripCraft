import sharp from "sharp";

export async function preprocessImageBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    const img = sharp(buffer);

    const metadata = await img.metadata();

    // Ensure sufficiently large width for OCR (scale up if small)
    const minWidth = 1200;
    const width = metadata.width && metadata.width < minWidth ? minWidth : metadata.width;

    // Basic preprocessing pipeline:
    // - resize (if needed) to improve OCR on small images
    // - convert to grayscale
    // - normalise (contrast enhancement)
    // - median filter to reduce speckle noise
    // - sharpen to enhance edges
    const pipeline = img
      .rotate() // auto-orient via EXIF
      .resize({ width: width || undefined })
      .grayscale()
      .normalise()
      .median(1)
      .sharpen()
      .toFormat("png");

    const out = await pipeline.toBuffer();
    return out;
  } catch (err) {
    return buffer;
  }
}

export default preprocessImageBuffer;
