import { Jimp, JimpMime } from "jimp";

const RGBA_CHANNELS = 4;

interface BlockCounts {
  blockCountX: number;
  blockCountY: number;
}

interface ImageFileToBlocksResult {
  blocks: Buffer[];
  width: number;
  height: number;
  channels: number;
  blockCountX: number;
  blockCountY: number;
}

interface BlockPosition {
  x: number;
  y: number;
}

interface BlockDimensions {
  width: number;
  height: number;
}

/**
 * Calculate block counts for width and height
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @returns Object with blockCountX and blockCountY
 */
function calculateBlockCounts(
  width: number,
  height: number,
  blockSize: number,
): BlockCounts {
  return {
    blockCountX: Math.ceil(width / blockSize),
    blockCountY: Math.ceil(height / blockSize),
  };
}

/**
 * Calculate actual block dimensions at edge positions
 * @param position Block position (x or y)
 * @param blockSize Standard block size
 * @param imageSize Image dimension (width or height)
 * @param blockCount Total block count in that dimension
 * @returns Actual block dimension
 */
function calculateActualBlockSize(
  position: number,
  blockSize: number,
  imageSize: number,
  blockCount: number,
): number {
  const isEdgeBlock = position === blockCount - 1;
  return isEdgeBlock ? imageSize - position * blockSize : blockSize;
}

/**
 * Calculate block dimensions considering edge cases
 * @param position Block position
 * @param blockSize Standard block size
 * @param imageWidth Image width
 * @param imageHeight Image height
 * @param blockCounts Block counts
 * @returns Block dimensions
 */
function calculateBlockDimensions(
  position: BlockPosition,
  blockSize: number,
  imageWidth: number,
  imageHeight: number,
  blockCounts: BlockCounts,
): BlockDimensions {
  return {
    width: calculateActualBlockSize(
      position.x,
      blockSize,
      imageWidth,
      blockCounts.blockCountX,
    ),
    height: calculateActualBlockSize(
      position.y,
      blockSize,
      imageHeight,
      blockCounts.blockCountY,
    ),
  };
}

/**
 * Extract a block from an image buffer
 * @param buffer Source image buffer (RGBA format)
 * @param imageWidth Image width in pixels
 * @param imageHeight Image height in pixels
 * @param startX Block top-left X coordinate
 * @param startY Block top-left Y coordinate
 * @param blockSize Maximum block size
 * @returns Block buffer containing pixel data
 */
export function extractBlock(
  buffer: Buffer,
  imageWidth: number,
  imageHeight: number | undefined,
  startX: number,
  startY: number,
  blockSize: number,
): Buffer {
  // Calculate actual block dimensions considering image boundaries
  const blockWidth = Math.min(blockSize, imageWidth - startX);
  const blockHeight =
    imageHeight !== undefined
      ? Math.min(blockSize, imageHeight - startY)
      : blockSize;

  const blockData: number[] = [];

  // Extract pixel data row by row
  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const pixelX = startX + x;
      const pixelY = startY + y;
      const pixelIndex = (pixelY * imageWidth + pixelX) * RGBA_CHANNELS;

      // Copy RGBA channels
      for (let channel = 0; channel < RGBA_CHANNELS; channel++) {
        blockData.push(buffer[pixelIndex + channel] || 0);
      }
    }
  }

  return Buffer.from(blockData);
}

/**
 * Place block data at the specified position in the target image buffer
 * @param targetBuffer Target image buffer to place the block into
 * @param blockData Block data to place
 * @param targetWidth Target image width in pixels
 * @param destX Destination X coordinate
 * @param destY Destination Y coordinate
 * @param blockSize Standard block size
 * @param blockWidth Actual block width (optional, defaults to blockSize)
 * @param blockHeight Actual block height (optional, defaults to blockSize)
 */
