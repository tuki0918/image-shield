import crypto from "node:crypto";
import {
  DEFAULT_FRAGMENTATION_CONFIG,
  type FragmentationConfig,
  type FragmentationResult,
  type ImageInfo,
  type ManifestData,
  calcBlocksPerFragment,
} from "@image-shield/core";
import { SeededRandom, shuffle } from "@tuki0918/seeded-shuffle";
import { blocksToPngImage, imageFileToBlocks } from "./block";
import { VERSION } from "./constants";
import { fileNameWithoutExtension, readFileBuffer } from "./file";

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
      restoreFileName:
        config.restoreFileName ??
        DEFAULT_FRAGMENTATION_CONFIG.RESTORE_FILE_NAME,
    };
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this._prepareFragmentData(imagePaths);

    const shuffledBlocks = shuffle(allBlocks, manifest.config.seed);

    const fragmentedImages = await this._createFragmentedImages(
      shuffledBlocks,
      fragmentBlocksCount,
      manifest,
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  private async _createFragmentedImages(
    shuffledBlocks: Buffer[],
    fragmentBlocksCount: number[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    return await Promise.all(
      manifest.images.map(async (_, index) => {
        const { start, end } = this._calculateBlockRange(
          fragmentBlocksCount,
          index,
        );
        const imageBlocks = shuffledBlocks.slice(start, end);
        return await this._createFragmentImage(
          imageBlocks,
          manifest.config.blockSize,
        );
      }),
    );
  }

  private _calculateBlockRange(
    fragmentBlocksCount: number[],
    targetIndex: number,
  ): { start: number; end: number } {
    const start = fragmentBlocksCount
      .slice(0, targetIndex)
      .reduce((sum, count) => sum + count, 0);
    const end = start + fragmentBlocksCount[targetIndex];

    return { start, end };
  }

  private _createManifest(
    manifestId: string,
    imageInfos: ImageInfo[],
  ): ManifestData {
    this._validateFileNames(imageInfos);

    return {
      id: manifestId,
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: this._mapImageInfosToShortFormat(imageInfos),
    };
  }

  private _validateFileNames(imageInfos: ImageInfo[]): void {
    if (!this.config.restoreFileName || imageInfos.length <= 1) {
      return;
    }

    const nameSet = new Set<string>();

    for (const info of imageInfos) {
      if (info.name !== undefined) {
        if (nameSet.has(info.name)) {
          throw new Error(`Duplicate file name detected: ${info.name}`);
        }
        nameSet.add(info.name);
      }
    }
  }

  private _mapImageInfosToShortFormat(imageInfos: ImageInfo[]) {
    return imageInfos.map((info) => ({
      w: info.width,
      h: info.height,
      c: 4, // Always use 4 channels (RGBA) for generated PNG
      x: info.blockCountX,
      y: info.blockCountY,
      name: info.name,
    }));
  }

  private async _prepareFragmentData(imagePaths: string[]): Promise<{
    manifest: ManifestData;
    allBlocks: Buffer[];
    fragmentBlocksCount: number[];
  }> {
    const manifestId = crypto.randomUUID();

    const { imageInfos, allBlocks } =
      await this._processSourceImages(imagePaths);

    const manifest = this._createManifest(manifestId, imageInfos);

    const fragmentBlocksCount = calcBlocksPerFragment(
      allBlocks.length,
      imagePaths.length,
    );

    return { manifest, allBlocks, fragmentBlocksCount };
  }

  private async _processSourceImages(imagePaths: string[]): Promise<{
    imageInfos: ImageInfo[];
    allBlocks: Buffer[];
  }> {
    const processedImages = await Promise.all(
      imagePaths.map((imagePath) => this._processSourceImage(imagePath)),
    );

    const imageInfos = processedImages.map((p) => p.imageInfo);
    const allBlocks = processedImages.flatMap((p) => p.blocks);

    return { imageInfos, allBlocks };
  }

  private async _processSourceImage(imagePath: string): Promise<{
    imageInfo: ImageInfo;
    blocks: Buffer[];
  }> {
    const imageBuffer = await readFileBuffer(imagePath);

    const { blocks, width, height, channels, blockCountX, blockCountY } =
      await imageFileToBlocks(imageBuffer, this.config.blockSize);

    const imageInfo: ImageInfo = {
      width,
      height,
      channels,
      blockCountX,
      blockCountY,
      name: this.config.restoreFileName
        ? fileNameWithoutExtension(imagePath)
        : undefined,
    };

    return { imageInfo, blocks };
  }

  private async _createFragmentImage(
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
