import {
  CryptoUtils,
  type DecryptOptions,
  type FragmentationConfig,
  type ManifestData,
  generateRestoredFileName,
  generateRestoredOriginalFileName,
  verifySecretKey,
} from "@image-shield/core";
import { BrowserCryptoProviderImpl } from "./crypto";
import { createFile, downloadFile, readJsonFile } from "./file";
import { BrowserImageRestorer } from "./restorer";

// Browser-specific options that work with File objects instead of file paths
export interface BrowserDecryptOptions {
  /** Fragment image files */
  imageFiles: File[];
  /** Manifest file */
  manifestFile: File;
  /** Secret key (optional) */
  secretKey?: string;
  /** Whether to automatically download restored images (default: true) */
  autoDownload?: boolean;
}

// Initialize the crypto provider - note: we use a compatibility wrapper for the core interface
// The actual implementation will need to handle type differences internally
const browserCryptoProvider = new BrowserCryptoProviderImpl();

// Create a compatibility wrapper for the core interface
const coreCompatibilityProvider = {
  encryptBuffer: (
    buffer: Buffer | Uint8Array,
    key: string,
    iv: Buffer | Uint8Array,
  ) => {
    // Convert to browser types and delegate
    const uint8Buffer =
      buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
    const uint8IV = iv instanceof Buffer ? new Uint8Array(iv) : iv;
    const result = browserCryptoProvider.encryptBuffer(
      uint8Buffer,
      key,
      uint8IV,
    );
    // Convert back to Buffer for core interface compatibility
    return Buffer.from(result);
  },
  decryptBuffer: (
    buffer: Buffer | Uint8Array,
    key: string,
    iv: Buffer | Uint8Array,
  ) => {
    // Convert to browser types and delegate
    const uint8Buffer =
      buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
    const uint8IV = iv instanceof Buffer ? new Uint8Array(iv) : iv;
    const result = browserCryptoProvider.decryptBuffer(
      uint8Buffer,
      key,
      uint8IV,
    );
    // Convert back to Buffer for core interface compatibility
    return Buffer.from(result);
  },
  keyTo32: (key: string) => {
    const result = browserCryptoProvider.keyTo32(key);
    return Buffer.from(result);
  },
  generateUUID: () => browserCryptoProvider.generateUUID(),
  uuidToIV: (uuid: string) => {
    const result = browserCryptoProvider.uuidToIV(uuid);
    return Buffer.from(result);
  },
};

CryptoUtils.setProvider(coreCompatibilityProvider);

export { BrowserImageRestorer, type FragmentationConfig, type ManifestData };

export default class BrowserImageShield {
  /**
   * Decrypt fragmented images in the browser
   * @param options Decryption options with File objects
   * @returns Promise resolving to array of restored image files
   */
  static async decrypt(options: BrowserDecryptOptions): Promise<File[]> {
    const {
      imageFiles,
      manifestFile,
      secretKey,
      autoDownload = true,
    } = validateDecryptOptions(options);

    const manifest = await readJsonFile<ManifestData>(manifestFile);

    const restorer = new BrowserImageRestorer(verifySecretKey(secretKey));
    const restoredBlobs = await restorer.restoreImages(imageFiles, manifest);

    const imageInfos = manifest.images;
    const restoredFiles = restoredBlobs.map((blob, i) => {
      const filename =
        generateRestoredOriginalFileName(imageInfos[i]) ??
        generateRestoredFileName(manifest, i);
      return createFile(blob, filename, "image/png");
    });

    // Auto-download files if requested
    if (autoDownload) {
      for (const file of restoredFiles) {
        downloadFile(file);
      }
    }

    return restoredFiles;
  }

  /**
   * Decrypt fragmented images and return as blobs (no auto-download)
   * @param options Decryption options with File objects
   * @returns Promise resolving to array of restored image blobs
   */
  static async decryptToBlobs(
    options: Omit<BrowserDecryptOptions, "autoDownload">,
  ): Promise<Blob[]> {
    const { imageFiles, manifestFile, secretKey } =
      validateDecryptOptions(options);

    const manifest = await readJsonFile<ManifestData>(manifestFile);
    const restorer = new BrowserImageRestorer(verifySecretKey(secretKey));

    return await restorer.restoreImages(imageFiles, manifest);
  }
}

function validateDecryptOptions(options: BrowserDecryptOptions) {
  if (!options.imageFiles || !Array.isArray(options.imageFiles)) {
    throw new Error("imageFiles must be an array of File objects");
  }

  if (options.imageFiles.length === 0) {
    throw new Error("imageFiles cannot be empty");
  }

  if (!options.manifestFile || !(options.manifestFile instanceof File)) {
    throw new Error("manifestFile must be a File object");
  }

  // Validate that all imageFiles are File objects
  for (let i = 0; i < options.imageFiles.length; i++) {
    if (!(options.imageFiles[i] instanceof File)) {
      throw new Error(`imageFiles[${i}] must be a File object`);
    }
  }

  return {
    imageFiles: options.imageFiles,
    manifestFile: options.manifestFile,
    secretKey: options.secretKey,
    autoDownload: options.autoDownload ?? true,
  };
}
