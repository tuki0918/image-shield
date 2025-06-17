import { generateFragmentFileName } from "./helpers";

describe("generateFragmentFileName", () => {
  test("3 files - png", () => {
    expect(generateFragmentFileName("img", 0, 3)).toBe("img_1.png");
    expect(generateFragmentFileName("img", 1, 3)).toBe("img_2.png");
    expect(generateFragmentFileName("img", 2, 3)).toBe("img_3.png");
  });
  test("10 files - png.enc", () => {
    expect(
      generateFragmentFileName("frag", 0, 10, {
        isFragmented: false,
        isEncrypted: true,
      }),
    ).toBe("frag_01.png.enc");
    expect(
      generateFragmentFileName("frag", 9, 10, {
        isFragmented: false,
        isEncrypted: true,
      }),
    ).toBe("frag_10.png.enc");
  });
  test("100 files - custom prefix", () => {
    expect(
      generateFragmentFileName("custom", 99, 100, {
        isFragmented: true,
        isEncrypted: false,
      }),
    ).toBe("custom_100_fragmented.png");
    expect(
      generateFragmentFileName("custom", 0, 100, {
        isFragmented: true,
        isEncrypted: false,
      }),
    ).toBe("custom_001_fragmented.png");
  });
});