export function placeBlock(
  targetBuffer: Buffer,
  blockData: Buffer,
  targetWidth: number,
  destX: number,
  destY: number,
  blockSize: number,
  blockWidth?: number,
  blockHeight?: number,
): void {
  const actualWidth = blockWidth ?? blockSize;
  const actualHeight = blockHeight ?? blockSize;

  // Place pixels row by row
  for (let y = 0; y < actualHeight; y++) {
    for (let x = 0; x < actualWidth; x++) {
      const sourceIndex = (y * actualWidth + x) * RGBA_CHANNELS;
      const targetIndex =
        ((destY + y) * targetWidth + (destX + x)) * RGBA_CHANNELS;

      // Ensure we don't write beyond buffer bounds
      if (targetIndex + RGBA_CHANNELS <= targetBuffer.length) {
        // Copy RGBA channels
        for (let channel = 0; channel < RGBA_CHANNELS; channel++) {
          targetBuffer[targetIndex + channel] =
            blockData[sourceIndex + channel];
        }
      }
    }
  }
}

/**
 * Convert a raw RGBA image buffer to PNG format using Jimp
 * @param buffer Raw RGBA image buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns PNG buffer
 */
export async function bufferToPng(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  try {
    const image = Jimp.fromBitmap({
      data: buffer,
      width,
      height,
    });

    return await image.getBuffer(JimpMime.png);
  } catch (error) {
    throw new Error(
      `Failed to convert buffer to PNG: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Split an RGBA image buffer into an array of blocks
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
  const blocks: Buffer[] = [];
  const blockCounts = calculateBlockCounts(width, height, blockSize);

  // Process blocks row by row, left to right
  for (let blockY = 0; blockY < blockCounts.blockCountY; blockY++) {
    for (let blockX = 0; blockX < blockCounts.blockCountX; blockX++) {
      const startX = blockX * blockSize;
      const startY = blockY * blockSize;

      const block = extractBlock(
        buffer,
        width,
        height,
        startX,
        startY,
        blockSize,
      );

      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Reconstruct an RGBA image buffer from an array of blocks
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
  const imageBuffer = Buffer.alloc(width * height * RGBA_CHANNELS);
  const blockCounts = calculateBlockCounts(width, height, blockSize);

  let blockIndex = 0;

  // Place blocks row by row, left to right
  for (let blockY = 0; blockY < blockCounts.blockCountY; blockY++) {
    for (let blockX = 0; blockX < blockCounts.blockCountX; blockX++) {
      if (blockIndex >= blocks.length) {
        break;
      }

      const position: BlockPosition = { x: blockX, y: blockY };
      const dimensions = calculateBlockDimensions(
        position,
        blockSize,
        width,
        height,
        blockCounts,
      );

      const destX = blockX * blockSize;
      const destY = blockY * blockSize;

      placeBlock(
        imageBuffer,
        blocks[blockIndex],
        width,
        destX,
        destY,
        blockSize,
        dimensions.width,
        dimensions.height,
      );

      blockIndex++;
    }
  }

  return imageBuffer;
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error processing image file: ${errorMessage}`);
    throw new Error("The manifest file may not match the image data.");
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
    return await bufferToPng(imageBuffer, width, height);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to reconstruct PNG image from blocks: ${errorMessage}`,
    );
  }
}

/**
 * Calculate how many blocks should be assigned to each fragment
 * Distributes blocks as evenly as possible across fragments
 * @param totalBlocks Total number of blocks to distribute
 * @param fragmentCount Number of fragments to distribute blocks across
 * @returns Array where each element represents the number of blocks for that fragment
 */
export function calcBlocksPerFragment(
  totalBlocks: number,
  fragmentCount: number,
): number[] {
  if (fragmentCount <= 0) {
    throw new Error("Fragment count must be greater than 0");
  }

  if (totalBlocks <= 0) {
    return new Array(fragmentCount).fill(0);
  }

  const baseBlocksPerFragment = Math.ceil(totalBlocks / fragmentCount);
  const fragmentBlockCounts: number[] = [];
  let remainingBlocks = totalBlocks;

  // Distribute blocks, ensuring no fragment gets more blocks than available
  for (let i = 0; i < fragmentCount; i++) {
    const blocksForThisFragment = Math.min(
      baseBlocksPerFragment,
      remainingBlocks,
    );
    fragmentBlockCounts.push(blocksForThisFragment);
    remainingBlocks -= blocksForThisFragment;
  }

  return fragmentBlockCounts;
}
