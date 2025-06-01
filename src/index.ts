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
    try {
      const { imagePaths, config, outputDir, secretKey } = options;
      const fragmenter = new ImageFragmenter(config, secretKey);
      const result = await fragmenter.fragmentImages(imagePaths);

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Save manifest file
      const manifestPath = path.join(outputDir, "manifest.json");
      await fs.writeFile(
        manifestPath,
        JSON.stringify(result.manifest, null, 2),
      );

      // Save fragment images
      await Promise.all(
        result.fragmentedImages.map((img, i) => {
          const fragmentPath = path.join(
            outputDir,
            `${result.manifest.config.prefix}_${i}.png`,
          );
          return fs.writeFile(fragmentPath, img);
        }),
      );
    } catch (error) {
      console.error("[encrypt] An error occurred:", error);
      throw error;
    }
  }

  static async decrypt(options: DecryptOptions): Promise<void> {
    validateDecryptOptions(options);
    try {
      const { imagePaths, manifestPath, outputDir, secretKey } = options;
      // Read manifest
      const manifestData = await fs.readFile(manifestPath, "utf-8");
      const manifest: ManifestData = JSON.parse(manifestData);

      const restorer = new ImageRestorer(secretKey);
      const restoredImages = await restorer.restoreImages(imagePaths, manifest);

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Save restored images
      await Promise.all(
        restoredImages.map((img, i) => {
          const inputName = path.basename(
            imagePaths[i],
            path.extname(imagePaths[i]),
          );
          const outputPath = path.join(outputDir, `${inputName}_restored.png`);
          return fs.writeFile(outputPath, img);
        }),
      );
    } catch (error) {
      console.error("[decrypt] An error occurred:", error);
      throw error;
    }
  }
}

function validateEncryptOptions(options: EncryptOptions) {
  if (!options) throw new Error("[encrypt] Options object is required.");
  const { imagePaths, config, outputDir, secretKey } = options;
  if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0)
    throw new Error("[encrypt] imagePaths must be a non-empty array.");
  if (!config) throw new Error("[encrypt] config is required.");
  if (!outputDir || typeof outputDir !== "string")
    throw new Error("[encrypt] outputDir is required and must be a string.");
  if (!secretKey || typeof secretKey !== "string")
    throw new Error("[encrypt] secretKey is required and must be a string.");
}

function validateDecryptOptions(options: DecryptOptions) {
  if (!options) throw new Error("[decrypt] Options object is required.");
  const { imagePaths, manifestPath, outputDir, secretKey } = options;
  if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0)
    throw new Error("[decrypt] imagePaths must be a non-empty array.");
  if (!manifestPath || typeof manifestPath !== "string")
    throw new Error("[decrypt] manifestPath is required and must be a string.");
  if (!outputDir || typeof outputDir !== "string")
    throw new Error("[decrypt] outputDir is required and must be a string.");
  if (!secretKey || typeof secretKey !== "string")
    throw new Error("[decrypt] secretKey is required and must be a string.");
}
