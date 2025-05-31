import crypto from "node:crypto";
import sharp from "sharp";
import { VERSION } from "./constraints";
import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
} from "./types";
import { extractBlock, placeBlock } from "./utils/block";
import { bufferToPng } from "./utils/block";
import { splitImageToBlocks } from "./utils/block";
import { imageFileToBlocks } from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { getImageBlockInfo } from "./utils/image";
import { assembleImageFromBlocks } from "./utils/imageAssembler";
import { SeededRandom } from "./utils/random";
import { applyShuffleByIndices, generateShuffleIndices } from "./utils/random";

export class ImageFragmenter {
  private config: Omit<FragmentationConfig, "seed"> & { seed: number };
  private secretKey: string;

  constructor(config: FragmentationConfig, secretKey: string) {
    this.config = {
      ...config,
      seed: config.seed || CryptoUtils.generateSeed(),
    };
    this.secretKey = secretKey;
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const imageInfos: ImageInfo[] = [];
    const allBlocks: Array<{
      data: Buffer;
      sourceIndex: number;
      blockIndex: number;
    }> = [];

    // Load each image and split into blocks
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      // Use utility to load image and split into blocks
      // This returns blocks, width, height, channels
      const { blocks, width, height, channels } = await imageFileToBlocks(
        imagePath,
        this.config.blockSize,
      );
      const imageInfo = {
        width,
        height,
        channels,
        blockCountX: Math.ceil(width / this.config.blockSize),
        blockCountY: Math.ceil(height / this.config.blockSize),
      };
      imageInfos.push(imageInfo);
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        allBlocks.push({
          data: blocks[blockIndex],
          sourceIndex: i,
          blockIndex,
        });
      }
    }

    // Shuffle blocks (common logic)
    const mixedSeed = SeededRandom.createSeedFromKeyAndSeed(
      this.secretKey,
      this.config.seed,
    );
    const shuffleIndices = generateShuffleIndices(allBlocks.length, mixedSeed);
    const shuffledBlocks = applyShuffleByIndices(allBlocks, shuffleIndices);

    // Distribute shuffled blocks into output images
    const fragmentedImages: Buffer[] = [];
    const blocksPerImage = Math.ceil(shuffledBlocks.length / imagePaths.length);

    for (let i = 0; i < imagePaths.length; i++) {
      const startIndex = i * blocksPerImage;
      const endIndex = Math.min(
        (i + 1) * blocksPerImage,
        shuffledBlocks.length,
      );
      const imageBlocks = shuffledBlocks.slice(startIndex, endIndex);

      // Encrypt each block
      const encryptedBlocks = CryptoUtils.encryptBlocks(
        imageBlocks.map((b) => b.data),
        this.secretKey,
      );
      // Create fragment image
      const fragmentImage = await this.createFragmentImage(
        encryptedBlocks,
        imageBlocks.length,
        this.config.blockSize,
      );
      fragmentedImages.push(fragmentImage);
    }

    // Create manifest
    const prefix = this.config.prefix || "fragment";
    const manifest: ManifestData = {
      id: crypto.randomUUID(),
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: {
        blockSize: this.config.blockSize,
        seed: this.config.seed,
        prefix,
      },
      images: imageInfos.map((info) => ({
        w: info.width,
        h: info.height,
        // c: info.channels,
        c: 4, // Always use 4 channels (RGBA) for PNG
        x: info.blockCountX,
        y: info.blockCountY,
      })),
    };

    return {
      manifest,
      fragmentedImages,
    };
  }

  private async createFragmentImage(
    encryptedBlocks: string[],
    blockCount: number,
    blockSize: number,
  ): Promise<Buffer> {
    const channels = 4;
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;
    // Decrypt all blocks
    const blocks: Buffer[] = encryptedBlocks.map((b) =>
      CryptoUtils.decryptBlock(b, this.secretKey),
    );
    // Use common assembler
    return await assembleImageFromBlocks(
      blocks,
      imageWidth,
      imageHeight,
      blockSize,
      channels,
    );
  }
}
