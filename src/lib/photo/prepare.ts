export function isHeic(file: { name: string; type: string }): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

export function computeTargetDims(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Convert HEIC/HEIF to JPEG and downscale to ≤1600 px on the long edge.
 * Returns a JPEG Blob. Browser-only: uses canvas + heic2any.
 */
export async function prepareForUpload(input: File): Promise<{ blob: Blob; ext: "jpg" }> {
  const MAX_LONG_EDGE = 1600;
  const QUALITY = 0.85;

  let working: Blob = input;

  if (isHeic(input)) {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: input,
      toType: "image/jpeg",
      quality: QUALITY,
    });
    working = Array.isArray(result) ? result[0] : result;
  }

  const bitmap = await createImageBitmap(working);
  const { width, height } = computeTargetDims(bitmap.width, bitmap.height, MAX_LONG_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      QUALITY
    )
  );
  return { blob, ext: "jpg" };
}
