import {
  RGBA_CHANNELS,
  calculateBlockCounts,
  calculateBlockCountsForCrossImages,
  calculateBlockRange,
} from "./block-utils";

describe("RGBA_CHANNELS", () => {
  test("should be 4", () => {
    expect(RGBA_CHANNELS).toBe(4);
  });
});

describe("calculateBlockCounts", () => {
  test("should calculate block counts for square images", () => {
    const result = calculateBlockCounts(10, 10, 5);
    expect(result.blockCountX).toBe(2);
    expect(result.blockCountY).toBe(2);
  });

  test("should calculate block counts for non-square images", () => {
    const result = calculateBlockCounts(10, 20, 5);
    expect(result.blockCountX).toBe(2);
    expect(result.blockCountY).toBe(4);
  });

  test("should round up for non-divisible dimensions", () => {
    const result = calculateBlockCounts(10, 10, 3);
    expect(result.blockCountX).toBe(4); // Math.ceil(10/3) = 4
    expect(result.blockCountY).toBe(4);
  });

  test("should handle edge case with blockSize larger than image", () => {
    const result = calculateBlockCounts(5, 5, 10);
    expect(result.blockCountX).toBe(1);
    expect(result.blockCountY).toBe(1);
  });

  test("should handle single pixel images", () => {
    const result = calculateBlockCounts(1, 1, 1);
    expect(result.blockCountX).toBe(1);
    expect(result.blockCountY).toBe(1);
  });
});

describe("calculateBlockRange", () => {
  test("should calculate range for first image", () => {
    const blockCounts = [4, 4, 4];
    const result = calculateBlockRange(blockCounts, 0);
    expect(result.start).toBe(0);
    expect(result.end).toBe(4);
  });

  test("should calculate range for middle image", () => {
    const blockCounts = [4, 4, 4];
    const result = calculateBlockRange(blockCounts, 1);
    expect(result.start).toBe(4);
    expect(result.end).toBe(8);
  });

  test("should calculate range for last image", () => {
    const blockCounts = [4, 4, 4];
    const result = calculateBlockRange(blockCounts, 2);
    expect(result.start).toBe(8);
    expect(result.end).toBe(12);
  });

  test("should handle different block counts", () => {
    const blockCounts = [2, 5, 3, 1];
    const result0 = calculateBlockRange(blockCounts, 0);
    expect(result0.start).toBe(0);
    expect(result0.end).toBe(2);

    const result1 = calculateBlockRange(blockCounts, 1);
    expect(result1.start).toBe(2);
    expect(result1.end).toBe(7);

    const result2 = calculateBlockRange(blockCounts, 2);
    expect(result2.start).toBe(7);
    expect(result2.end).toBe(10);

    const result3 = calculateBlockRange(blockCounts, 3);
    expect(result3.start).toBe(10);
    expect(result3.end).toBe(11);
  });

  test("should handle single image", () => {
    const blockCounts = [10];
    const result = calculateBlockRange(blockCounts, 0);
    expect(result.start).toBe(0);
    expect(result.end).toBe(10);
  });

  test("should handle zero blocks", () => {
    const blockCounts = [0, 5, 0];
    const result0 = calculateBlockRange(blockCounts, 0);
    expect(result0.start).toBe(0);
    expect(result0.end).toBe(0);

    const result1 = calculateBlockRange(blockCounts, 1);
    expect(result1.start).toBe(0);
    expect(result1.end).toBe(5);

    const result2 = calculateBlockRange(blockCounts, 2);
    expect(result2.start).toBe(5);
    expect(result2.end).toBe(5);
  });
});

describe("calculateBlockCountsForCrossImages", () => {
  test("evenly divisible blocks", () => {
    // 12 blocks, 3 fragments => [4, 4, 4]
    expect(calculateBlockCountsForCrossImages(12, 3)).toEqual([4, 4, 4]);
  });

  test("not evenly divisible blocks", () => {
    // 10 blocks, 3 fragments => [4, 4, 2]
    expect(calculateBlockCountsForCrossImages(10, 3)).toEqual([4, 4, 2]);
  });

  test("more fragments than blocks", () => {
    // 3 blocks, 5 fragments => [1, 1, 1, 0, 0]
    expect(calculateBlockCountsForCrossImages(3, 5)).toEqual([1, 1, 1, 0, 0]);
  });

  test("zero blocks", () => {
    // 0 blocks, 3 fragments => [0, 0, 0]
    expect(calculateBlockCountsForCrossImages(0, 3)).toEqual([0, 0, 0]);
  });

  test("one fragment", () => {
    // 7 blocks, 1 fragment => [7]
    expect(calculateBlockCountsForCrossImages(7, 1)).toEqual([7]);
  });

  test("should throw error for zero fragments", () => {
    expect(() => calculateBlockCountsForCrossImages(10, 0)).toThrow(
      "Fragment count must be greater than 0",
    );
  });

  test("should throw error for negative fragments", () => {
    expect(() => calculateBlockCountsForCrossImages(10, -1)).toThrow(
      "Fragment count must be greater than 0",
    );
  });

  test("should handle large numbers", () => {
    const result = calculateBlockCountsForCrossImages(1000, 3);
    expect(result.length).toBe(3);
    expect(result.reduce((sum, count) => sum + count, 0)).toBe(1000);
  });

  test("should distribute blocks evenly when possible", () => {
    const result = calculateBlockCountsForCrossImages(100, 4);
    expect(result).toEqual([25, 25, 25, 25]);
    expect(result.reduce((sum, count) => sum + count, 0)).toBe(100);
  });
});
