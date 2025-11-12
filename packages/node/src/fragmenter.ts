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

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount, imageBlockCounts } =
      await this._prepareData(imagePaths);

    const shuffledBlocks = this.config.crossImageShuffle
      ? shuffle(allBlocks, manifest.config.seed)
      : blocksPerImage(
          allBlocks,
          imageBlockCounts,
          manifest.config.seed,
          shuffle,
        );

    const fragmentedImages = await this._createImages(
      shuffledBlocks,
      this.config.crossImageShuffle ? fragmentBlocksCount : imageBlockCounts,
      manifest,
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  private async _createImages(
    shuffledBlocks: Buffer[],
    fragmentBlocksCount: number[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    return await Promise.all(
      manifest.images.map(async (_, index) => {
        const { start, end } = calculateBlockRange(fragmentBlocksCount, index);
        const imageBlocks = shuffledBlocks.slice(start, end);
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

  private async _prepareData(imagePaths: string[]): Promise<{
    manifest: ManifestData;
    allBlocks: Buffer[];
    fragmentBlocksCount: number[];
    imageBlockCounts: number[];
  }> {
    const manifestId = generateManifestId();

    const { imageInfos, allBlocks } = await this._processImages(imagePaths);

    validateFileNames(imageInfos, this.config.preserveName);

    const manifest = this._createManifest(manifestId, imageInfos);

    const fragmentBlocksCount = calculateBlocksPerFragment(
      allBlocks.length,
      imagePaths.length,
    );

    // Calculate actual block counts per image for per-image shuffle
    const imageBlockCounts = calculateImageBlockCounts(imageInfos);

    return { manifest, allBlocks, fragmentBlocksCount, imageBlockCounts };
  }

  private async _processImages(imagePaths: string[]): Promise<{
    imageInfos: ImageInfo[];
    allBlocks: Buffer[];
  }> {
    const processedImages = await Promise.all(
      imagePaths.map((imagePath) => this._processImage(imagePath)),
    );

    const imageInfos = processedImages.map((p) => p.imageInfo);
    const allBlocks = processedImages.flatMap((p) => p.blocks);

    return { imageInfos, allBlocks };
  }

  private async _processImage(imagePath: string): Promise<{
    imageInfo: ImageInfo;
    blocks: Buffer[];
  }> {
    const imageBuffer = await readFileBuffer(imagePath);

    const { blocks, width, height, channels, blockCountX, blockCountY } =
      await imageFileToBlocks(imageBuffer, this.config.blockSize);

    const imageInfo: ImageInfo = {
      w: width,
      h: height,
      c: 4, // Always use 4 channels (RGBA) for generated PNG
      x: blockCountX,
      y: blockCountY,
      name: this.config.preserveName
        ? encodeFileName(fileNameWithoutExtension(imagePath))
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
