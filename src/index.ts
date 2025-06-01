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
    try {
      const { imagePaths, config, outputDir, secretKey } = options;

      const fragmenter = new ImageFragmenter(config, secretKey);
      const result = await fragmenter.fragmentImages(imagePaths);

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Save manifest file
      const manifestPath = path.join(outputDir, "manifest.json");
      await fs.writeFile(manifestPath, JSON.stringify(result.manifest, null, 2));

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
