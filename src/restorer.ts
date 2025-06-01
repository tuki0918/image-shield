import type { ManifestData, ShortImageInfo } from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  imageFileToBlocks,
} from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { unshuffleArrayWithKey } from "./utils/random";

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
    const encryptedBlocks: string[] = [];
    for (let i = 0; i < fragmentImagePaths.length; i++) {
      const fragmentPath = fragmentImagePaths[i];
      const blocks = await this.extractBlocksFromFragment(
        fragmentPath,
        manifest,
      );
      // Buffer→Base64文字列に変換
      const base64Blocks = blocks
        .slice(0, fragmentBlocksCount[i])
        .map((b) => b.toString("base64"));
      encryptedBlocks.push(...base64Blocks);
    }

    // 4. 復号
    const decryptedBlocks = encryptedBlocks.map((b) =>
      CryptoUtils.decryptBlock(b, this.secretKey),
    );
    // Unshuffle using the new utility function
    const restoredBlocks = unshuffleArrayWithKey(
      decryptedBlocks,
      this.secretKey,
      manifest.config.seed,
    );

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
    // Use utility to reconstruct PNG image from blocks
    return await blocksToPngImage(blocks, w, h, blockSize, c);
  }
}
