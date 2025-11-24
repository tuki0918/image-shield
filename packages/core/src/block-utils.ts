/**
 * Calculate how many blocks each fragment should contain
 * @param totalBlocks Total number of blocks to distribute
 * @param fragmentCount Number of fragments to create
 * @returns Array of block counts for each fragment
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
