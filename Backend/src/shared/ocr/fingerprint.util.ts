import crypto from "crypto";

export function computeDocumentFingerprint(
  structuredSummary: string
): string {
  const hash = crypto.createHash("sha256");
  hash.update(structuredSummary);
  return hash.digest("hex");
}

export default computeDocumentFingerprint;
