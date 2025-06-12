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
  // TODO: browser support
  private decrypt: typeof CryptoUtils.decryptBuffer;
  private uuidToIV: typeof CryptoUtils.uuidToIV;

  constructor(secretKey?: string) {
    this.secretKey = secretKey;
    // TODO: browser support
    this.decrypt = CryptoUtils.decryptBuffer;
    this.uuidToIV = CryptoUtils.uuidToIV;
  }

  async restoreImages(
    fragmentImages: (string | Uint8Array)[],
    manifest: ManifestData,
  ): Promise<Uint8Array[]> {
    const { allBlocks } = await this.prepareRestores(fragmentImages, manifest);

    const restoredBlocks = unshuffleArrayWithKey(
      allBlocks,
      manifest.config.seed,
    );

    const restoredImages: Uint8Array[] = await Promise.all(
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
    fragmentImages: (string | Uint8Array)[],
    manifest: ManifestData,
  ): Promise<{ allBlocks: Uint8Array[]; fragmentBlocksCount: number[] }> {
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

  // Extract an array of blocks (Uint8Array) from a fragment image
  private async extractBlocksFromFragment(
    fragmentImage: string | Uint8Array,
    manifest: ManifestData,
  ): Promise<Uint8Array[]> {
    // Read the buffer of the fragment image
    const buf: Uint8Array = ArrayBuffer.isView(fragmentImage)
      ? fragmentImage
      : await readFileBuffer(fragmentImage);
    let imageBufferRaw: Uint8Array = buf;
    if (manifest.secure && this.secretKey) {
      try {
        // TODO: browser support
        imageBufferRaw = this.decrypt(
          Buffer.from(buf),
          this.secretKey,
          this.uuidToIV(manifest.id),
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
    blocks: Uint8Array[],
    blockSize: number,
    imageInfo: ShortImageInfo,
  ): Promise<Uint8Array> {
    const { w, h } = imageInfo;
    return await blocksToPngImage(blocks, w, h, blockSize);
  }
}
