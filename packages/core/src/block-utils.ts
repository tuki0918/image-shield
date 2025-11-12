import type { ImageInfo } from "./types";

/**
 * Number of channels in RGBA format
 */
export const RGBA_CHANNELS = 4;

export interface BlockCounts {
  blockCountX: number;
  blockCountY: number;
}

/**
 * Calculate block counts for width and height
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @returns Object with blockCountX and blockCountY
 */
export function calculateBlockCounts(
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
 * Calculate the range of blocks for a specific image index
 * @param blockCounts Array of block counts per image
 * @param targetIndex Target image index
 * @returns Object with start and end indices
 */
export function calculateBlockRange(
  blockCounts: number[],
  targetIndex: number,
): { start: number; end: number } {
  const start = blockCounts
    .slice(0, targetIndex)
    .reduce((sum, count) => sum + count, 0);
  const end = start + blockCounts[targetIndex];

  return { start, end };
}

/**
 * Calculate how many blocks each fragment should contain
 * @param totalBlocks Total number of blocks to distribute
 * @param fragmentCount Number of fragments to create
 * @returns Array of block counts for each fragment
 */
export function calculateBlocksPerFragment(
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

    // If no blocks remain, fill remaining fragments with 0
    if (remainingBlocks <= 0) {
      for (let j = i + 1; j < fragmentCount; j++) {
        fragmentBlockCounts.push(0);
      }
      break;
    }
  }

  return fragmentBlockCounts;
}

/**
 * Calculate block counts for each image
 * @param images Array of ImageInfo objects
 * @returns Array of block counts per image (x * y)
 */
export function calculateImageBlockCounts(images: ImageInfo[]): number[] {
  return images.map((info) => info.x * info.y);
}

/**
 * Calculate total number of blocks from images
 * @param images Array of ImageInfo objects
 * @returns Total block count
 */
export function calculateTotalBlocks(images: ImageInfo[]): number {
  return images.reduce((total, image) => total + image.x * image.y, 0);
}
