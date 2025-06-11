import type { ManifestData, ShortImageInfo } from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  imageFileToBlocks,
} from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
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
    const { allBlocks } = await this.prepareRestores(fragmentImages, manifest);

    const restoredBlocks = unshuffleArrayWithKey(
      allBlocks,
      manifest.config.seed,
    );

    const restoredImages: Buffer[] = await Promise.all(
      manifest.images.map(async (imageInfo, i) => {
        // Calculate slice range using cumulative sum
        const blockCount = imageInfo.x * imageInfo.y;
        const start = manifest.images
          .slice(0, i)
          .reduce((sum, img) => sum + img.x * img.y, 0);
        const end = start + blockCount;
        const imageBlocks = restoredBlocks.slice(start, end);
        return await this.reconstructImage(
          imageBlocks,
          manifest.config.blockSize,
          imageInfo,
        );
      }),
    );
    return restoredImages;
  }

  private async prepareRestores(
    fragmentImages: (string | Buffer)[],
    manifest: ManifestData,
  ): Promise<{ allBlocks: Buffer[]; fragmentBlocksCount: number[] }> {
    const totalBlocks = manifest.images.reduce((a, b) => a + b.x * b.y, 0);
    const fragmentBlocksCount = calcBlocksPerFragment(
      totalBlocks,
      fragmentImages.length,
    );
    const blocksArrays = await Promise.all(
      fragmentImages.map((fragmentImage) =>
        this.extractBlocksFromFragment(fragmentImage, manifest),
      ),
    );
    const allBlocks = blocksArrays.flatMap((blocks, i) =>
      blocks.slice(0, fragmentBlocksCount[i]),
    );
    return { allBlocks, fragmentBlocksCount };
  }

  // Extract an array of blocks (Buffer) from a fragment image
  private async extractBlocksFromFragment(
    fragmentImage: string | Buffer,
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    // Read the buffer of the fragment image
    const buf = Buffer.isBuffer(fragmentImage)
      ? fragmentImage
      : await readFileBuffer(fragmentImage);
    let imageBufferRaw: Buffer = buf;
    if (manifest.secure && this.secretKey) {
      try {
        imageBufferRaw = CryptoUtils.decryptBuffer(
          buf,
          this.secretKey,
          CryptoUtils.uuidToIV(manifest.id),
        );
      } catch (e) {
        throw new Error(
          "The secret key is invalid or does not match the encrypted data.",
        );
      }
    }
    const { blocks } = await imageFileToBlocks(
      imageBufferRaw,
      manifest.config.blockSize,
    );
    return blocks;
  }

  private async reconstructImage(
    blocks: Buffer[],
    blockSize: number,
    imageInfo: ShortImageInfo,
  ): Promise<Buffer> {
    const { w, h } = imageInfo;
    return await blocksToPngImage(blocks, w, h, blockSize);
  }
}
