import { generateFragmentFileName } from "./helpers";

describe("generateFragmentFileName", () => {
  test("3 files - png", () => {
    expect(generateFragmentFileName("img", 0, 3, "png")).toBe("img_1.png");
    expect(generateFragmentFileName("img", 1, 3, "png")).toBe("img_2.png");
    expect(generateFragmentFileName("img", 2, 3, "png")).toBe("img_3.png");
  });
  test("10 files - png.enc", () => {
    expect(generateFragmentFileName("frag", 0, 10, "png.enc")).toBe(
      "frag_01.png.enc",
    );
    expect(generateFragmentFileName("frag", 9, 10, "png.enc")).toBe(
      "frag_10.png.enc",
    );
  });
  test("100 files - custom prefix", () => {
    expect(generateFragmentFileName("custom", 99, 100, "dat")).toBe(
      "custom_100.dat",
    );
    expect(generateFragmentFileName("custom", 0, 100, "dat")).toBe(
      "custom_001.dat",
    );
  });
});
