export interface FragmentationConfig {
  /** Pixel block size (e.g., 10x10 to 10) */
  blockSize: number;
  /** Encryption key */
  secretKey: string;
  /** Random seed (auto-generated if not specified) */
  seed?: number;
}

export interface ImageInfo {
  /** File name */
  filename: string;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Number of channels */
  channels: number;
  /** Number of blocks X */
  blockCountX: number;
  /** Number of blocks Y */
  blockCountY: number;
}

export interface ManifestData {
  /** Version */
  version: string;
  /** Timestamp */
  timestamp: string;
  /** Config */
  config: {
    /** Pixel block size */
    blockSize: number;
    /** Random seed */
    seed: number;
  };
  /** Image information */
  images: ImageInfo[];
  /** Fragmented file names */
  fragmentedFiles: string[];
}

export interface FragmentationResult {
  /** Manifest data */
  manifest: ManifestData;
  /** Fragmented images */
  fragmentedImages: Buffer[];
}
