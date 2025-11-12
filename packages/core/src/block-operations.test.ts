import {
  blocksToImageBuffer,
  extractBlock,
  placeBlock,
  splitImageToBlocks,
} from "./block-operations";
import { RGBA_CHANNELS } from "./block-utils";

describe("extractBlock", () => {
  const imageWidth = 4;
  const imageHeight = 4;
  // RGBA 4x4 pixels = 4*4*4 = 64 bytes
  const buffer = new Uint8Array([
    // 1st row
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    // 2nd row
    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    // 3rd row
    33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    // 4th row
    49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
  ]);

  test("extract center 2x2 block", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 1, 1, 2);
    // 2x2 pixels = 2*2*4 = 16 bytes
    expect(Array.from(block)).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 37, 38, 39, 40, 41, 42, 43, 44,
    ]);
  });

  test("extract edge block (bottom right 2x2)", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 2, 2, 2);
    expect(Array.from(block)).toEqual([
      41, 42, 43, 44, 45, 46, 47, 48, 57, 58, 59, 60, 61, 62, 63, 64,
    ]);
  });

  test("blockSize exceeds image size at edge", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 3, 3, 4);
    // Only 1x1 pixel
    expect(Array.from(block)).toEqual([61, 62, 63, 64]);
  });

  test("extract top-left block", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 0, 0, 2);
    expect(Array.from(block)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
  });

  test("extract with undefined height", () => {
    const block = extractBlock(buffer, imageWidth, undefined, 0, 0, 2);
    // Should use blockSize as height when height is undefined
    expect(block.length).toBe(2 * 2 * RGBA_CHANNELS);
  });
});

describe("placeBlock", () => {
  const targetWidth = 4;
  const targetHeight = 4;
  const blank = new Uint8Array(targetWidth * targetHeight * RGBA_CHANNELS);
  const block = new Uint8Array([
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115,
    116,
  ]); // 2x2

  test("place 2x2 block at (1,1)", () => {
    const buf = new Uint8Array(blank);
    placeBlock(buf, block, targetWidth, 1, 1, 2);
    // The area from (1,1) with size 2x2 is filled with block
    const expected = new Uint8Array(blank);
    // From 2nd row, 2nd column
    expected.set(block.subarray(0, 8), (1 * targetWidth + 1) * RGBA_CHANNELS);
    expected.set(block.subarray(8, 16), (2 * targetWidth + 1) * RGBA_CHANNELS);
    expect(Array.from(buf)).toEqual(Array.from(expected));
  });

  test("place 1x1 block at the edge", () => {
    const buf = new Uint8Array(blank);
    const oneBlock = new Uint8Array([201, 202, 203, 204]);
    placeBlock(buf, oneBlock, targetWidth, 3, 3, 1);
    const expected = new Uint8Array(blank);
    expected.set(oneBlock, (3 * targetWidth + 3) * RGBA_CHANNELS);
    expect(Array.from(buf)).toEqual(Array.from(expected));
  });

  test("place block with custom dimensions", () => {
    const buf = new Uint8Array(blank);
    const customBlock = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); // 3x1 pixels
    placeBlock(buf, customBlock, targetWidth, 0, 0, 2, 3, 1);
    const expected = new Uint8Array(blank);
    expected.set(customBlock, 0);
    expect(Array.from(buf)).toEqual(Array.from(expected));
  });

  test("place block at origin", () => {
    const buf = new Uint8Array(blank);
    const originBlock = new Uint8Array([255, 255, 255, 255]);
    placeBlock(buf, originBlock, targetWidth, 0, 0, 1);
    expect(buf[0]).toBe(255);
    expect(buf[1]).toBe(255);
    expect(buf[2]).toBe(255);
    expect(buf[3]).toBe(255);
  });
});

