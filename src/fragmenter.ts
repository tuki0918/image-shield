import { DEFAULT_FRAGMENTATION_CONFIG, VERSION } from "./constraints";
import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
} from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  imageFileToBlocks,
} from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { fileNameWithoutExtension } from "./utils/file";
import { SeededRandom, shuffleArrayWithKey } from "./utils/random";

export class ImageFragmenter {
  private config: Required<FragmentationConfig>;
  private secretKey?: string;

  constructor(config: FragmentationConfig, secretKey?: string) {
    this.config = {
      blockSize: config.blockSize ?? DEFAULT_FRAGMENTATION_CONFIG.BLOCK_SIZE,
      prefix: config.prefix ?? DEFAULT_FRAGMENTATION_CONFIG.PREFIX,
      seed: config.seed || SeededRandom.generateSeed(),
      restoreFileName:
        config.restoreFileName ??
        DEFAULT_FRAGMENTATION_CONFIG.RESTORE_FILE_NAME,
    };
    this.secretKey = secretKey;
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this._prepareFragmentData(imagePaths);

    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    const fragmentedImages: Buffer[] = await Promise.all(
      manifest.images.map(async (_, i) => {
        // Calculate slice range using cumulative sum
        const start = fragmentBlocksCount
          .slice(0, i)
          .reduce((a, b) => a + b, 0);
        const end = start + fragmentBlocksCount[i];
        const imageBlocks = shuffledBlocks.slice(start, end);
        const fragmentImage = await this._createFragmentImage(
          imageBlocks,
          fragmentBlocksCount[i],
          manifest.config.blockSize,
        );
        // Encrypt if secretKey is set
        return this.secretKey
          ? CryptoUtils.encryptBuffer(
              fragmentImage,
              this.secretKey,
              CryptoUtils.uuidToIV(manifest.id),
            )
          : fragmentImage;
      }),
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  private _createManifest(imageInfos: ImageInfo[]): ManifestData {
    // Check if there are duplicate file names when restoreFileName is true
    if (this.config.restoreFileName && imageInfos.length > 1) {
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

    const secure = !!this.secretKey;
    const algorithm = secure ? "aes-256-cbc" : undefined;
    return {
      id: CryptoUtils.generateUUID(),
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: imageInfos.map((info) => ({
        w: info.width,
        h: info.height,
        c: 4, // Always use 4 channels (RGBA) for generated PNG
        x: info.blockCountX,
        y: info.blockCountY,
        name: info.name,
      })),
      algorithm,
      secure,
    };
  }

  private async _prepareFragmentData(imagePaths: string[]): Promise<{
    manifest: ManifestData;
    allBlocks: Buffer[];
    fragmentBlocksCount: number[];
  }> {
    const { imageInfos, allBlocks } =
      await this._processSourceImages(imagePaths);
    const manifest = this._createManifest(imageInfos);
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
      imagePaths.map(async (imagePath) => {
        const { blocks, width, height, channels, blockCountX, blockCountY } =
          await imageFileToBlocks(imagePath, this.config.blockSize);
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
      }),
    );

    const imageInfos = processedImages.map((p) => p.imageInfo);
    const allBlocks = processedImages.flatMap((p) => p.blocks);

    return { imageInfos, allBlocks };
  }

  private async _createFragmentImage(
    blocks: Buffer[],
    blockCount: number,
    blockSize: number,
  ): Promise<Buffer> {
    // Calculate fragmented image size
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;
    return await blocksToPngImage(blocks, imageWidth, imageHeight, blockSize);
  }
}
