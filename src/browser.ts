/**
 * Browser-compatible ImageShield implementation
 */

import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";
import type {
  FragmentationConfig,
  ManifestData,
} from "./types";
import { BrowserFileHandler, BrowserPath } from "./utils/browser-file";
import {
  generateFragmentFileName,
  verifySecretKey,
} from "./utils/helpers";

export {
  ImageFragmenter,
  ImageRestorer,
  BrowserFileHandler,
  BrowserPath,
  type FragmentationConfig,
  type ManifestData,
};

/**
 * Browser-specific options for encryption
 */
export interface BrowserEncryptOptions {
  images: File[];
  config?: Partial<FragmentationConfig>;
  secretKey?: string;
}

/**
 * Browser-specific options for decryption
 */
export interface BrowserDecryptOptions {
  fragmentFiles: File[];
  manifestData: ManifestData;
  secretKey?: string;
}

/**
 * Result of browser encryption
 */
export interface BrowserEncryptResult {
  manifest: ManifestData;
  files: Record<string, Blob>;
}

/**
 * Result of browser decryption
 */
export interface BrowserDecryptResult {
  images: Blob[];
  originalNames: string[];
}

// biome-ignore lint/complexity/noStaticOnlyClass:
export default class BrowserImageShield {
  /**
   * Encrypt images in browser environment
   */
  static async encrypt(options: BrowserEncryptOptions): Promise<BrowserEncryptResult> {
    const { images, config, secretKey } = this.validateEncryptOptions(options);

    // Convert Files to paths (using file names for compatibility)
    const imagePaths = images.map(file => file.name);

    const fragmenter = new ImageFragmenter(
      config ?? {},
      verifySecretKey(secretKey),
    );

    // We need to modify fragmenter to accept File objects instead of paths
    // For now, we'll use a workaround
    const { manifest, fragmentedImages } = await this.fragmentImagesFromFiles(
      fragmenter,
      images
    );

    // Create file blobs
    const files: Record<string, Blob> = {};
    
    // Add manifest
    files['manifest.json'] = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json'
    });

    // Add fragment images
    fragmentedImages.forEach((buffer, i) => {
      const filename = generateFragmentFileName(manifest, i);
      files[filename] = BrowserFileHandler.bufferToPngBlob(buffer);
    });

    return { manifest, files };
  }

  /**
   * Decrypt images in browser environment
   */
  static async decrypt(options: BrowserDecryptOptions): Promise<BrowserDecryptResult> {
    const { fragmentFiles, manifestData, secretKey } = this.validateDecryptOptions(options);

    // Convert Files to Buffers
    const fragmentBuffers = await Promise.all(
      fragmentFiles.map(async (file) => {
        const arrayBuffer = await BrowserFileHandler.readFile(file);
        return Buffer.from(arrayBuffer);
      })
    );

    const restorer = new ImageRestorer(verifySecretKey(secretKey));
    const restoredImages = await restorer.restore(fragmentBuffers, manifestData);

    // Convert restored images to Blobs
    const images = restoredImages.map(buffer => 
      BrowserFileHandler.bufferToPngBlob(buffer)
    );

    // Generate original names
    const originalNames = manifestData.sources.map(source => source.originalFileName);

    return { images, originalNames };
  }

  /**
   * Download all files from encrypt result
   */
  static async downloadFiles(result: BrowserEncryptResult): Promise<void> {
    const downloads = Object.entries(result.files).map(([filename, blob]) =>
      BrowserFileHandler.downloadBlob(blob, filename)
    );
    await Promise.all(downloads);
  }

  /**
   * Download all images from decrypt result
   */
  static async downloadImages(result: BrowserDecryptResult): Promise<void> {
    const downloads = result.images.map((blob, i) => {
      const originalName = result.originalNames[i] || `restored_${i}.png`;
      return BrowserFileHandler.downloadBlob(blob, originalName);
    });
    await Promise.all(downloads);
  }

  /**
   * Helper method to fragment images from File objects
   * This is a temporary workaround until we refactor the fragmenter
   */
  private static async fragmentImagesFromFiles(
    fragmenter: ImageFragmenter,
    files: File[]
  ): Promise<{ manifest: ManifestData; fragmentedImages: Buffer[] }> {
    // This is a simplified implementation
    // In a full implementation, we would need to modify ImageFragmenter
    // to work with File objects directly
    throw new Error('Not implemented yet. Need to refactor ImageFragmenter for browser compatibility.');
  }

  private static validateEncryptOptions(options: BrowserEncryptOptions): Required<Omit<BrowserEncryptOptions, 'config' | 'secretKey'>> & Pick<BrowserEncryptOptions, 'config' | 'secretKey'> {
    if (!options.images || !Array.isArray(options.images) || options.images.length === 0) {
      throw new Error("At least one image file is required");
    }

    // Validate that all items are File objects
    for (const item of options.images) {
      if (!(item instanceof File)) {
        throw new Error("All images must be File objects");
      }
    }

    return options as Required<Omit<BrowserEncryptOptions, 'config' | 'secretKey'>> & Pick<BrowserEncryptOptions, 'config' | 'secretKey'>;
  }

  private static validateDecryptOptions(options: BrowserDecryptOptions): Required<Omit<BrowserDecryptOptions, 'secretKey'>> & Pick<BrowserDecryptOptions, 'secretKey'> {
    if (!options.fragmentFiles || !Array.isArray(options.fragmentFiles) || options.fragmentFiles.length === 0) {
      throw new Error("At least one fragment file is required");
    }

    if (!options.manifestData) {
      throw new Error("Manifest data is required");
    }

    // Validate that all items are File objects
    for (const item of options.fragmentFiles) {
      if (!(item instanceof File)) {
        throw new Error("All fragment files must be File objects");
      }
    }

    return options as Required<Omit<BrowserDecryptOptions, 'secretKey'>> & Pick<BrowserDecryptOptions, 'secretKey'>;
  }
}
