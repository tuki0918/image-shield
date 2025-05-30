import sharp from "sharp";
import type { ImageInfo, ManifestData } from "./types";
import { extractBlock, placeBlock } from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { SeededRandom } from "./utils/random";

export class ImageRestorer {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async restoreImages(
    manifest: ManifestData,
    fragmentImagePaths: string[],
  ): Promise<Buffer[]> {
    // 1. Calculate the number of blocks for each image
    const imageBlockCounts = manifest.images.map(
      (img) => img.blockCountX * img.blockCountY,
    );
    const totalBlocks = imageBlockCounts.reduce((a, b) => a + b, 0);

    // 2. Calculate the number of blocks per fragment image (same logic as fragmenter.ts)
    const fragmentBlocksCount: number[] = [];
    const blocksPerImage = Math.ceil(totalBlocks / fragmentImagePaths.length);
    let remainingBlocks = totalBlocks;
    for (let i = 0; i < fragmentImagePaths.length; i++) {
      const count = Math.min(blocksPerImage, remainingBlocks);
      fragmentBlocksCount.push(count);
      remainingBlocks -= count;
    }

    // 3. Extract all blocks from fragment images (extract the correct number from each fragment image)
    const allBlocks: Buffer[] = [];
    for (let i = 0; i < fragmentImagePaths.length; i++) {
      const fragmentPath = fragmentImagePaths[i];
      const blocks = await this.extractBlocksFromFragment(
        fragmentPath,
        manifest,
      );
      allBlocks.push(...blocks.slice(0, fragmentBlocksCount[i]));
    }

    // 4. Reproduce the shuffle order
    const indices = Array.from({ length: totalBlocks }, (_, i) => i);
    const mixedSeed = SeededRandom.createSeedFromKeyAndSeed(
      this.secretKey,
      manifest.config.seed,
    );
    const random = new SeededRandom(mixedSeed);
    const shuffledIndices = random.shuffle(indices);

    // 5. Unshuffle (restore original order)
    const restoredBlocks: Buffer[] = new Array(totalBlocks);
    for (let i = 0; i < totalBlocks; i++) {
      const encrypted = CryptoUtils.encryptBlock(allBlocks[i], this.secretKey);
      restoredBlocks[shuffledIndices[i]] = CryptoUtils.decryptBlock(
        encrypted,
        this.secretKey,
      );
    }

    // 6. Assign blocks to each image and restore
    const restoredImages: Buffer[] = [];
    let blockPtr = 0;
    for (let imgIdx = 0; imgIdx < manifest.images.length; imgIdx++) {
      const imageInfo = manifest.images[imgIdx];
      const blockCount = imageInfo.blockCountX * imageInfo.blockCountY;
      const imageBlocks = restoredBlocks.slice(blockPtr, blockPtr + blockCount);
      blockPtr += blockCount;
      const restoredImage = await this.reconstructImage(
        imageBlocks,
        imageInfo,
        manifest.config.blockSize,
      );
      restoredImages.push(restoredImage);
    }
    return restoredImages;
  }

  // Extract an array of blocks (Buffer) from a fragment image
  private async extractBlocksFromFragment(
    fragmentPath: string,
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const image = sharp(fragmentPath);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Invalid fragment image: ${fragmentPath}`);
    }
    const blockSize = manifest.config.blockSize;
    const channels = 4;
    const fragmentBuffer = await image.ensureAlpha().raw().toBuffer();
    const blocksPerRow = Math.ceil(metadata.width / blockSize);
    const blocksPerCol = Math.ceil(metadata.height / blockSize);
    const blocks: Buffer[] = [];
    for (let row = 0; row < blocksPerCol; row++) {
      for (let col = 0; col < blocksPerRow; col++) {
        const blockData = extractBlock(
          fragmentBuffer,
          metadata.width,
          undefined,
          col * blockSize,
          row * blockSize,
          blockSize,
        );
        blocks.push(blockData);
      }
    }
    return blocks;
  }

  private async reconstructImage(
    blocks: Buffer[],
    imageInfo: ImageInfo,
    blockSize: number,
  ): Promise<Buffer> {
    const { width, height, blockCountX, blockCountY } = imageInfo;
    const channels = 4;
    const imageBuffer = Buffer.alloc(width * height * channels);

    let blockIndex = 0;
    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        if (blockIndex < blocks.length) {
          placeBlock(
            imageBuffer,
            blocks[blockIndex],
            width,
            bx * blockSize,
            by * blockSize,
            blockSize,
          );
          blockIndex++;
        }
      }
    }

    return await sharp(imageBuffer, {
      raw: {
        width: width,
        height: height,
        channels: channels,
      },
    })
      .png()
      .toBuffer();
  }
}
