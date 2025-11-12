import {
  type ImageInfo,
  type ManifestData,
  calculateBlockRange,
  calculateBlocksPerFragment,
  calculateImageBlockCounts,
  calculateTotalBlocks,
} from "@image-shield/core";
import { unshuffle } from "@tuki0918/seeded-shuffle";
import { blocksPerImage, blocksToPngImage, imageFileToBlocks } from "./block";
import { readFileBuffer } from "./file";

export class ImageRestorer {
  async restoreImages(
    fragments: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const { blocks, blockCountsPerImage } = await this._prepareData(
      fragments,
      manifest,
    );

    const restored = manifest.config.crossImageShuffle
      ? unshuffle(blocks, manifest.config.seed)
      : blocksPerImage(
          blocks,
          blockCountsPerImage,
          manifest.config.seed,
          unshuffle,
        );

    return await this._reconstructImages(restored, manifest);
  }

  private async _reconstructImages(
    blocks: Buffer[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const blockCountsPerImage = calculateImageBlockCounts(manifest.images);
    return await Promise.all(
      manifest.images.map(async (imageInfo, index) => {
        const { start, end } = calculateBlockRange(blockCountsPerImage, index);
        const imageBlocks = blocks.slice(start, end);
        return await this._createImage(
          imageBlocks,
          manifest.config.blockSize,
          imageInfo,
        );
      }),
    );
  }

  private async _prepareData(
    fragments: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<{
    blocks: Buffer[];
    blockCountsPerImage: number[];
  }> {
    const totalBlocks = calculateTotalBlocks(manifest.images);
    const blockCountsForCrossImages = calculateBlocksPerFragment(
      totalBlocks,
      fragments.length,
    );

    // Calculate actual block counts per image for per-image unshuffle
    const blockCountsPerImage = calculateImageBlockCounts(manifest.images);

    // Use blockCountsPerImage when crossImageShuffle is false
    const blockCounts = manifest.config.crossImageShuffle
      ? blockCountsForCrossImages
      : blockCountsPerImage;

    const blocks = await this._readBlocks(fragments, manifest, blockCounts);

    return { blocks, blockCountsPerImage };
  }

  // Extract an array of blocks (Buffer) from a fragment image
  private async _readBlocksFromFragment(
    fragment: string | Buffer,
    manifest: ManifestData,
    expectedCount: number,
  ): Promise<Buffer[]> {
    const buffer = Buffer.isBuffer(fragment)
      ? fragment
      : await readFileBuffer(fragment);

    const { blocks } = await imageFileToBlocks(
      buffer,
      manifest.config.blockSize,
    );
    return blocks.slice(0, expectedCount);
  }

  private async _readBlocks(
    fragments: (string | Buffer)[],
    manifest: ManifestData,
    blockCounts: number[],
  ): Promise<Buffer[]> {
    const blockGroups = await Promise.all(
      fragments.map((fragment, i) =>
        this._readBlocksFromFragment(fragment, manifest, blockCounts[i]),
      ),
    );
    return blockGroups.flat();
  }

  private async _createImage(
    blocks: Buffer[],
    blockSize: number,
    imageInfo: ImageInfo,
  ): Promise<Buffer> {
    const { w, h } = imageInfo;
    return await blocksToPngImage(blocks, w, h, blockSize);
  }
}
