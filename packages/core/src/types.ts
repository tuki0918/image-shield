export interface EncryptOptions {
  /** Image paths (e.g., ["image1.png", "image2.png"]) */
  imagePaths: string[];
  /** Fragmentation config */
  config?: FragmentationConfig;
  /** Output directory (e.g., "./output/fragments") */
  outputDir: string;
}

export interface DecryptOptions {
  /** Image paths (e.g., ["fragment1.png", "fragment2.png"]) */
  imagePaths: string[];
  /** Manifest path (e.g., "./output/fragments/manifest.json") */
  manifestPath: string;
  /** Output directory (e.g., "./output/restored") */
  outputDir: string;
}

export interface FragmentationConfig {
  /** Pixel block size (e.g., 10x10 to 10) */
  blockSize?: number;
  /** Prefix for fragment files (optional, default: "fragment") */
  prefix?: string;
  /** Random seed (auto-generated if not specified) */
  seed?: number | string;
  /** Restore original file name (optional, default: false) */
  restoreFileName?: boolean;
}

/**
 * Information about the image before fragmentation.
 * This includes dimensions, channels, and block counts.
 */
export interface ImageInfo {
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
  /** Original file name (optional) */
  name?: string;
}

/**
 * Shortened version of ImageInfo
 */
export interface ShortImageInfo {
  /** Width */
  w: number;
  /** Height */
  h: number;
  /** Number of channels */
  c: number;
  /** Number of blocks X */
  x: number;
  /** Number of blocks Y */
  y: number;
  /** Original file name (optional) */
  name?: string;
}

export interface ManifestData {
  /** UUID */
  id: string;
  /** Version */
  version: string;
  /** Timestamp */
  timestamp: string;
  /** Config */
  config: Required<FragmentationConfig>;
  /** Image information */
  images: ShortImageInfo[];
}

export interface FragmentationResult {
  /** Manifest data */
  manifest: ManifestData;
  /** Fragmented images */
  fragmentedImages: Buffer[];
}
