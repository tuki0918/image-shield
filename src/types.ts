export interface EncryptOptions {
  /** Image paths (e.g., ["image1.png", "image2.png"]) */
  imagePaths: string[];
  /** Fragmentation config */
  config: FragmentationConfig;
  /** Output directory (e.g., "./output/fragments") */
  outputDir: string;
}

export interface RestoreOptions {
  /** Manifest path (e.g., "./output/fragments/manifest.json") */
  manifestPath: string;
  /** Fragment directory (e.g., "./output/fragments") */
  fragmentDir: string;
  /** Output directory (e.g., "./output/restored") */
  outputDir: string;
  /** Secret key */
  secretKey: string;
}

export interface FragmentationConfig {
  /** Pixel block size (e.g., 10x10 to 10) */
  blockSize: number;
  /** Encryption key */
  secretKey: string;
  /** Prefix for fragment files (optional, default: "fragment") */
  prefix?: string;
  /** Random seed (auto-generated if not specified) */
  seed?: number;
}

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
}

export interface ManifestData {
  /** UUID */
  id: string;
  /** Version */
  version: string;
  /** Timestamp */
  timestamp: string;
  /** Config */
  config: {
    /** Pixel block size */
    blockSize: number;
    /** Prefix */
    prefix: string;
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
