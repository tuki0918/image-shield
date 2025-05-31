import sharp from "sharp";
import type { ManifestData, ShortImageInfo } from "./types";
import { bufferToPng, extractBlock, placeBlock } from "./utils/block";
import { splitImageToBlocks } from "./utils/block";
import { imageFileToBlocks } from "./utils/block";
import { calcBlocksPerFragment } from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { getImageBlockInfo } from "./utils/image";
import { assembleImageFromBlocks } from "./utils/imageAssembler";
import { SeededRandom } from "./utils/random";
import { generateShuffleIndices, unshuffleByIndices } from "./utils/random";

export class ImageRestorer {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async restoreImages(
    fragmentImagePaths: string[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    // 1. Calculate the number of blocks for each image
    const imageBlockCounts = manifest.images.map((img) => img.x * img.y);
    const totalBlocks = imageBlockCounts.reduce((a, b) => a + b, 0);

    // 2. Calculate the number of blocks per fragment image (same logic as fragmenter.ts)
    const fragmentBlocksCount = calcBlocksPerFragment(
      totalBlocks,
      fragmentImagePaths.length,
    );

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

    // 4. Reproduce the shuffle order (common logic)
    const mixedSeed = SeededRandom.createSeedFromKeyAndSeed(
      this.secretKey,
      manifest.config.seed,
    );
    const shuffleIndices = generateShuffleIndices(totalBlocks, mixedSeed);

    // 5. Unshuffle (restore original order)
    const encryptedBlocks = CryptoUtils.encryptBlocks(
      allBlocks,
      this.secretKey,
    );
    const decryptedBlocks = CryptoUtils.decryptBlocks(
      encryptedBlocks,
      this.secretKey,
    );
    const restoredBlocks = unshuffleByIndices(decryptedBlocks, shuffleIndices);

    // 6. Assign blocks to each image and restore
    const restoredImages: Buffer[] = [];
    let blockPtr = 0;
    for (let imgIdx = 0; imgIdx < manifest.images.length; imgIdx++) {
      const imageInfo = manifest.images[imgIdx];
      const blockCount = imageInfo.x * imageInfo.y;
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
    // Use utility to load image and split into blocks
    // This returns blocks, width, height, channels
    const { blocks } = await imageFileToBlocks(
      fragmentPath,
      manifest.config.blockSize,
    );
    return blocks;
  }

  private async reconstructImage(
    blocks: Buffer[],
    imageInfo: ShortImageInfo,
    blockSize: number,
  ): Promise<Buffer> {
    const { w, h, c } = imageInfo;
    return await assembleImageFromBlocks(blocks, w, h, blockSize, c);
  }
}
