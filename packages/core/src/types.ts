export interface ShuffleOptions {
  /** Image paths (e.g., ["image1.png", "image2.png"]) */
  imagePaths: string[];
  /** Fragmentation config */
  config?: FragmentationConfig;
  /** Output directory (e.g., "./output/fragments") */
  outputDir: string;
}

export interface RestoreOptions {
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
  /** Preserve original file name (optional, default: false) */
  preserveName?: boolean;
}

/**
 * Information about the image before fragmentation.
 * This includes dimensions, channels, and block counts.
 */
export interface ImageInfo {
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
  images: ImageInfo[];
}

export interface FragmentationResult {
  /** Manifest data */
  manifest: ManifestData;
  /** Fragmented images */
  fragmentedImages: Buffer[];
}
