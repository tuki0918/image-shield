import { MANIFEST_FILE_NAME } from "./constraints";
import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";
import type {
  DecryptOptions,
  EncryptOptions,
  FragmentationConfig,
  ManifestData,
} from "./types";
import { createDir, readJsonFile, writeFile } from "./utils/file";
import {
  generateFragmentFileName,
  generateRestoredFileName,
  generateRestoredOriginalFileName,
  verifySecretKey,
} from "./utils/helpers";

export {
  ImageFragmenter,
  ImageRestorer,
  type FragmentationConfig,
  type ManifestData,
};

// biome-ignore lint/complexity/noStaticOnlyClass:
export default class ImageShield {
  static async encrypt(options: EncryptOptions): Promise<void> {
    const { imagePaths, config, outputDir, secretKey } =
      validateEncryptOptions(options);

    const fragmenter = new ImageFragmenter(
      config ?? {},
      verifySecretKey(secretKey),
    );
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

  static async decrypt(options: DecryptOptions): Promise<void> {
    const { imagePaths, manifestPath, outputDir, secretKey } =
      validateDecryptOptions(options);

    const manifest = await readJsonFile<ManifestData>(manifestPath);

    const restorer = new ImageRestorer(verifySecretKey(secretKey));
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

function validateCommonOptions<T extends EncryptOptions | DecryptOptions>(
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

function validateEncryptOptions(options: EncryptOptions) {
  return validateCommonOptions(options, "encrypt");
}

function validateDecryptOptions(options: DecryptOptions) {
  const { manifestPath } = options;
  if (!manifestPath || typeof manifestPath !== "string")
    throw new Error("[decrypt] manifestPath is required and must be a string.");
  return validateCommonOptions(options, "decrypt");
}
