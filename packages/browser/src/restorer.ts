import {
  type ManifestData,
  type ShortImageInfo,
  calcBlocksPerFragment,
} from "@image-shield/core";
import { unshuffle } from "@tuki0918/seeded-shuffle";
import {
  blocksToPngBlob,
  decryptPngImageBlob,
  imageBlobToBlocks,
} from "./block";

export class BrowserImageRestorer {
  private secretKey?: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey;
  }

  async restoreImages(
    fragmentBlobs: Blob[],
    manifest: ManifestData,
  ): Promise<Blob[]> {
    const { allBlocks } = await this._prepareRestoreData(
      fragmentBlobs,
      manifest,
    );

    const restoredBlocks = unshuffle(allBlocks, manifest.config.seed);

    const reconstructedImages = await this._reconstructAllImages(
      restoredBlocks,
      manifest,
    );

    // If encryption was used, decrypt the reconstructed images
    const secretKey = this.secretKey;
    if (manifest.secure && secretKey) {
      return await Promise.all(
        reconstructedImages.map((img) =>
          decryptPngImageBlob(img, secretKey, manifest.id),
        ),
      );
    }

    return reconstructedImages;
  }

  private async _reconstructAllImages(
    restoredBlocks: Uint8Array[],
    manifest: ManifestData,
  ): Promise<Blob[]> {
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
    fragmentBlobs: Blob[],
    manifest: ManifestData,
  ): Promise<{ allBlocks: Uint8Array[]; fragmentBlocksCount: number[] }> {
    this._validateInputs(fragmentBlobs, manifest);

    const totalBlocks = this._calculateTotalBlocks(manifest.images);
    const fragmentBlocksCount = calcBlocksPerFragment(
      totalBlocks,
      fragmentBlobs.length,
    );

    const allBlocks = await this._extractBlocksFromFragments(
      fragmentBlobs,
      manifest,
      fragmentBlocksCount,
    );

    return { allBlocks, fragmentBlocksCount };
  }

  private _validateInputs(fragmentBlobs: Blob[], manifest: ManifestData): void {
    const manifestImageCount = manifest.images.length;
    const fragmentImageCount = fragmentBlobs.length;

    if (manifestImageCount !== fragmentImageCount) {
      throw new Error(
        `Fragment image count mismatch: expected ${manifestImageCount} but got ${fragmentImageCount}`,
      );
    }
  }

  private _calculateTotalBlocks(images: ShortImageInfo[]): number {
    return images.reduce((total, image) => total + image.x * image.y, 0);
  }

  // Extract an array of blocks (Uint8Array) from a fragment image blob
  private async _extractBlocksFromFragment(
    fragmentBlob: Blob,
    manifest: ManifestData,
    expectedBlockCount: number,
  ): Promise<Uint8Array[]> {
    const { blocks } = await imageBlobToBlocks(
      fragmentBlob,
      manifest.config.blockSize,
    );
    return blocks.slice(0, expectedBlockCount);
  }

  private async _extractBlocksFromFragments(
    fragmentBlobs: Blob[],
    manifest: ManifestData,
    fragmentBlocksCount: number[],
  ): Promise<Uint8Array[]> {
    const blocksArrays = await Promise.all(
      fragmentBlobs.map((fragmentBlob, i) =>
        this._extractBlocksFromFragment(
          fragmentBlob,
          manifest,
          fragmentBlocksCount[i],
        ),
      ),
    );
    return blocksArrays.flat();
  }

  private async _reconstructImage(
    blocks: Uint8Array[],
    blockSize: number,
    imageInfo: ShortImageInfo,
  ): Promise<Blob> {
    const { w, h } = imageInfo;
    return await blocksToPngBlob(blocks, w, h, blockSize);
  }
}
