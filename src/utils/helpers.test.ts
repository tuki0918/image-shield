import type { ManifestData } from "../types";
import {
  generateFileName,
  generateFragmentFileName,
  generateRestoredFileName,
  generateRestoredOriginalFileName,
  verifySecretKey,
} from "./helpers";

describe("verifySecretKey", () => {
  test("should return secret key when valid", () => {
    expect(verifySecretKey("validKey")).toBe("validKey");
    expect(verifySecretKey("  validKey  ")).toBe("  validKey  ");
  });

  test("should return undefined when invalid", () => {
    expect(verifySecretKey("")).toBeUndefined();
    expect(verifySecretKey("   ")).toBeUndefined();
    expect(verifySecretKey(null)).toBeUndefined();
    expect(verifySecretKey(undefined)).toBeUndefined();
  });
});

describe("generateFileName", () => {
  const mockManifest = {
    config: { prefix: "img" },
    images: [{ name: "test1" }, { name: "test2" }, { name: "test3" }],
  } as ManifestData;

  test("should generate basic file names", () => {
    expect(generateFileName(mockManifest, 0)).toBe("img_1.png");
    expect(generateFileName(mockManifest, 1)).toBe("img_2.png");
    expect(generateFileName(mockManifest, 2)).toBe("img_3.png");
  });

  test("should generate fragmented file names", () => {
    expect(generateFileName(mockManifest, 0, { isFragmented: true })).toBe(
      "img_1_fragmented.png",
    );
    expect(generateFileName(mockManifest, 2, { isFragmented: true })).toBe(
      "img_3_fragmented.png",
    );
  });

  test("should pad index correctly for different lengths", () => {
    const manifest10 = {
      config: { prefix: "test" },
      images: Array(10).fill({ name: "test" }),
    } as ManifestData;
    expect(generateFileName(manifest10, 0)).toBe("test_01.png");
    expect(generateFileName(manifest10, 9)).toBe("test_10.png");

    const manifest100 = {
      config: { prefix: "test" },
      images: Array(100).fill({ name: "test" }),
    } as ManifestData;
    expect(generateFileName(manifest100, 0)).toBe("test_001.png");
    expect(generateFileName(manifest100, 99)).toBe("test_100.png");
  });
});

describe("generateFragmentFileName", () => {
  const mockManifest = {
    config: { prefix: "img" },
    images: [{ name: "test1" }, { name: "test2" }, { name: "test3" }],
  } as ManifestData;

  test("should generate fragment file names", () => {
    expect(generateFragmentFileName(mockManifest, 0)).toBe(
      "img_1_fragmented.png",
    );
    expect(generateFragmentFileName(mockManifest, 1)).toBe(
      "img_2_fragmented.png",
    );
    expect(generateFragmentFileName(mockManifest, 2)).toBe(
      "img_3_fragmented.png",
    );
  });

  test("should handle different prefixes", () => {
    const customManifest = {
      config: { prefix: "custom" },
      images: [{ name: "test1" }],
    } as ManifestData;
    expect(generateFragmentFileName(customManifest, 0)).toBe(
      "custom_1_fragmented.png",
    );
  });
});

describe("generateRestoredFileName", () => {
  const mockManifest = {
    config: { prefix: "img" },
    images: [{ name: "test1" }, { name: "test2" }, { name: "test3" }],
  } as ManifestData;

  test("should generate restored file names", () => {
    expect(generateRestoredFileName(mockManifest, 0)).toBe("img_1.png");
    expect(generateRestoredFileName(mockManifest, 1)).toBe("img_2.png");
    expect(generateRestoredFileName(mockManifest, 2)).toBe("img_3.png");
  });

  test("should handle different manifest sizes", () => {
    const largeManifest = {
      config: { prefix: "large" },
      images: Array(50).fill({ name: "test" }),
    } as ManifestData;
    expect(generateRestoredFileName(largeManifest, 0)).toBe("large_01.png");
    expect(generateRestoredFileName(largeManifest, 49)).toBe("large_50.png");
  });
});

describe("generateRestoredOriginalFileName", () => {
  test("should generate original file name when name exists", () => {
    const imageInfo = { name: "original" } as ManifestData["images"][number];
    expect(generateRestoredOriginalFileName(imageInfo)).toBe("original.png");
  });

  test("should return undefined when name is null or undefined", () => {
    expect(
      generateRestoredOriginalFileName({
        name: null,
      } as unknown as ManifestData["images"][number]),
    ).toBeUndefined();
    expect(
      generateRestoredOriginalFileName({
        name: undefined,
      } as ManifestData["images"][number]),
    ).toBeUndefined();
    expect(
      generateRestoredOriginalFileName({} as ManifestData["images"][number]),
    ).toBeUndefined();
  });

  test("should handle empty string name", () => {
    expect(
      generateRestoredOriginalFileName({
        name: "",
      } as ManifestData["images"][number]),
    ).toBeUndefined();
  });
});
