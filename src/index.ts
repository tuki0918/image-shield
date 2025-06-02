import fs from "node:fs/promises";
import path from "node:path";
import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";
import type {
  DecryptOptions,
  EncryptOptions,
  FragmentationConfig,
  ManifestData,
} from "./types";
import { verifySecretKey } from "./utils/helpers";

export {
  ImageFragmenter,
  ImageRestorer,
  type FragmentationConfig,
  type ManifestData,
};

// biome-ignore lint/complexity/noStaticOnlyClass:
export default class ImageShield {
  static async encrypt(options: EncryptOptions): Promise<void> {
    validateEncryptOptions(options);

    const { imagePaths, config, outputDir, secretKey } = options;
    const fragmenter = new ImageFragmenter(config, verifySecretKey(secretKey));
    const result = await fragmenter.fragmentImages(imagePaths);
    const { manifest, fragmentedImages } = result;

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Save manifest file
    const manifestPath = path.join(outputDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Save fragment images
    await Promise.all(
      fragmentedImages.map((img, i) => {
        const ext = manifest.secure ? ".png.enc" : ".png";
        const fragmentPath = path.join(
          outputDir,
          `${manifest.config.prefix}_${i}${ext}`,
        );
        return fs.writeFile(fragmentPath, img);
      }),
    );
  }

  static async decrypt(options: DecryptOptions): Promise<void> {
    validateDecryptOptions(options);

    const { imagePaths, manifestPath, outputDir, secretKey } = options;
    // Read manifest
    const manifestData = await fs.readFile(manifestPath, "utf-8");
    const manifest: ManifestData = JSON.parse(manifestData);
    const { prefix } = manifest.config;

    const restorer = new ImageRestorer(verifySecretKey(secretKey));
    const restoredImages = await restorer.restoreImages(imagePaths, manifest);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Save restored images
    await Promise.all(
      restoredImages.map((img, i) => {
        const outputPath = path.join(outputDir, `${prefix}_${i}.png`);
        return fs.writeFile(outputPath, img);
      }),
    );
  }
}

function validateCommonOptions(
  options: { imagePaths: string[]; outputDir: string; secretKey?: string },
  context: string,
) {
  if (!options) throw new Error(`[${context}] Options object is required.`);
  const { imagePaths, outputDir } = options;
  if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0)
    throw new Error(`[${context}] imagePaths must be a non-empty array.`);
  if (!outputDir || typeof outputDir !== "string")
    throw new Error(`[${context}] outputDir is required and must be a string.`);
}

function validateEncryptOptions(options: EncryptOptions) {
  validateCommonOptions(options, "encrypt");
  const { config } = options;
  if (!config) throw new Error("[encrypt] config is required.");
}

function validateDecryptOptions(options: DecryptOptions) {
  validateCommonOptions(options, "decrypt");
  const { manifestPath } = options;
  if (!manifestPath || typeof manifestPath !== "string")
    throw new Error("[decrypt] manifestPath is required and must be a string.");
}
