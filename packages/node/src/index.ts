import {
  CryptoUtils,
  type DecryptOptions,
  type EncryptOptions,
  type FragmentationConfig,
  MANIFEST_FILE_NAME,
  type ManifestData,
  generateFragmentFileName,
  generateRestoredFileName,
  generateRestoredOriginalFileName,
  verifySecretKey,
} from "@image-shield/core";
import { NodeCryptoProvider } from "./crypto";
import { createDir, readJsonFile, writeFile } from "./file";
import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";

// Initialize the crypto provider
CryptoUtils.setProvider(new NodeCryptoProvider());

export {
  ImageFragmenter,
  ImageRestorer,
  type FragmentationConfig,
  type ManifestData,
};

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
