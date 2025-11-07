import type { ManifestData } from "./types";

/**
 * Encode file name to base64 for safe storage (cross-platform)
 * @param name - Original file name
 * @returns Base64 encoded file name
 */
export function encodeFileName(name: string): string {
  // Use TextEncoder for UTF-8 encoding (available in both browser and Node.js)
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name);
  // Convert bytes to binary string for btoa (cross-platform)
  // Use loop to avoid stack overflow with large arrays
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    binaryString += String.fromCharCode(byte);
  }
  return btoa(binaryString);
}

/**
 * Decode file name from base64 (cross-platform)
 * @param encodedName - Base64 encoded file name
 * @returns Decoded original file name
 */
export function decodeFileName(encodedName: string): string {
  // Use atob for base64 decoding (cross-platform)
  const binaryString = atob(encodedName);
  // Convert binary string to bytes
  const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
  // Use TextDecoder for UTF-8 decoding (available in both browser and Node.js)
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Generate a file name with prefix, 1-based zero-padded index, and extension
 * @param manifest - Manifest data
 * @param index - Index number (0-based, but output is 1-based)
 * @param options - Options for the file name
 * @param options.isFragmented - Whether the fragment is fragmented
 * @returns File name (e.g., img_1.png.enc)
 */
export function generateFileName(
  manifest: ManifestData,
  index: number,
  options: {
    isFragmented: boolean;
  } = {
    isFragmented: false,
  },
): string {
  const prefix = manifest.config.prefix;
  const totalLength = manifest.images.length;
  const extension = "png";
  const numDigits = String(totalLength).length;
  const paddedIndex = String(index + 1).padStart(numDigits, "0");
  const filenameSuffix = options.isFragmented ? "_fragmented" : "";
  const filename = `${prefix}_${paddedIndex}${filenameSuffix}`;
  return `${filename}.${extension}`;
}

/**
 * Generate a fragment file name
 * @param manifest - Manifest data
 * @param index - Index number (0-based, but output is 1-based)
 * @returns Fragment file name (e.g., img_1_fragmented.png)
 */
export function generateFragmentFileName(
  manifest: ManifestData,
  index: number,
): string {
  return generateFileName(manifest, index, {
    isFragmented: true,
  });
}

/**
 * Generate a restored file name
 * @param manifest - Manifest data
 * @param index - Index number (0-based, but output is 1-based)
 * @returns Restored file name (e.g., img_1.png)
 */
export function generateRestoredFileName(
  manifest: ManifestData,
  index: number,
): string {
  return generateFileName(manifest, index, {
    isFragmented: false,
  });
}

/**
 * Generate a restored original file name
 * @param imageInfo - Image information
 * @returns Restored original file name
 */
export function generateRestoredOriginalFileName(
  imageInfo: ManifestData["images"][number],
): string | undefined {
  if (!imageInfo.name) {
    return undefined;
  }
  try {
    const decodedName = decodeFileName(imageInfo.name);
    return decodedName ? `${decodedName}.png` : undefined;
  } catch {
    // Fallback: if decoding fails, treat as already decoded (backward compatibility)
    return `${imageInfo.name}.png`;
  }
}
