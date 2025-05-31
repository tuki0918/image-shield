import { extractBlock, placeBlock } from "../../src/utils/block";
import { blocksToImageBuffer, splitImageToBlocks } from "../../src/utils/block";

describe("extractBlock", () => {
  const imageWidth = 4;
  const imageHeight = 4;
  // RGBA 4x4 pixels = 4*4*4 = 64 bytes
  const buffer = Buffer.from([
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
    expect(block).toEqual(
      Buffer.from([
        21, 22, 23, 24, 25, 26, 27, 28, 37, 38, 39, 40, 41, 42, 43, 44,
      ]),
    );
  });

  test("extract edge block (bottom right 2x2)", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 2, 2, 2);
    expect(block).toEqual(
      Buffer.from([
        41, 42, 43, 44, 45, 46, 47, 48, 57, 58, 59, 60, 61, 62, 63, 64,
      ]),
    );
  });

  test("blockSize exceeds image size at edge", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 3, 3, 4);
    // Only 1x1 pixel
    expect(block).toEqual(Buffer.from([61, 62, 63, 64]));
  });
});

describe("placeBlock", () => {
  const targetWidth = 4;
  const targetHeight = 4;
  const blank = Buffer.alloc(targetWidth * targetHeight * 4, 0);
  const block = Buffer.from([
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115,
    116,
  ]); // 2x2

  test("place 2x2 block at (1,1)", () => {
    const buf = Buffer.from(blank);
    placeBlock(buf, block, targetWidth, 1, 1, 2);
    // The area from (1,1) with size 2x2 is filled with block
    const expected = Buffer.from(blank);
    // From 2nd row, 2nd column
    expected.set(block.subarray(0, 8), (1 * targetWidth + 1) * 4);
    expected.set(block.subarray(8, 16), (2 * targetWidth + 1) * 4);
    expect(buf).toEqual(expected);
  });

  test("place 1x1 block at the edge", () => {
    const buf = Buffer.from(blank);
    const oneBlock = Buffer.from([201, 202, 203, 204]);
    placeBlock(buf, oneBlock, targetWidth, 3, 3, 1);
    const expected = Buffer.from(blank);
    expected.set(oneBlock, (3 * targetWidth + 3) * 4);
    expect(buf).toEqual(expected);
  });
});

describe("splitImageToBlocks & blocksToImageBuffer", () => {
  const imageWidth = 4;
  const imageHeight = 4;
  const blockSize = 2;
  // RGBA 4x4 pixels = 4*4*4 = 64 bytes
  const buffer = Buffer.from([
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
    // Check the contents of each block (top-left, top-right, bottom-left, bottom-right)
    expect(blocks[0]).toEqual(
      Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24]),
    );
    expect(blocks[1]).toEqual(
      Buffer.from([
        9, 10, 11, 12, 13, 14, 15, 16, 25, 26, 27, 28, 29, 30, 31, 32,
      ]),
    );
    expect(blocks[2]).toEqual(
      Buffer.from([
        33, 34, 35, 36, 37, 38, 39, 40, 49, 50, 51, 52, 53, 54, 55, 56,
      ]),
    );
    expect(blocks[3]).toEqual(
      Buffer.from([
        41, 42, 43, 44, 45, 46, 47, 48, 57, 58, 59, 60, 61, 62, 63, 64,
      ]),
    );
    // Reconstruct
    const reconstructed = blocksToImageBuffer(
      blocks,
      imageWidth,
      imageHeight,
      blockSize,
    );
    expect(reconstructed).toEqual(buffer);
  });
});
