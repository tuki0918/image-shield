import { VERSION } from "./constraints";
import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
} from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  imageFileToBlocks,
} from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { SeededRandom, shuffleArrayWithKey } from "./utils/random";

export class ImageFragmenter {
  private config: Required<FragmentationConfig>;
  private secretKey?: string;
  // TODO: browser support
  private encrypt: typeof CryptoUtils.encryptBuffer;
  private uuidToIV: typeof CryptoUtils.uuidToIV;

  constructor(config: FragmentationConfig, secretKey?: string) {
    this.config = {
      ...config,
      prefix: config.prefix ?? "fragment",
      seed: config.seed || SeededRandom.generateSeed(),
    };
    this.secretKey = secretKey;
    // TODO: browser support
    this.encrypt = CryptoUtils.encryptBuffer;
    this.uuidToIV = CryptoUtils.uuidToIV;
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this.prepareFragments(imagePaths);

    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    const fragmentedImages: Uint8Array[] = await Promise.all(
      manifest.images.map(async (_, i) => {
        // Calculate slice range using cumulative sum
        const start = fragmentBlocksCount
          .slice(0, i)
          .reduce((a, b) => a + b, 0);
        const end = start + fragmentBlocksCount[i];
        const imageBlocks = shuffledBlocks.slice(start, end);
        const fragmentImage = await this.createFragmentImage(
          imageBlocks,
          fragmentBlocksCount[i],
          manifest.config.blockSize,
        );
        // Encrypt if secretKey is set
        // TODO: browser support
        return this.secretKey
          ? this.encrypt(
              Buffer.from(fragmentImage),
              this.secretKey,
              this.uuidToIV(manifest.id),
            )
          : fragmentImage;
      }),
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  private createManifest(imageInfos: ImageInfo[]): ManifestData {
    const secure = !!this.secretKey;
    const algorithm = secure ? "aes-256-cbc" : undefined;
    return {
      id: CryptoUtils.generateUUID(),
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: imageInfos.map((info) => ({
        w: info.width,
        h: info.height,
        c: 4, // Always use 4 channels (RGBA) for generated PNG
        x: info.blockCountX,
        y: info.blockCountY,
      })),
      algorithm,
      secure,
    };
  }

  private async prepareFragments(imagePaths: string[]): Promise<{
    manifest: ManifestData;
    allBlocks: Uint8Array[];
    fragmentBlocksCount: number[];
  }> {
    const imageInfos: ImageInfo[] = [];
    const allBlocks: Uint8Array[] = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const { blocks, width, height, channels, blockCountX, blockCountY } =
        await imageFileToBlocks(imagePath, this.config.blockSize);
      const imageInfo: ImageInfo = {
        width,
        height,
        channels,
        blockCountX,
        blockCountY,
      };
      imageInfos.push(imageInfo);
      allBlocks.push(...blocks);
    }
    const manifest = this.createManifest(imageInfos);
    const fragmentBlocksCount = calcBlocksPerFragment(
      allBlocks.length,
      imagePaths.length,
    );
    return { manifest, allBlocks, fragmentBlocksCount };
  }

  private async createFragmentImage(
    blocks: Uint8Array[],
    blockCount: number,
    blockSize: number,
  ): Promise<Uint8Array> {
    // Calculate fragmented image size
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;
    return await blocksToPngImage(blocks, imageWidth, imageHeight, blockSize);
  }
}
