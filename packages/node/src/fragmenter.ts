import {
  DEFAULT_FRAGMENTATION_CONFIG,
  type FragmentationConfig,
  type FragmentationResult,
  type ImageInfo,
  type ManifestData,
  calculateBlockRange,
  calculateBlocksPerFragment,
  calculateImageBlockCounts,
  encodeFileName,
  validateFileNames,
} from "@image-shield/core";
import { SeededRandom, shuffle } from "@tuki0918/seeded-shuffle";
import { blocksPerImage, blocksToPngImage, imageFileToBlocks } from "./block";
import { VERSION } from "./constants";
import { fileNameWithoutExtension, readFileBuffer } from "./file";
import { generateManifestId } from "./utils";

export class ImageFragmenter {
  private config: Required<FragmentationConfig>;

  constructor(config: FragmentationConfig) {
    this.config = this._initializeConfig(config);
  }

  private _initializeConfig(
    config: FragmentationConfig,
  ): Required<FragmentationConfig> {
    return {
      blockSize: config.blockSize ?? DEFAULT_FRAGMENTATION_CONFIG.BLOCK_SIZE,
      prefix: config.prefix ?? DEFAULT_FRAGMENTATION_CONFIG.PREFIX,
      seed: config.seed || SeededRandom.generateSeed(),
      preserveName:
        config.preserveName ?? DEFAULT_FRAGMENTATION_CONFIG.PRESERVE_NAME,
      crossImageShuffle:
        config.crossImageShuffle ??
        DEFAULT_FRAGMENTATION_CONFIG.CROSS_IMAGE_SHUFFLE,
    };
  }

  async fragmentImages(paths: string[]): Promise<FragmentationResult> {
    const { manifest, blocks, blockCountsForCrossImages, blockCountsPerImage } =
      await this._prepareData(paths);

    const shuffled = this.config.crossImageShuffle
      ? shuffle(blocks, manifest.config.seed)
      : blocksPerImage(
          blocks,
          blockCountsPerImage,
          manifest.config.seed,
          shuffle,
        );

    const blockCounts = this.config.crossImageShuffle
      ? blockCountsForCrossImages
      : blockCountsPerImage;

    const fragmentedImages = await this._createImages(
      shuffled,
      blockCounts,
      manifest,
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  private async _createImages(
    blocks: Buffer[],
    blockCounts: number[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    return await Promise.all(
      manifest.images.map(async (_, index) => {
        const { start, end } = calculateBlockRange(blockCounts, index);
        const imageBlocks = blocks.slice(start, end);
        return await this._createImage(imageBlocks, manifest.config.blockSize);
      }),
    );
  }

  private _createManifest(
    manifestId: string,
    imageInfos: ImageInfo[],
  ): ManifestData {
    return {
      id: manifestId,
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: imageInfos,
    };
  }

  private async _prepareData(paths: string[]): Promise<{
    manifest: ManifestData;
    blocks: Buffer[];
    blockCountsForCrossImages: number[];
    blockCountsPerImage: number[];
  }> {
    const manifestId = generateManifestId();

    const { imageInfos, blocks } = await this._processImages(paths);

    validateFileNames(imageInfos, this.config.preserveName);

    const manifest = this._createManifest(manifestId, imageInfos);

    const blockCountsForCrossImages = calculateBlocksPerFragment(
      blocks.length,
      paths.length,
    );

    // Calculate actual block counts per image for per-image shuffle
    const blockCountsPerImage = calculateImageBlockCounts(imageInfos);

    return { manifest, blocks, blockCountsForCrossImages, blockCountsPerImage };
  }

  private async _processImages(paths: string[]): Promise<{
    imageInfos: ImageInfo[];
    blocks: Buffer[];
  }> {
    const results = await Promise.all(
      paths.map((path) => this._processImage(path)),
    );

    const imageInfos = results.map((r) => r.imageInfo);
    const blocks = results.flatMap((r) => r.blocks);

    return { imageInfos, blocks };
  }

  private async _processImage(path: string): Promise<{
    imageInfo: ImageInfo;
    blocks: Buffer[];
  }> {
    const buffer = await readFileBuffer(path);

    const { blocks, width, height, blockCountX, blockCountY } =
      await imageFileToBlocks(buffer, this.config.blockSize);

    const imageInfo: ImageInfo = {
      w: width,
      h: height,
      c: 4, // Always use 4 channels (RGBA) for generated PNG
      x: blockCountX,
      y: blockCountY,
      name: this.config.preserveName
        ? encodeFileName(fileNameWithoutExtension(path))
        : undefined,
    };

    return { imageInfo, blocks };
  }

  private async _createImage(
    blocks: Buffer[],
    blockSize: number,
  ): Promise<Buffer> {
    const blockCount = blocks.length;
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;

    return await blocksToPngImage(blocks, imageWidth, imageHeight, blockSize);
  }
}
