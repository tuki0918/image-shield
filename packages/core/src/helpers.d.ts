import type { ManifestData } from "./types";
/**
 * Verify if a secretKey is valid
 * @param secretKey - The secret key to verify
 * @returns The secret key if valid, undefined otherwise
 */
export declare function verifySecretKey(
  secretKey: string | undefined | null,
): string | undefined;
/**
 * Generate a file name with prefix, 1-based zero-padded index, and extension
 * @param manifest - Manifest data
 * @param index - Index number (0-based, but output is 1-based)
 * @param options - Options for the file name
 * @param options.isFragmented - Whether the fragment is fragmented
 * @returns File name (e.g., img_1.png.enc)
 */
export declare function generateFileName(
  manifest: ManifestData,
  index: number,
  options?: {
    isFragmented: boolean;
  },
): string;
/**
 * Generate a fragment file name
 * @param manifest - Manifest data
 * @param index - Index number (0-based, but output is 1-based)
 * @returns Fragment file name (e.g., img_1_fragmented.png)
 */
export declare function generateFragmentFileName(
  manifest: ManifestData,
  index: number,
): string;
/**
 * Generate a restored file name
 * @param manifest - Manifest data
 * @param index - Index number (0-based, but output is 1-based)
 * @returns Restored file name (e.g., img_1.png)
 */
export declare function generateRestoredFileName(
  manifest: ManifestData,
  index: number,
): string;
/**
 * Generate a restored original file name
 * @param imageInfo - Image information
 * @returns Restored original file name
 */
export declare function generateRestoredOriginalFileName(
  imageInfo: ManifestData["images"][number],
): string | undefined;
//# sourceMappingURL=helpers.d.ts.map
