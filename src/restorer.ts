import type { ManifestData, ShortImageInfo } from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  imageFileToBlocks,
  readFileBuffer,
} from "./utils/block";
import { CryptoUtils, uuidToIV } from "./utils/crypto";
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

    const restoredImages: Buffer[] = [];
    let blockPtr = 0;
    for (let i = 0; i < manifest.images.length; i++) {
      const imageInfo = manifest.images[i];
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
          uuidToIV(manifest.id),
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
    imageInfo: ShortImageInfo,
    blockSize: number,
  ): Promise<Buffer> {
    const { w, h, c } = imageInfo;
    return await blocksToPngImage(blocks, w, h, blockSize, c);
  }
}
