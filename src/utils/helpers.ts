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
 * @param ext - Extension without dot (e.g., "png", "png.enc")
 * @returns File name (e.g., img_1.png.enc)
 */
export function generateFragmentFileName(
  prefix: string,
  index: number,
  totalLength: number,
  ext: string, // without dot
): string {
  const numDigits = String(totalLength).length;
  const paddedIndex = String(index + 1).padStart(numDigits, "0");
  return `${prefix}_${paddedIndex}.${ext}`;
}
