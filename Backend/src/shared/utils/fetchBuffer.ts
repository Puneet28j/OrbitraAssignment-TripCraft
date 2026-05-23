const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Download a file with timeout and one retry (Cloudinary URLs).
 */
export async function fetchBuffer(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Buffer> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to download file: ${message}`);
}
