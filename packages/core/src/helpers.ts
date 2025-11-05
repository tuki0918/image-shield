import type { ManifestData } from "./types";

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
  return imageInfo.name ? `${imageInfo.name}.png` : undefined;
}
