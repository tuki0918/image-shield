import type { ShortImageInfo } from "../types";

/**
 * Verify if a secretKey is valid
 * @param secretKey - The secret key to verify
 * @returns The secret key if valid, undefined otherwise
 */
export function verifySecretKey(
  secretKey: string | undefined | null,
): string | undefined {
  if (!!secretKey && secretKey.trim().length > 0) {
    return secretKey;
  }
  return undefined;
}

/**
 * Generate a fragment file name with prefix, 1-based zero-padded index, and extension
 * @param prefix - File name prefix
 * @param index - Index number (0-based, but output is 1-based)
 * @param totalLength - Total number of files (for zero-padding)
 * @param options - Options for the file name
 * @param options.isFragmented - Whether the fragment is fragmented
 * @param options.isEncrypted - Whether the fragment is encrypted
 * @returns File name (e.g., img_1.png.enc)
 */
export function generateFragmentFileName(
  prefix: string,
  index: number,
  totalLength: number,
  options: {
    isFragmented: boolean;
    isEncrypted: boolean;
  } = {
    isFragmented: false,
    isEncrypted: false,
  },
): string {
  const extension = "png";
  const numDigits = String(totalLength).length;
  const paddedIndex = String(index + 1).padStart(numDigits, "0");
  const filenameSuffix = options.isFragmented ? "_fragmented" : "";
  const extensionSuffix = options.isEncrypted ? ".enc" : "";
  const filename = `${prefix}_${paddedIndex}${filenameSuffix}`;
  const ext = `${extension}${extensionSuffix}`;
  return `${filename}.${ext}`;
}

/**
 * Generate a restored original file name
 * @param imageInfo - Image information
 * @returns Restored original file name
 */
export function generateRestoredOriginalFileName(
  imageInfo: ShortImageInfo,
): string | undefined {
  return imageInfo.name ? `${imageInfo.name}.png` : undefined;
}
