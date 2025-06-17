import { VERSION } from "./constraints";
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
      ...config,
      prefix: config.prefix ?? "fragment",
      seed: config.seed || SeededRandom.generateSeed(),
      restoreFileName: config.restoreFileName ?? false,
    };
    this.secretKey = secretKey;
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this.prepareFragments(imagePaths);

    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    const fragmentedImages: Buffer[] = await Promise.all(
      manifest.images.map(async (_, i) => {
        // Calculate slice range using cumulative sum
        const start = fragmentBlocksCount
          .slice(0, i)
          .reduce((a, b) => a + b, 0);
        const end = start + fragmentBlocksCount[i];
        const imageBlocks = shuffledBlocks.slice(start, end);
        const fragmentImage = await this.createFragmentImage(
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

  private createManifest(imageInfos: ImageInfo[]): ManifestData {
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

  private async prepareFragments(imagePaths: string[]): Promise<{
    manifest: ManifestData;
    allBlocks: Buffer[];
    fragmentBlocksCount: number[];
  }> {
    const imageInfos: ImageInfo[] = [];
    const allBlocks: Buffer[] = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
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
      imageInfos.push(imageInfo);
      allBlocks.push(...blocks);
    }
    const manifest = this.createManifest(imageInfos);
    const fragmentBlocksCount = calcBlocksPerFragment(
      allBlocks.length,
      imagePaths.length,
    );
    return { manifest, allBlocks, fragmentBlocksCount };
  }

  private async createFragmentImage(
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
