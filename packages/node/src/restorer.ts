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
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const { allBlocks, imageBlockCounts } = await this._prepareData(
      fragmentImages,
      manifest,
    );

    const restoredBlocks = manifest.config.crossImageShuffle
      ? unshuffle(allBlocks, manifest.config.seed)
      : blocksPerImage(
          allBlocks,
          imageBlockCounts,
          manifest.config.seed,
          unshuffle,
        );

    const reconstructedImages = await this._reconstructImages(
      restoredBlocks,
      manifest,
    );

    return reconstructedImages;
  }

  private async _reconstructImages(
    restoredBlocks: Buffer[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    const imageBlockCounts = calculateImageBlockCounts(manifest.images);
    return await Promise.all(
      manifest.images.map(async (imageInfo, index) => {
        const { start, end } = calculateBlockRange(imageBlockCounts, index);
        const imageBlocks = restoredBlocks.slice(start, end);
        return await this._createImage(
          imageBlocks,
          manifest.config.blockSize,
          imageInfo,
        );
      }),
    );
  }

  private async _prepareData(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<{
    allBlocks: Buffer[];
    imageBlockCounts: number[];
  }> {
    const totalBlocks = calculateTotalBlocks(manifest.images);
    const fragmentBlocksCount = calculateBlocksPerFragment(
      totalBlocks,
      fragmentImages.length,
    );

    // Calculate actual block counts per image for per-image unshuffle
    const imageBlockCounts = calculateImageBlockCounts(manifest.images);

    // Use imageBlockCounts when crossImageShuffle is false
    const blocksCounts = manifest.config.crossImageShuffle
      ? fragmentBlocksCount
      : imageBlockCounts;

    const allBlocks = await this._readBlocks(
      fragmentImages,
      manifest,
      blocksCounts,
    );

    return { allBlocks, imageBlockCounts };
  }

  // Extract an array of blocks (Buffer) from a fragment image
  private async _readBlocksFromFragment(
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

  private async _readBlocks(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
    fragmentBlocksCount: number[],
  ): Promise<Buffer[]> {
    const blocksArrays = await Promise.all(
      fragmentImages.map((fragmentImage, i) =>
        this._readBlocksFromFragment(
          fragmentImage,
          manifest,
          fragmentBlocksCount[i],
        ),
      ),
    );
    return blocksArrays.flat();
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
