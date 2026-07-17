"use client";

// Downscales + re-encodes an image file in the browser before upload, so a
// full-resolution phone photo (often 3-5MB+) doesn't get shipped as-is over
// a field tech's cellular connection. Falls back to the original file if
// resizing isn't supported or fails for any reason.
export async function resizeImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close?.();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    const newName = file.name.replace(/\.[^./]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    console.error("Image resize failed, uploading original file:", err);
    return file;
  }
}