describe("splitImageToBlocks & blocksToImageBuffer", () => {
  const imageWidth = 4;
  const imageHeight = 4;
  const blockSize = 2;
  // RGBA 4x4 pixels = 4*4*4 = 64 bytes
  const buffer = new Uint8Array([
    // 1st row
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    // 2nd row
    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    // 3rd row
    33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    // 4th row
    49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
  ]);

  test("split and reconstruct 4x4 image with 2x2 blocks", () => {
    const blocks = splitImageToBlocks(
      buffer,
      imageWidth,
      imageHeight,
      blockSize,
    );
    // 2x2 blocks = 4 blocks
    expect(blocks.length).toBe(4);
    // Blocks are processed row by row, left to right
    // Block 0: (0,0) to (1,1) - top-left
    expect(Array.from(blocks[0])).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
    // Block 1: (2,0) to (3,1) - top-right
    expect(Array.from(blocks[1])).toEqual([
      9, 10, 11, 12, 13, 14, 15, 16, 25, 26, 27, 28, 29, 30, 31, 32,
    ]);
    // Block 2: (0,2) to (1,3) - bottom-left
    expect(Array.from(blocks[2])).toEqual([
      33, 34, 35, 36, 37, 38, 39, 40, 49, 50, 51, 52, 53, 54, 55, 56,
    ]);
    // Block 3: (2,2) to (3,3) - bottom-right
    expect(Array.from(blocks[3])).toEqual([
      41, 42, 43, 44, 45, 46, 47, 48, 57, 58, 59, 60, 61, 62, 63, 64,
    ]);
    // Reconstruct
    const reconstructed = blocksToImageBuffer(
      blocks,
      imageWidth,
      imageHeight,
      blockSize,
    );
    expect(Array.from(reconstructed)).toEqual(Array.from(buffer));
  });

  test("split image with non-square dimensions", () => {
    const width = 6;
    const height = 4;
    const size = 2;
    const testBuffer = new Uint8Array(width * height * RGBA_CHANNELS);
    // Fill with pattern
    for (let i = 0; i < testBuffer.length; i++) {
      testBuffer[i] = i % 256;
    }

    const blocks = splitImageToBlocks(testBuffer, width, height, size);
    // 3 blocks X * 2 blocks Y = 6 blocks
    expect(blocks.length).toBe(6);

    const reconstructed = blocksToImageBuffer(blocks, width, height, size);
    expect(Array.from(reconstructed)).toEqual(Array.from(testBuffer));
  });

  test("split image with edge blocks", () => {
    const width = 5;
    const height = 5;
    const size = 2;
    const testBuffer = new Uint8Array(width * height * RGBA_CHANNELS);
    for (let i = 0; i < testBuffer.length; i++) {
      testBuffer[i] = i % 256;
    }

    const blocks = splitImageToBlocks(testBuffer, width, height, size);
    // 3 blocks X * 3 blocks Y = 9 blocks (some edge blocks are smaller)
    expect(blocks.length).toBe(9);

    const reconstructed = blocksToImageBuffer(blocks, width, height, size);
    expect(Array.from(reconstructed)).toEqual(Array.from(testBuffer));
  });

  test("reconstruct with fewer blocks than expected", () => {
    const width = 4;
    const height = 4;
    const size = 2;
    // Only 2 blocks instead of 4
    const blocks = [
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24]),
      new Uint8Array([
        9, 10, 11, 12, 13, 14, 15, 16, 25, 26, 27, 28, 29, 30, 31, 32,
      ]),
    ];

    const reconstructed = blocksToImageBuffer(blocks, width, height, size);
    // Should only fill the first 2 blocks, rest should be zeros
    expect(reconstructed.length).toBe(width * height * RGBA_CHANNELS);
    // Check first block area (top-left: rows 0-1, cols 0-1)
    // Row 0: indices 0-7 (cols 0-1)
    // Row 1: indices 16-23 (cols 0-1)
    expect(Array.from(reconstructed.slice(0, 8))).toEqual(
      Array.from(blocks[0].slice(0, 8)),
    );
    expect(Array.from(reconstructed.slice(16, 24))).toEqual(
      Array.from(blocks[0].slice(8, 16)),
    );
    // Check second block area (top-right: rows 0-1, cols 2-3)
    // Row 0: indices 8-15 (cols 2-3)
    // Row 1: indices 24-31 (cols 2-3)
    expect(Array.from(reconstructed.slice(8, 16))).toEqual(
      Array.from(blocks[1].slice(0, 8)),
    );
    expect(Array.from(reconstructed.slice(24, 32))).toEqual(
      Array.from(blocks[1].slice(8, 16)),
    );
    // Remaining areas should be zeros
    expect(Array.from(reconstructed.slice(32))).toEqual(new Array(32).fill(0));
  });
});
