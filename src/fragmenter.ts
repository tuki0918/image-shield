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
import { CryptoUtils } from "./utils/crypto";
import { SeededRandom } from "./utils/random";

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
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error(`Invalid image metadata: ${imagePath}`);
      }

      const blockCountX = Math.ceil(metadata.width / this.config.blockSize);
      const blockCountY = Math.ceil(metadata.height / this.config.blockSize);

      const imageInfo: ImageInfo = {
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels || 3,
        blockCountX,
        blockCountY,
      };
      imageInfos.push(imageInfo);

      // Convert image to RGBA
      const imageBuffer = await image.ensureAlpha().raw().toBuffer();

      // Split into blocks
      for (let by = 0; by < blockCountY; by++) {
        for (let bx = 0; bx < blockCountX; bx++) {
          const blockData = extractBlock(
            imageBuffer,
            metadata.width,
            metadata.height,
            bx * this.config.blockSize,
            by * this.config.blockSize,
            this.config.blockSize,
          );

          allBlocks.push({
            data: blockData,
            sourceIndex: i,
            blockIndex: by * blockCountX + bx,
          });
        }
      }
    }

    // Shuffle blocks
    const mixedSeed = SeededRandom.createSeedFromKeyAndSeed(
      this.secretKey,
      this.config.seed,
    );
    const random = new SeededRandom(mixedSeed);
    const shuffledBlocks = random.shuffle(allBlocks);

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
      const encryptedBlocks = imageBlocks.map((b) =>
        CryptoUtils.encryptBlock(b.data, this.secretKey),
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
        c: info.channels,
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
    const fragmentBuffer = Buffer.alloc(imageWidth * imageHeight * channels);
    // Decrypt and place blocks
    for (let i = 0; i < encryptedBlocks.length; i++) {
      const row = Math.floor(i / blocksPerRow);
      const col = i % blocksPerRow;
      const destX = col * blockSize;
      const destY = row * blockSize;
      // If the block is at the edge, calculate the actual width/height
      const blockWidth =
        col === blocksPerRow - 1 && encryptedBlocks.length % blocksPerRow !== 0
          ? imageWidth - destX
          : blockSize;
      const blockHeight =
        row === Math.ceil(blockCount / blocksPerRow) - 1
          ? imageHeight - destY
          : blockSize;
      const blockData = CryptoUtils.decryptBlock(
        encryptedBlocks[i],
        this.secretKey,
      );
      placeBlock(
        fragmentBuffer,
        blockData,
        imageWidth,
        destX,
        destY,
        blockSize,
        blockWidth,
        blockHeight,
      );
    }
    return await sharp(fragmentBuffer, {
      raw: {
        width: imageWidth,
        height: imageHeight,
        channels: channels,
      },
    })
      .png({
        compressionLevel: 9,
        quality: 100,
      })
      .toBuffer();
  }
}
