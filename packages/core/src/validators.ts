import { decodeFileName } from "./helpers";
import type { ImageInfo, ManifestData } from "./types";

/**
 * Validates that the number of fragment images matches the number of images in the manifest
 * @param fragmentImages - Array of fragment images (file paths or buffers)
 * @param manifest - The manifest data containing image information
 * @throws {Error} When the counts don't match
 */
export function validateFragmentImageCount(
  fragmentImages: (string | Buffer)[],
  manifest: ManifestData,
): void {
  const manifestImageCount = manifest.images.length;
  const fragmentImageCount = fragmentImages.length;

  if (manifestImageCount !== fragmentImageCount) {
    throw new Error(
      `Fragment image count mismatch: expected ${manifestImageCount} but got ${fragmentImageCount}`,
    );
  }
}

/**
 * Validates that there are no duplicate file names in the image infos
 * @param imageInfos - Array of image information objects
 * @param preserveName - Whether name preservation is enabled
 * @throws {Error} When duplicate file names are detected
 */
export function validateFileNames(
  imageInfos: ImageInfo[],
  preserveName: boolean,
): void {
  if (!preserveName || imageInfos.length <= 1) {
    return;
  }

  const nameSet = new Set<string>();

  for (const info of imageInfos) {
    if (info.name !== undefined) {
      // Decode base64 to get original name for comparison
      let decodedName: string;
      try {
        decodedName = decodeFileName(info.name);
      } catch {
        // If decoding fails, treat as already decoded (backward compatibility)
        decodedName = info.name;
      }
      if (nameSet.has(decodedName)) {
        throw new Error(`Duplicate file name detected: ${decodedName}`);
      }
      nameSet.add(decodedName);
    }
  }
}
