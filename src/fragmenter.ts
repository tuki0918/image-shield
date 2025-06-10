import crypto from "node:crypto";
import { VERSION } from "./constraints";
import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
  ShortImageInfo,
} from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  imageFileToBlocks,
} from "./utils/block";
import { CryptoUtils, uuidToIV } from "./utils/crypto";
import { shuffleArrayWithKey } from "./utils/random";

export class ImageFragmenter {
  private config: Required<FragmentationConfig>;
  private secretKey?: string;

  constructor(config: FragmentationConfig, secretKey?: string) {
    this.config = {
      ...config,
      prefix: config.prefix ?? "fragment",
      seed: config.seed || CryptoUtils.generateSeed(),
    };
    this.secretKey = secretKey;
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this.prepareFragments(imagePaths);

    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    const fragmentedImages: Buffer[] = await Promise.all(
      manifest.images.map(async (imageInfo, i) => {
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
          imageInfo,
        );
        // Encrypt if secretKey is set
        return this.secretKey
          ? CryptoUtils.encryptBuffer(
              fragmentImage,
              this.secretKey,
              uuidToIV(manifest.id),
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
    const secure = !!this.secretKey;
    const algorithm = secure ? "aes-256-cbc" : undefined;
    return {
      id: crypto.randomUUID(),
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: imageInfos.map((info) => ({
        w: info.width,
        h: info.height,
        c: 4, // Always use 4 channels (RGBA) for generated PNG
        x: info.blockCountX,
        y: info.blockCountY,
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
    imageInfo: ShortImageInfo,
  ): Promise<Buffer> {
    const { c } = imageInfo;
    // Calculate fragmented image size
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;
    return await blocksToPngImage(
      blocks,
      imageWidth,
      imageHeight,
      blockSize,
      c,
    );
  }
}
