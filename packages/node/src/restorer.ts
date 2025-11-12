import {
  type ImageInfo,
  type ManifestData,
  calcBlocksPerFragment,
  calculateBlockRange,
} from "@image-shield/core";
import { unshuffle } from "@tuki0918/seeded-shuffle";
import { blocksPerImage, blocksToPngImage, imageFileToBlocks } from "./block";
import { readFileBuffer } from "./file";

export class ImageRestorer {
  async restoreImages(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const { allBlocks, imageBlockCounts } = await this._prepareRestoreData(
      fragmentImages,
      manifest,
    );

    const restoredBlocks = manifest.config.crossImageShuffle
      ? unshuffle(allBlocks, manifest.config.seed)
      : this._unshufflePerImage(
          allBlocks,
          imageBlockCounts,
          manifest.config.seed,
        );

    const reconstructedImages = await this._reconstructAllImages(
      restoredBlocks,
      manifest,
    );

    return reconstructedImages;
  }

  private async _reconstructAllImages(
    restoredBlocks: Buffer[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const imageBlockCounts = manifest.images.map((info) => info.x * info.y);
    return await Promise.all(
      manifest.images.map(async (imageInfo, index) => {
        const { start, end } = calculateBlockRange(imageBlockCounts, index);
        const imageBlocks = restoredBlocks.slice(start, end);
        return await this._reconstructImage(
          imageBlocks,
          manifest.config.blockSize,
          imageInfo,
        );
      }),
    );
  }

  private async _prepareRestoreData(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<{
    allBlocks: Buffer[];
    imageBlockCounts: number[];
  }> {
    this._validateInputs(fragmentImages, manifest);

    const totalBlocks = this._calculateTotalBlocks(manifest.images);
    const fragmentBlocksCount = calcBlocksPerFragment(
      totalBlocks,
      fragmentImages.length,
    );

    // Calculate actual block counts per image for per-image unshuffle
    const imageBlockCounts = manifest.images.map((info) => info.x * info.y);

    // Use imageBlockCounts when crossImageShuffle is false
    const blocksCounts = manifest.config.crossImageShuffle
      ? fragmentBlocksCount
      : imageBlockCounts;

    const allBlocks = await this._extractBlocksFromFragments(
      fragmentImages,
      manifest,
      blocksCounts,
    );

    return { allBlocks, imageBlockCounts };
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

  private _calculateTotalBlocks(images: ImageInfo[]): number {
    return images.reduce((total, image) => total + image.x * image.y, 0);
  }

  // Extract an array of blocks (Buffer) from a fragment image
  private async _extractBlocksFromFragment(
    fragmentImage: string | Buffer,
    manifest: ManifestData,
    expectedBlockCount: number,
  ): Promise<Buffer[]> {
    const imageBuffer = Buffer.isBuffer(fragmentImage)
      ? fragmentImage
      : await readFileBuffer(fragmentImage);

    const { blocks } = await imageFileToBlocks(
      imageBuffer,
      manifest.config.blockSize,
    );
    return blocks.slice(0, expectedBlockCount);
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
    imageInfo: ImageInfo,
  ): Promise<Buffer> {
    const { w, h } = imageInfo;
    return await blocksToPngImage(blocks, w, h, blockSize);
  }

  private _unshufflePerImage(
    allBlocks: Buffer[],
    fragmentBlocksCount: number[],
    seed: number | string,
  ): Buffer[] {
    return blocksPerImage(allBlocks, fragmentBlocksCount, seed, unshuffle);
  }
}
