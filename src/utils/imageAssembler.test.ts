import sharp from "sharp";
import { splitImageToBlocks } from "./block";
import { assembleImageFromBlocks } from "./imageAssembler";

describe("assembleImageFromBlocks", () => {
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

  it("should reconstruct the original image from blocks", async () => {
    const blocks = splitImageToBlocks(buffer, width, height, blockSize);
    const pngBuffer = await assembleImageFromBlocks(
      blocks,
      width,
      height,
      blockSize,
      channels,
    );
    // Decode PNG and compare with raw buffer
    const raw = await sharp(pngBuffer).raw().toBuffer();
    expect(raw).toEqual(buffer);
  });

  it("should work with non-square images", async () => {
    const w = 6;
    const h = 4;
    const buf = Buffer.alloc(w * h * channels, 128);
    const blocks = splitImageToBlocks(buf, w, h, blockSize);
    const pngBuffer = await assembleImageFromBlocks(
      blocks,
      w,
      h,
      blockSize,
      channels,
    );
    const raw = await sharp(pngBuffer).raw().toBuffer();
    expect(raw).toEqual(buf);
  });
});
