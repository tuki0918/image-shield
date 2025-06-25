import { DEFAULT_FRAGMENTATION_CONFIG, VERSION } from "./constraints";
import type {
  FragmentationConfig,
  FragmentationResult,
  ImageInfo,
  ManifestData,
} from "./types";
import {
  blocksToPngImage,
  calcBlocksPerFragment,
  encryptPngImageBuffer,
  imageFileToBlocks,
} from "./utils/block";
import { CryptoUtils } from "./utils/crypto";
import { fileNameWithoutExtension, readFileBuffer } from "./utils/file";
import { SeededRandom, shuffleArrayWithKey } from "./utils/random";

export class ImageFragmenter {
  private config: Required<FragmentationConfig>;
  private secretKey?: string;

  constructor(config: FragmentationConfig, secretKey?: string) {
    this.config = this._initializeConfig(config);
    this.secretKey = secretKey;
  }

  private _initializeConfig(
    config: FragmentationConfig,
  ): Required<FragmentationConfig> {
    return {
      blockSize: config.blockSize ?? DEFAULT_FRAGMENTATION_CONFIG.BLOCK_SIZE,
      prefix: config.prefix ?? DEFAULT_FRAGMENTATION_CONFIG.PREFIX,
      seed: config.seed || SeededRandom.generateSeed(),
      restoreFileName:
        config.restoreFileName ??
        DEFAULT_FRAGMENTATION_CONFIG.RESTORE_FILE_NAME,
    };
  }

