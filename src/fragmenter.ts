import crypto from "node:crypto";
import { VERSION } from "./constraints";
import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
} from "./types";
import { calcBlocksPerFragment, imageFileToBlocks } from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { assembleImageFromBlocks } from "./utils/imageAssembler";
import { shuffleArrayWithKey } from "./utils/random";

export class ImageFragmenter {
  private config: Required<FragmentationConfig>;
  private secretKey: string;

  constructor(config: FragmentationConfig, secretKey: string) {
    this.config = {
      ...config,
      prefix: config.prefix ?? "fragment",
      seed: config.seed || CryptoUtils.generateSeed(),
    };
    this.secretKey = secretKey;
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    // 1. Prepare image info and collect all blocks
    const imageBlockInfos: ImageInfo[] = [];
    const allBlocks: Array<{
      data: Buffer;
      sourceIndex: number;
      blockIndex: number;
    }> = [];

    // 2. Load each image and split into blocks
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      // Use utility to load image and split into blocks
      const { blocks, width, height, channels } = await imageFileToBlocks(
        imagePath,
        this.config.blockSize,
      );
      const imageInfo = {
        width,
        height,
        channels,
        blockCountX: Math.ceil(width / this.config.blockSize),
        blockCountY: Math.ceil(height / this.config.blockSize),
      };
      imageBlockInfos.push(imageInfo);
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        allBlocks.push({
          data: blocks[blockIndex],
          sourceIndex: i,
          blockIndex,
        });
      }
    }

    // 3. Shuffle all blocks
    const shuffledBlocks = shuffleArrayWithKey(
      allBlocks,
      this.secretKey,
      this.config.seed,
    );

    // 4. Calculate the number of blocks per fragment image
    const fragmentBlocksCount = calcBlocksPerFragment(
      shuffledBlocks.length,
      imagePaths.length,
    );

    // 5. Distribute shuffled blocks into fragment images
    const fragmentedImages: Buffer[] = [];
    let blockPtr = 0;
    for (let i = 0; i < imagePaths.length; i++) {
      const count = fragmentBlocksCount[i];
      const imageBlocks = shuffledBlocks.slice(blockPtr, blockPtr + count);
      blockPtr += count;
      // Encrypt each block
      const encryptedBlocks = CryptoUtils.encryptBlocks(
        imageBlocks.map((b) => b.data),
        this.secretKey,
      );
      // Create fragment image
      const fragmentImage = await this.createFragmentImage(
        encryptedBlocks,
        imageBlocks.length,
        this.config.blockSize,
      );
      fragmentedImages.push(fragmentImage);
    }

    // 6. Create manifest
    const manifest: ManifestData = {
      id: crypto.randomUUID(),
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: imageBlockInfos.map((info) => ({
        w: info.width,
        h: info.height,
        c: 4, // Always use 4 channels (RGBA) for generated PNG
        x: info.blockCountX,
        y: info.blockCountY,
      })),
    };

    return {
      manifest,
      fragmentedImages,
    };
  }

  private async createFragmentImage(
    encryptedBlocks: string[],
    blockCount: number,
    blockSize: number,
  ): Promise<Buffer> {
    const channels = 4;
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;
    // 暗号化済みBase64文字列をBuffer化（復号しない）
    const blocks: Buffer[] = encryptedBlocks.map((b) =>
      Buffer.from(b, "base64"),
    );
    // Use common assembler
    return await assembleImageFromBlocks(
      blocks,
      imageWidth,
      imageHeight,
      blockSize,
      channels,
    );
  }
}
