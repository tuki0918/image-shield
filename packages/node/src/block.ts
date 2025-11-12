import {
  RGBA_CHANNELS,
  calculateBlockCounts,
  blocksToImageBuffer as coreBlocksToImageBuffer,
  splitImageToBlocks as coreSplitImageToBlocks,
} from "@image-shield/core";
import { Jimp, JimpMime } from "jimp";

interface ImageFileToBlocksResult {
  blocks: Buffer[];
  width: number;
  height: number;
  channels: number;
  blockCountX: number;
  blockCountY: number;
}

/**
 * Format error message consistently
 * @param operation Description of the operation that failed
 * @param error The error that occurred
 * @returns Formatted error message
 */
function formatErrorMessage(operation: string, error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return `${operation}: ${errorMessage}`;
}

/**
 * Create a Jimp image from raw RGBA image buffer
 * @param imageBuffer Raw RGBA image buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Jimp image instance
 */
function createJimpFromImageBuffer(
  imageBuffer: Buffer,
  width: number,
  height: number,
): InstanceType<typeof Jimp> {
  return new Jimp({
    data: imageBuffer,
    width,
    height,
  });
}

/**
 * Split an RGBA image buffer into an array of blocks (Node.js Buffer wrapper)
 * @param buffer Source image buffer (RGBA format)
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param blockSize Block size in pixels
 * @returns Array of block buffers
 */
export function splitImageToBlocks(
  buffer: Buffer,
  width: number,
  height: number,
  blockSize: number,
): Buffer[] {
  const blocks = coreSplitImageToBlocks(buffer, width, height, blockSize);
  return blocks.map((block) => Buffer.from(block));
}

/**
 * Reconstruct an RGBA image buffer from an array of blocks (Node.js Buffer wrapper)
 * @param blocks Array of block buffers
 * @param width Target image width in pixels
 * @param height Target image height in pixels
 * @param blockSize Block size in pixels
 * @returns Reconstructed image buffer
 */
export function blocksToImageBuffer(
  blocks: Buffer[],
  width: number,
  height: number,
  blockSize: number,
): Buffer {
  const uint8Blocks = blocks.map((block) => new Uint8Array(block));
  const imageBuffer = coreBlocksToImageBuffer(
    uint8Blocks,
    width,
    height,
    blockSize,
  );
  return Buffer.from(imageBuffer);
}

/**
 * Load an image from file or buffer and split into blocks
 * @param input Path to the image file or Buffer containing image data
 * @param blockSize Block size in pixels
 * @returns Promise resolving to block data and image metadata
 */
export async function imageFileToBlocks(
  input: string | Buffer,
  blockSize: number,
): Promise<ImageFileToBlocksResult> {
  try {
    // Load and process image with Jimp (automatically converts to RGBA)
    const image = await Jimp.read(input);
    const { width, height } = image.bitmap;
    const channels = RGBA_CHANNELS;
    const imageBuffer = image.bitmap.data;

    // Split image into blocks
    const blocks = splitImageToBlocks(imageBuffer, width, height, blockSize);
    const blockCounts = calculateBlockCounts(width, height, blockSize);

    return {
      blocks,
      width,
      height,
      channels,
      blockCountX: blockCounts.blockCountX,
      blockCountY: blockCounts.blockCountY,
    };
  } catch (error) {
    throw new Error(
      `${formatErrorMessage("Failed to process image file", error)}. The manifest file may not match the image data.`,
    );
  }
}

/**
 * Reconstruct a PNG image from blocks
 * @param blocks Array of block buffers
 * @param width Target image width in pixels
 * @param height Target image height in pixels
 * @param blockSize Block size in pixels
 * @returns Promise resolving to PNG buffer
 */
export async function blocksToPngImage(
  blocks: Buffer[],
  width: number,
  height: number,
  blockSize: number,
): Promise<Buffer> {
  try {
    const imageBuffer = blocksToImageBuffer(blocks, width, height, blockSize);
    return await createPngFromImageBuffer(imageBuffer, width, height);
  } catch (error) {
    throw new Error(
      formatErrorMessage("Failed to reconstruct PNG image from blocks", error),
    );
  }
}

/**
 * Extract raw RGBA image buffer from a PNG buffer using Jimp
 * @param pngBuffer PNG image buffer
 * @returns Promise resolving to image buffer and image dimensions
 */
export async function extractImageBufferFromPng(
  pngBuffer: Buffer,
): Promise<{ imageBuffer: Buffer; width: number; height: number }> {
  try {
    const image = await Jimp.read(pngBuffer);
    const { width, height } = image.bitmap;
    const imageBuffer = Buffer.from(image.bitmap.data);

    return { imageBuffer, width, height };
  } catch (error) {
    throw new Error(
      formatErrorMessage("Failed to extract image buffer from PNG", error),
    );
  }
}

/**
 * Create a PNG buffer from raw RGBA image buffer using Jimp
 * @param imageBuffer Raw RGBA image buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Promise resolving to PNG buffer
 */
export async function createPngFromImageBuffer(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  try {
    const image = createJimpFromImageBuffer(imageBuffer, width, height);
    return await image.getBuffer(JimpMime.png);
  } catch (error) {
    throw new Error(
      formatErrorMessage("Failed to create PNG from image buffer", error),
    );
  }
}

/**
 * Apply a function to blocks per image
 * @param allBlocks - All blocks to process
 * @param fragmentBlocksCount - Number of blocks per fragment
 * @param seed - Seed for the processing function
 * @param processFunc - Function to apply to blocks (shuffle or unshuffle)
 * @returns Processed blocks
 */
export function blocksPerImage(
  allBlocks: Buffer[],
  fragmentBlocksCount: number[],
  seed: number | string,
  processFunc: (blocks: Buffer[], seed: number | string) => Buffer[],
): Buffer[] {
  const processedBlocks: Buffer[] = [];
  let offset = 0;

  for (const blockCount of fragmentBlocksCount) {
    const imageBlocks = allBlocks.slice(offset, offset + blockCount);
    const processed = processFunc(imageBlocks, seed);
    processedBlocks.push(...processed);
    offset += blockCount;
  }

  return processedBlocks;
}