  async fragmentImages(imagePaths: string[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this._prepareFragmentData(imagePaths);

    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    const fragmentedImages = await this._createFragmentedImages(
      shuffledBlocks,
      fragmentBlocksCount,
      manifest,
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  /**
   * Fragment images from File objects (browser-compatible)
   */
  async fragmentFiles(files: File[]): Promise<FragmentationResult> {
    const { manifest, allBlocks, fragmentBlocksCount } =
      await this._prepareFragmentDataFromFiles(files);

    const shuffledBlocks = shuffleArrayWithKey(allBlocks, manifest.config.seed);

    const fragmentedImages = await this._createFragmentedImages(
      shuffledBlocks,
      fragmentBlocksCount,
      manifest,
    );

    return {
      manifest,
      fragmentedImages,
    };
  }

  private async _createFragmentedImages(
    shuffledBlocks: Buffer[],
    fragmentBlocksCount: number[],
    manifest: ManifestData,
  ): Promise<Buffer[]> {
    return await Promise.all(
      manifest.images.map(async (_, index) => {
        const { start, end } = this._calculateBlockRange(
          fragmentBlocksCount,
          index,
        );
        const imageBlocks = shuffledBlocks.slice(start, end);
        const fragmentImage = await this._createFragmentImage(
          imageBlocks,
          fragmentBlocksCount[index],
          manifest.config.blockSize,
        );

        return fragmentImage;
      }),
    );
  }

  private _calculateBlockRange(
    fragmentBlocksCount: number[],
    targetIndex: number,
  ): { start: number; end: number } {
    const start = fragmentBlocksCount
      .slice(0, targetIndex)
      .reduce((sum, count) => sum + count, 0);
    const end = start + fragmentBlocksCount[targetIndex];

    return { start, end };
  }

  private _createManifest(
    manifestId: string,
    imageInfos: ImageInfo[],
  ): ManifestData {
    this._validateFileNames(imageInfos);

    const secure = !!this.secretKey;
    const algorithm = secure ? "aes-256-cbc" : undefined;

    return {
      id: manifestId,
      version: VERSION,
      timestamp: new Date().toISOString(),
      config: this.config,
      images: this._mapImageInfosToShortFormat(imageInfos),
      algorithm,
      secure,
    };
  }

  private _validateFileNames(imageInfos: ImageInfo[]): void {
    if (!this.config.restoreFileName || imageInfos.length <= 1) {
      return;
    }

    const nameSet = new Set<string>();

    for (const info of imageInfos) {
      if (info.name !== undefined) {
        if (nameSet.has(info.name)) {
          throw new Error(`Duplicate file name detected: ${info.name}`);
        }
        nameSet.add(info.name);
      }
    }
  }

  private _mapImageInfosToShortFormat(imageInfos: ImageInfo[]) {
    return imageInfos.map((info) => ({
      w: info.width,
      h: info.height,
      c: 4, // Always use 4 channels (RGBA) for generated PNG
      x: info.blockCountX,
      y: info.blockCountY,
      name: info.name,
    }));
  }

  private async _prepareFragmentData(imagePaths: string[]): Promise<{
    manifest: ManifestData;
    allBlocks: Buffer[];
    fragmentBlocksCount: number[];
  }> {
    // Generate manifest ID first
    const manifestId = CryptoUtils.generateUUID();

    const { imageInfos, allBlocks } = await this._processSourceImages(
      imagePaths,
      { id: manifestId },
    );

    const manifest = this._createManifest(manifestId, imageInfos);

    const fragmentBlocksCount = calcBlocksPerFragment(
      allBlocks.length,
      imagePaths.length,
    );

    return { manifest, allBlocks, fragmentBlocksCount };
  }

  private async _prepareFragmentDataFromFiles(files: File[]): Promise<{
    manifest: ManifestData;
    allBlocks: Buffer[];
    fragmentBlocksCount: number[];
  }> {
    // Generate manifest ID first
    const manifestId = CryptoUtils.generateUUID();

    const { imageInfos, allBlocks } = await this._processSourceFiles(
      files,
      { id: manifestId },
    );

    const manifest = this._createManifest(manifestId, imageInfos);

    const fragmentBlocksCount = calcBlocksPerFragment(
      allBlocks.length,
      files.length,
    );

    return { manifest, allBlocks, fragmentBlocksCount };
  }

  private async _processSourceImages(
    imagePaths: string[],
    manifestInfo: Pick<ManifestData, "id">,
  ): Promise<{
    imageInfos: ImageInfo[];
    allBlocks: Buffer[];
  }> {
    const processedImages = await Promise.all(
      imagePaths.map((imagePath) =>
        this._processSourceImage(imagePath, manifestInfo),
      ),
    );

    const imageInfos = processedImages.map((p) => p.imageInfo);
    const allBlocks = processedImages.flatMap((p) => p.blocks);

    return { imageInfos, allBlocks };
  }

  private async _processSourceFiles(
    files: File[],
    manifestInfo: Pick<ManifestData, "id">,
  ): Promise<{
    imageInfos: ImageInfo[];
    allBlocks: Buffer[];
  }> {
    const processedImages = await Promise.all(
      files.map((file) =>
        this._processSourceFile(file, manifestInfo),
      ),
    );

    const imageInfos = processedImages.map((p) => p.imageInfo);
    const allBlocks = processedImages.flatMap((p) => p.blocks);

    return { imageInfos, allBlocks };
  }

  private async _processSourceImage(
    imagePath: string,
    manifestInfo: Pick<ManifestData, "id">,
  ): Promise<{
    imageInfo: ImageInfo;
    blocks: Buffer[];
  }> {
    const processedImageBuffer = await this._processSourceImageBuffer(
      imagePath,
      manifestInfo,
    );

    const { blocks: uint8Blocks, width, height, channels, blockCountX, blockCountY } =
      await imageFileToBlocks(processedImageBuffer, this.config.blockSize);

    // Convert Uint8Array blocks to Buffer for compatibility
    const blocks = uint8Blocks.map(block => Buffer.from(block));

    const imageInfo: ImageInfo = {
      width,
      height,
      channels,
      blockCountX,
      blockCountY,
      name: this.config.restoreFileName
        ? fileNameWithoutExtension(imagePath)
        : undefined,
    };

    return { imageInfo, blocks };
  }

  private async _processSourceFile(
    file: File,
    manifestInfo: Pick<ManifestData, "id">,
  ): Promise<{
    imageInfo: ImageInfo;
    blocks: Buffer[];
  }> {
    const processedImageBuffer = await this._processSourceFileBuffer(
      file,
      manifestInfo,
    );

    const { blocks: uint8Blocks, width, height, channels, blockCountX, blockCountY } =
      await imageFileToBlocks(processedImageBuffer, this.config.blockSize);

    // Convert Uint8Array blocks to Buffer for compatibility
    const blocks = uint8Blocks.map(block => Buffer.from(block));

    const imageInfo: ImageInfo = {
      width,
      height,
      channels,
      blockCountX,
      blockCountY,
      name: this.config.restoreFileName
        ? this._getFileNameWithoutExtension(file.name)
        : undefined,
    };

    return { imageInfo, blocks };
  }

  private async _processSourceImageBuffer(
    imagePath: string,
    manifestInfo: Pick<ManifestData, "id">,
  ): Promise<Buffer> {
    const originalBuffer = await readFileBuffer(imagePath);

    if (this.secretKey && manifestInfo.id) {
      return await encryptPngImageBuffer(
        originalBuffer,
        this.secretKey,
        manifestInfo.id,
      );
    }

    return originalBuffer;
  }

  private async _processSourceFileBuffer(
    file: File,
    manifestInfo: Pick<ManifestData, "id">,
  ): Promise<Buffer> {
    // Read File object as Buffer
    const arrayBuffer = await this._readFileAsArrayBuffer(file);
    const originalBuffer = Buffer.from(arrayBuffer);

    if (this.secretKey && manifestInfo.id) {
      return await encryptPngImageBuffer(
        originalBuffer,
        this.secretKey,
        manifestInfo.id,
      );
    }

    return originalBuffer;
  }

  private async _readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  private _getFileNameWithoutExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  private async _createFragmentImage(
    blocks: Buffer[],
    blockCount: number,
    blockSize: number,
  ): Promise<Buffer> {
    const { imageWidth, imageHeight } = this._calculateFragmentImageSize(
      blockCount,
      blockSize,
    );

    return await blocksToPngImage(blocks, imageWidth, imageHeight, blockSize);
  }

  private _calculateFragmentImageSize(
    blockCount: number,
    blockSize: number,
  ): { imageWidth: number; imageHeight: number } {
    const blocksPerRow = Math.ceil(Math.sqrt(blockCount));
    const imageWidth = blocksPerRow * blockSize;
    const imageHeight = Math.ceil(blockCount / blocksPerRow) * blockSize;

    return { imageWidth, imageHeight };
  }
}
