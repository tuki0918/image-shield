import type { ManifestData, ShortImageInfo } from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  decryptPngImageBuffer,
  imageFileToBlocks,
} from "./utils/block";
import { readFileBuffer } from "./utils/file";
import { unshuffleArrayWithKey } from "./utils/random";

export class ImageRestorer {
  private secretKey?: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey;
  }

  async restoreImages(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const { allBlocks } = await this._prepareRestoreData(
      fragmentImages,
      manifest,
    );

    const restoredBlocks = unshuffleArrayWithKey(
      allBlocks,
      manifest.config.seed,
    );

    return await this._reconstructAllImages(restoredBlocks, manifest);
  }

  private async _reconstructAllImages(
    restoredBlocks: Buffer[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    return await Promise.all(
      manifest.images.map(async (imageInfo, index) => {
        const { start, end } = this._calculateBlockRange(
          manifest.images,
          index,
        );
        const imageBlocks = restoredBlocks.slice(start, end);
        return await this._reconstructImage(
          imageBlocks,
          manifest.config.blockSize,
          imageInfo,
        );
      }),
    );
  }

  private _calculateBlockRange(
    images: ShortImageInfo[],
    targetIndex: number,
  ): { start: number; end: number } {
    const blockCount = images[targetIndex].x * images[targetIndex].y;
    const start = images
      .slice(0, targetIndex)
      .reduce((sum, img) => sum + img.x * img.y, 0);
    const end = start + blockCount;

    return { start, end };
  }

  private async _prepareRestoreData(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<{ allBlocks: Buffer[]; fragmentBlocksCount: number[] }> {
    this._validateInputs(fragmentImages, manifest);

    const totalBlocks = this._calculateTotalBlocks(manifest.images);
    const fragmentBlocksCount = calcBlocksPerFragment(
      totalBlocks,
      fragmentImages.length,
    );

    const allBlocks = await this._extractBlocksFromFragments(
      fragmentImages,
      manifest,
      fragmentBlocksCount,
    );

    return { allBlocks, fragmentBlocksCount };
  }

  private _validateInputs(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): void {
    const manifestImageCount = manifest.images.length;
    const fragmentImageCount = fragmentImages.length;

    if (manifestImageCount !== fragmentImageCount) {
      throw new Error(
        `Fragment image count mismatch: expected ${manifestImageCount} but got ${fragmentImageCount}`,
      );
    }
  }

  private _calculateTotalBlocks(images: ShortImageInfo[]): number {
    return images.reduce((total, image) => total + image.x * image.y, 0);
  }

  // Extract an array of blocks (Buffer) from a fragment image
  private async _extractBlocksFromFragment(
    fragmentImage: string | Buffer,
    manifest: ManifestData,
    expectedBlockCount: number,
  ): Promise<Buffer[]> {
    const buf = await this._readImageBuffer(fragmentImage);
    const processedBuffer = await this._processImageBuffer(buf, manifest);

    const { blocks } = await imageFileToBlocks(
      processedBuffer,
      manifest.config.blockSize,
    );

    return blocks.slice(0, expectedBlockCount);
  }

  private async _readImageBuffer(
    fragmentImage: string | Buffer,
  ): Promise<Buffer> {
    return Buffer.isBuffer(fragmentImage)
      ? fragmentImage
      : await readFileBuffer(fragmentImage);
  }

  private async _processImageBuffer(
    buffer: Buffer,
    manifest: ManifestData,
  ): Promise<Buffer> {
    if (manifest.secure && this.secretKey) {
      return await decryptPngImageBuffer(buffer, this.secretKey, manifest.id);
    }
    return buffer;
  }

  private async _extractBlocksFromFragments(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
    fragmentBlocksCount: number[],
  ): Promise<Buffer[]> {
    const blocksArrays = await Promise.all(
      fragmentImages.map((fragmentImage, i) =>
        this._extractBlocksFromFragment(
          fragmentImage,
          manifest,
          fragmentBlocksCount[i],
        ),
      ),
    );
    return blocksArrays.flat();
  }

  private async _reconstructImage(
    blocks: Buffer[],
    blockSize: number,
    imageInfo: ShortImageInfo,
  ): Promise<Buffer> {
    const { w, h } = imageInfo;
    return await blocksToPngImage(blocks, w, h, blockSize);
  }
}
