import crypto from "node:crypto";
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
    // 1. Prepare manifest and collect all blocks
    const { manifest, allBlocks } = await this.prepareFragments(imagePaths);

    // 2. Shuffle all blocks
    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    // 3. Calculate the number of blocks per fragment image
    const fragmentBlocksCount = calcBlocksPerFragment(
      shuffledBlocks.length,
      imagePaths.length,
    );

    // 4. Distribute shuffled blocks into fragment images
    const fragmentedImages: Buffer[] = [];
    let blockPtr = 0;
    for (let i = 0; i < manifest.images.length; i++) {
      const count = fragmentBlocksCount[i];
      const imageBlocks = shuffledBlocks.slice(blockPtr, blockPtr + count);
      blockPtr += count;
      // Create fragment image
      const fragmentImage = await this.createFragmentImage(
        imageBlocks,
        count,
        manifest.config.blockSize,
      );
      const outputFragment = this.secretKey
        ? CryptoUtils.encryptBuffer(
            fragmentImage,
            this.secretKey,
            uuidToIV(manifest.id),
          )
        : fragmentImage;
      fragmentedImages.push(outputFragment);
    }

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

  private async prepareFragments(
    imagePaths: string[],
  ): Promise<{ manifest: ManifestData; allBlocks: Buffer[] }> {
    const imageInfos: ImageInfo[] = [];
    const allBlocks: Buffer[] = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const { blocks, width, height, channels } = await imageFileToBlocks(
        imagePath,
        this.config.blockSize,
      );
      const imageInfo: ImageInfo = {
        width,
        height,
        channels,
        blockCountX: Math.ceil(width / this.config.blockSize),
        blockCountY: Math.ceil(height / this.config.blockSize),
      };
      imageInfos.push(imageInfo);
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        allBlocks.push(blocks[blockIndex]);
      }
    }
    const manifest = this.createManifest(imageInfos);
    return { manifest, allBlocks };
  }

  private async createFragmentImage(
    blocks: Buffer[],
    blockCount: number,
    blockSize: number,
  ): Promise<Buffer> {
    const channels = 4;
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;

    // Use common assembler
    return await blocksToPngImage(
      blocks,
      imageWidth,
      imageHeight,
      blockSize,
      channels,
    );
  }
}
