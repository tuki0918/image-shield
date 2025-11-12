import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  calcBlocksPerFragment,
  extractBlock,
  placeBlock,
} from "@image-shield/core";
import { Jimp, JimpMime } from "jimp";
import {
  blocksToImageBuffer,
  blocksToPngImage,
  imageFileToBlocks,
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
    expect(Buffer.from(block)).toEqual(
      Buffer.from([
        21, 22, 23, 24, 25, 26, 27, 28, 37, 38, 39, 40, 41, 42, 43, 44,
      ]),
    );
  });

  test("extract edge block (bottom right 2x2)", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 2, 2, 2);
    expect(Buffer.from(block)).toEqual(
      Buffer.from([
        41, 42, 43, 44, 45, 46, 47, 48, 57, 58, 59, 60, 61, 62, 63, 64,
      ]),
    );
  });

  test("blockSize exceeds image size at edge", () => {
    const block = extractBlock(buffer, imageWidth, imageHeight, 3, 3, 4);
    // Only 1x1 pixel
    expect(Buffer.from(block)).toEqual(Buffer.from([61, 62, 63, 64]));
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
    // Buffer is a subclass of Uint8Array, so we can pass it directly
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
    // Buffer is a subclass of Uint8Array, so we can pass it directly
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
    const image = new Jimp({ data: buffer, width, height });
    await image.write(tmpPng as `${string}.${string}`);
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
    const pngBuffer = await blocksToPngImage(blocks, width, height, blockSize);
    // Decode PNG and check raw buffer
    const jimpImage = await Jimp.read(pngBuffer);
    expect(jimpImage.bitmap.data).toEqual(buffer);
  });
});

describe("Jimp buffer conversion and restoration", () => {
  const width = 4;
  const height = 4;
  const channels = 4;
  // RGBA 4x4 pixels = 4*4*4 = 64 bytes
  const buffer = Buffer.from([
    // 1st row (Red pixels)
    255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    // 2nd row (Green pixels)
    0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
    // 3rd row (Blue pixels)
    0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    // 4th row (White pixels)
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255,
  ]);

  test("buffer to Jimp and back maintains pixel data", async () => {
    // Create Jimp image from buffer
    const image = new Jimp({ data: buffer, width, height });
    expect(image.bitmap.width).toBe(width);
    expect(image.bitmap.height).toBe(height);

    // Convert back to buffer and verify data
    const restoredBuffer = image.bitmap.data;
    expect(restoredBuffer).toEqual(buffer);

    // Verify specific pixel colors
    // Check first pixel of each row
    // Red pixel (first row)
    expect([...restoredBuffer.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    // Green pixel (second row)
    expect([
      ...restoredBuffer.slice(width * channels * 1, width * channels * 1 + 4),
    ]).toEqual([0, 255, 0, 255]);
    // Blue pixel (third row)
    expect([
      ...restoredBuffer.slice(width * channels * 2, width * channels * 2 + 4),
    ]).toEqual([0, 0, 255, 255]);
    // White pixel (fourth row)
    expect([
      ...restoredBuffer.slice(width * channels * 3, width * channels * 3 + 4),
    ]).toEqual([255, 255, 255, 255]);
  });

  test("buffer to PNG and back maintains pixel data", async () => {
    // Create Jimp image from buffer
    const image = new Jimp({ data: buffer, width, height });

    // Convert to PNG buffer
    const pngBuffer = await image.getBuffer(JimpMime.png);

    // Read PNG buffer back to Jimp
    const restoredImage = await Jimp.read(pngBuffer);
    const restoredBuffer = restoredImage.bitmap.data;

    // Verify dimensions
    expect(restoredImage.bitmap.width).toBe(width);
    expect(restoredImage.bitmap.height).toBe(height);

    // Verify pixel data
    expect(restoredBuffer).toEqual(buffer);
  });

  test("buffer modification through Jimp operations", async () => {
    // Create Jimp image from buffer
    const image = new Jimp({ data: buffer, width, height });

    // Modify image - invert colors
    image.invert();

    // Get modified buffer
    const modifiedBuffer = image.bitmap.data;

    // Verify first pixel of each row is inverted
    // Inverted Red pixel (first row) -> Cyan
    expect([...modifiedBuffer.slice(0, 4)]).toEqual([0, 255, 255, 255]);
    // Inverted Green pixel (second row) -> Magenta
    expect([
      ...modifiedBuffer.slice(width * channels * 1, width * channels * 1 + 4),
    ]).toEqual([255, 0, 255, 255]);
    // Inverted Blue pixel (third row) -> Yellow
    expect([
      ...modifiedBuffer.slice(width * channels * 2, width * channels * 2 + 4),
    ]).toEqual([255, 255, 0, 255]);
    // Inverted White pixel (fourth row) -> Black
    expect([
      ...modifiedBuffer.slice(width * channels * 3, width * channels * 3 + 4),
    ]).toEqual([0, 0, 0, 255]);
  });
});
