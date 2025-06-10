import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  blocksToImageBuffer,
  blocksToPngImage,
  calcBlocksPerFragment,
  extractBlock,
  imageFileToBlocks,
  placeBlock,
  splitImageToBlocks,
} from "./block";

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

describe("imageFileToBlocks & blocksToPngImage (integration)", () => {
  const tmpDir = path.join(tmpdir(), "block_test_tmp");
  const tmpPng = path.join(tmpDir, "test.png");
  const width = 4;
  const height = 4;
  const blockSize = 2;
  const channels = 4;
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

  beforeAll(async () => {
    // Create tmp directory and PNG file
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    await sharp(buffer, { raw: { width, height, channels } })
      .png()
      .toFile(tmpPng);
  });

  afterAll(() => {
    // Clean up tmp files
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  test("imageFileToBlocks splits PNG into correct blocks", async () => {
    const {
      blocks,
      width: w,
      height: h,
      channels: c,
      blockCountX: x,
      blockCountY: y,
    } = await imageFileToBlocks(tmpPng, blockSize);
    expect(w).toBe(width);
    expect(h).toBe(height);
    expect(c).toBe(channels);
    expect(x).toBe(2);
    expect(y).toBe(2);
    expect(blocks.length).toBe(4); // 2x2 blocks
    // Check block contents (top-left block)
    expect(blocks[0]).toEqual(
      Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24]),
    );
  });

  test("blocksToPngImage reconstructs PNG from blocks", async () => {
    const { blocks } = await imageFileToBlocks(tmpPng, blockSize);
    const pngBuffer = await blocksToPngImage(
      blocks,
      width,
      height,
      blockSize,
      channels,
    );
    // Decode PNG and check raw buffer
    const { data } = await sharp(pngBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data).toEqual(buffer);
  });
});

describe("calcBlocksPerFragment", () => {
  test("evenly divisible blocks", () => {
    // 12 blocks, 3 fragments => [4, 4, 4]
    expect(calcBlocksPerFragment(12, 3)).toEqual([4, 4, 4]);
  });
  test("not evenly divisible blocks", () => {
    // 10 blocks, 3 fragments => [4, 4, 2]
    expect(calcBlocksPerFragment(10, 3)).toEqual([4, 4, 2]);
  });
  test("more fragments than blocks", () => {
    // 3 blocks, 5 fragments => [1, 1, 1, 0, 0]
    expect(calcBlocksPerFragment(3, 5)).toEqual([1, 1, 1, 0, 0]);
  });
  test("zero blocks", () => {
    // 0 blocks, 3 fragments => [0, 0, 0]
    expect(calcBlocksPerFragment(0, 3)).toEqual([0, 0, 0]);
  });
  test("one fragment", () => {
    // 7 blocks, 1 fragment => [7]
    expect(calcBlocksPerFragment(7, 1)).toEqual([7]);
  });
});

describe("integration: fragmentImages and restoreImages", () => {
  const tmpDir = path.join(tmpdir(), "block_integration_tmp");
  const width = 4;
  const height = 4;
  const blockSize = 2;
  const channels = 4;
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

  beforeAll(async () => {
    // Create tmp directory and PNG file
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    await sharp(buffer, { raw: { width, height, channels } })
      .png()
      .toFile(path.join(tmpDir, "test.png"));
  });

  afterAll(() => {
    // Clean up tmp files
    if (fs.existsSync(path.join(tmpDir, "test.png")))
      fs.unlinkSync(path.join(tmpDir, "test.png"));
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  test("imageFileToBlocks splits PNG into correct blocks", async () => {
    const {
      blocks,
      width: w,
      height: h,
      channels: c,
      blockCountX: x,
      blockCountY: y,
    } = await imageFileToBlocks(path.join(tmpDir, "test.png"), blockSize);
    expect(w).toBe(width);
    expect(h).toBe(height);
    expect(c).toBe(channels);
    expect(x).toBe(2);
    expect(y).toBe(2);
    expect(blocks.length).toBe(4); // 2x2 blocks
    // Check block contents (top-left block)
    expect(blocks[0]).toEqual(
      Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24]),
    );
  });

  test("blocksToPngImage reconstructs PNG from blocks", async () => {
    const { blocks } = await imageFileToBlocks(
      path.join(tmpDir, "test.png"),
      blockSize,
    );
    const pngBuffer = await blocksToPngImage(
      blocks,
      width,
      height,
      blockSize,
      channels,
    );
    // Decode PNG and check raw buffer
    const { data } = await sharp(pngBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data).toEqual(buffer);
  });
});
