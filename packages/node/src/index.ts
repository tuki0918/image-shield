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

    const rawManifest = await readJsonFile<ManifestData>(manifestPath);
    const manifest = normalizeManifestForBackwardCompatibility(rawManifest);

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

function normalizeManifestForBackwardCompatibility(
  rawManifest: ManifestData,
): ManifestData {
  // For backward compatibility: if crossImageShuffle is undefined (Raycast or v0.8.1 and below), default to true
  if (rawManifest.config.crossImageShuffle === undefined) {
    return {
      ...rawManifest,
      config: {
        ...rawManifest.config,
        crossImageShuffle: true,
      },
    };
  }
  return rawManifest;
}
