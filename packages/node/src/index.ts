import {
  type FragmentationConfig,
  MANIFEST_FILE_NAME,
  type ManifestData,
  type RestoreOptions,
  type ShuffleOptions,
  generateFragmentFileName,
  generateRestoredFileName,
  generateRestoredOriginalFileName,
} from "@image-shield/core";
import { createDir, readJsonFile, writeFile } from "./file";
import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";

export {
  ImageFragmenter,
  ImageRestorer,
  type FragmentationConfig,
  type ManifestData,
};

export default class ImageShield {
  static async shuffle(options: ShuffleOptions): Promise<void> {
    const { imagePaths, config, outputDir } = validateShuffleOptions(options);

    const fragmenter = new ImageFragmenter(config ?? {});
    const { manifest, fragmentedImages } =
      await fragmenter.fragmentImages(imagePaths);

    await createDir(outputDir, true);
    await writeFile(
      outputDir,
      MANIFEST_FILE_NAME,
      JSON.stringify(manifest, null, 2),
    );

    await Promise.all(
      fragmentedImages.map((img, i) => {
        const filename = generateFragmentFileName(manifest, i);
        return writeFile(outputDir, filename, img);
      }),
    );
  }

  static async restore(options: RestoreOptions): Promise<void> {
    const { imagePaths, manifestPath, outputDir } =
      validateRestoreOptions(options);

    const manifest = await readJsonFile<ManifestData>(manifestPath);
    validateManifestVersion(manifest);

    const restorer = new ImageRestorer();
    const restoredImages = await restorer.restoreImages(imagePaths, manifest);

    await createDir(outputDir, true);

    const imageInfos = manifest.images;
    await Promise.all(
      restoredImages.map((img, i) => {
        const filename =
          generateRestoredOriginalFileName(imageInfos[i]) ??
          generateRestoredFileName(manifest, i);
        return writeFile(outputDir, filename, img);
      }),
    );
  }
}

function validateCommonOptions<T extends ShuffleOptions | RestoreOptions>(
  options: T,
  context: string,
) {
  if (!options) throw new Error(`[${context}] Options object is required.`);
  const { imagePaths, outputDir } = options;
  if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0)
    throw new Error(`[${context}] imagePaths must be a non-empty array.`);
  if (!outputDir || typeof outputDir !== "string")
    throw new Error(`[${context}] outputDir is required and must be a string.`);
  return options;
}

function validateShuffleOptions(options: ShuffleOptions) {
  return validateCommonOptions(options, "shuffle");
}

function validateRestoreOptions(options: RestoreOptions) {
  const { manifestPath } = options;
  if (!manifestPath || typeof manifestPath !== "string")
    throw new Error("[restore] manifestPath is required and must be a string.");
  return validateCommonOptions(options, "restore");
}

/**
 * Validates manifest version and throws an error if it's v0.8.1 or below.
 * This is a breaking change: encryption feature removal, per-image shuffle addition, and shuffle algorithm changes.
 */
function validateManifestVersion(manifest: ManifestData): void {
  const version = manifest.version;

  // Remove 'v' prefix if present
  const versionStr = version.startsWith("v") ? version.slice(1) : version;

  // Parse version (e.g., "0.8.1" -> [0, 8, 1])
  const parts = versionStr.split(".").map(Number);

  if (parts.length < 2 || parts.some(isNaN)) {
    throw new Error(
      `[restore] Invalid manifest version format: ${version}. ` +
        `Please use image-shield v0.8.1 or earlier to restore this manifest.`,
    );
  }

  const [major, minor, patch = 0] = parts;

  // Check if version is v0.8.1 or below
  if (major === 0 && (minor < 8 || (minor === 8 && patch <= 1))) {
    throw new Error(
      `[restore] Manifest version ${version} is not supported. ` +
        `This manifest was created with image-shield v0.8.1 or earlier. ` +
        `Please use image-shield v0.8.1 to restore this manifest. ` +
        `Breaking changes: encryption feature removal, cross-image shuffle addition, and shuffle algorithm changes.`,
    );
  }
}
