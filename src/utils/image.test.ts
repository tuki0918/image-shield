import type sharp from "sharp";
import { getImageBlockInfo } from "./image";

describe("getImageBlockInfo", () => {
  test("calculates block info from metadata", () => {
    const metadata: Partial<sharp.Metadata> = {
      width: 100,
      height: 80,
      channels: 4,
    };
    const blockSize = 32;
    const info = getImageBlockInfo(metadata as sharp.Metadata, blockSize);
    expect(info).toEqual({
      width: 100,
      height: 80,
      channels: 4,
      blockCountX: 4,
      blockCountY: 3,
    });
  });

  test("channels defaults to 3 if not present", () => {
    const metadata: Partial<sharp.Metadata> = {
      width: 64,
      height: 64,
    };
    const blockSize = 16;
    const info = getImageBlockInfo(metadata as sharp.Metadata, blockSize);
    expect(info.channels).toBe(3);
  });

  test("throws if width or height is missing", () => {
    expect(() =>
      getImageBlockInfo({ height: 10 } as sharp.Metadata, 8),
    ).toThrow();
    expect(() =>
      getImageBlockInfo({ width: 10 } as sharp.Metadata, 8),
    ).toThrow();
  });
});
