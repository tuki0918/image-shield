import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
} from "@/types";
import { CryptoUtils } from "@/utils/crypto";
import { SeededRandom } from "@/utils/random";
import sharp from "sharp";

export class ImageFragmenter {
  private config: Omit<FragmentationConfig, "seed"> & { seed: number };

  constructor(config: FragmentationConfig) {
    this.config = {
      ...config,
      seed: config.seed || CryptoUtils.generateSeed(),
    };
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
        filename: imagePath.split("/").pop() || `image_${i}`,
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
          const blockData = this.extractBlock(
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
      this.config.secretKey,
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
        CryptoUtils.encryptBlock(b.data, this.config.secretKey),
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
    const manifest: ManifestData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      config: {
        blockSize: this.config.blockSize,
        seed: this.config.seed,
      },
      images: imageInfos,
      fragmentedFiles: imagePaths.map((_, i) => `fragment_${i}.png`),
    };

    return {
      manifest,
      fragmentedImages,
    };
  }

  private extractBlock(
    imageBuffer: Buffer,
    imageWidth: number,
    imageHeight: number,
    startX: number,
    startY: number,
    blockSize: number,
  ): Buffer {
    const channels = 4; // RGBA
    const blockData: number[] = [];

    for (let y = 0; y < blockSize; y++) {
      for (let x = 0; x < blockSize; x++) {
        const srcX = Math.min(startX + x, imageWidth - 1);
        const srcY = Math.min(startY + y, imageHeight - 1);
        const pixelIndex = (srcY * imageWidth + srcX) * channels;

        for (let c = 0; c < channels; c++) {
          blockData.push(imageBuffer[pixelIndex + c] || 0);
        }
      }
    }

    return Buffer.from(blockData);
  }

  private placeBlock(
    targetBuffer: Buffer,
    blockData: Buffer,
    targetWidth: number,
    destX: number,
    destY: number,
    blockSize: number,
  ): void {
    const channels = 4;

    for (let y = 0; y < blockSize; y++) {
      for (let x = 0; x < blockSize; x++) {
        const srcIndex = (y * blockSize + x) * channels;
        const destIndex = ((destY + y) * targetWidth + (destX + x)) * channels;

        for (let c = 0; c < channels; c++) {
          targetBuffer[destIndex + c] = blockData[srcIndex + c];
        }
      }
    }
  }

  // encryptedBlocks: string[]
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
      const blockData = CryptoUtils.decryptBlock(
        encryptedBlocks[i],
        this.config.secretKey,
      );
      this.placeBlock(
        fragmentBuffer,
        blockData,
        imageWidth,
        destX,
        destY,
        blockSize,
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
