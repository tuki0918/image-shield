import {
  type BlockCounts,
  RGBA_CHANNELS,
  calculateBlockCounts,
} from "./block-utils";

/**
 * Position of a block in the image grid
 */
export interface BlockPosition {
  x: number;
  y: number;
}

/**
 * Dimensions of a block
 */
export interface BlockDimensions {
  width: number;
  height: number;
}

/**
 * Extract a block from an image buffer
 * @param buffer Source image buffer (RGBA format)
 * @param imageWidth Image width in pixels
 * @param imageHeight Image height in pixels (optional, defaults to calculated height)
 * @param startX Block top-left X coordinate
 * @param startY Block top-left Y coordinate
 * @param blockSize Maximum block size
 * @returns Block buffer containing pixel data
 */
export function extractBlock(
  buffer: Uint8Array,
  imageWidth: number,
  imageHeight: number | undefined,
  startX: number,
  startY: number,
  blockSize: number,
): Uint8Array {
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

  return new Uint8Array(blockData);
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
  targetBuffer: Uint8Array,
  blockData: Uint8Array,
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
 * Split an RGBA image buffer into an array of blocks
 * @param buffer Source image buffer (RGBA format)
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param blockSize Block size in pixels
 * @returns Array of block buffers
 */
export function splitImageToBlocks(
  buffer: Uint8Array,
  width: number,
  height: number,
  blockSize: number,
): Uint8Array[] {
  const blocks: Uint8Array[] = [];
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
  blocks: Uint8Array[],
  width: number,
  height: number,
  blockSize: number,
): Uint8Array {
  const imageBuffer = new Uint8Array(width * height * RGBA_CHANNELS);
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
