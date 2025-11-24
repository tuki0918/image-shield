import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CryptoUtils,
  DEFAULT_FRAGMENTATION_CONFIG,
  type FragmentationConfig,
  type ManifestData,
} from "@image-shield/core";
import { Jimp, JimpMime } from "jimp";
import { NodeCryptoProvider } from "./crypto";
import { ImageFragmenter } from "./fragmenter";

// Initialize crypto provider
CryptoUtils.setProvider(new NodeCryptoProvider());

describe("ImageFragmenter", () => {
  const tmpDir = path.join(tmpdir(), "fragmenter_test_tmp");
  let testImagePath: string;

  beforeAll(async () => {
    // Create tmp directory and test image
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    // Create a simple 4x4 RGBA test image
    const testImageData = Buffer.from([
      // Row 1
      255,
      0,
      0,
      255, // Red
      0,
      255,
      0,
      255, // Green
      0,
      0,
      255,
      255, // Blue
      255,
      255,
      0,
      255, // Yellow
      // Row 2
      255,
      0,
      255,
      255, // Magenta
      0,
      255,
      255,
      255, // Cyan
      128,
      128,
      128,
      255, // Gray
      255,
      255,
      255,
      255, // White
      // Row 3
      0,
      0,
      0,
      255, // Black
      64,
      64,
      64,
      255, // Dark gray
      192,
      192,
      192,
      255, // Light gray
      255,
      128,
      0,
      255, // Orange
      // Row 4
      128,
      0,
      128,
      255, // Purple
      0,
      128,
      0,
      255, // Dark green
      0,
      0,
      128,
      255, // Dark blue
      128,
      128,
      0,
      255, // Olive
    ]);

    testImagePath = path.join(tmpDir, "test_image.png");
    const image = Jimp.fromBitmap({
      data: testImageData,
      width: 4,
      height: 4,
    });
    await image.write(testImagePath, JimpMime.png);
  });

  afterAll(() => {
    // Clean up tmp files
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  describe("constructor", () => {
    test("initializes with default config", () => {
      const fragmenter = new ImageFragmenter({});
      expect(fragmenter).toBeInstanceOf(ImageFragmenter);
    });

    test("initializes with custom config", () => {
      const config: FragmentationConfig = {
        blockSize: 8,
        prefix: "test",
        seed: "test-seed",
        restoreFileName: true,
      };
      const fragmenter = new ImageFragmenter(config);
      expect(fragmenter).toBeInstanceOf(ImageFragmenter);
    });

    test("initializes with secret key", () => {
      const fragmenter = new ImageFragmenter({}, "test-secret");
      expect(fragmenter).toBeInstanceOf(ImageFragmenter);
    });
  });

  describe("fragmentImages", () => {
    test("fragments single image without encryption", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        prefix: "test",
        seed: "test-seed",
      });

      const result = await fragmenter.fragmentImages([testImagePath]);

      expect(result.manifest).toBeDefined();
      expect(result.fragmentedImages).toBeDefined();
      expect(result.manifest.images).toHaveLength(1);
      expect(result.fragmentedImages).toHaveLength(1);
      expect(result.manifest.secure).toBe(false);
      expect(result.manifest.algorithm).toBeUndefined();
    });

    test("fragments single image with encryption", async () => {
      const fragmenter = new ImageFragmenter(
        {
          blockSize: 2,
          prefix: "test",
          seed: "test-seed",
        },
        "test-secret-key",
      );

      const result = await fragmenter.fragmentImages([testImagePath]);

      expect(result.manifest).toBeDefined();
      expect(result.fragmentedImages).toBeDefined();
      expect(result.manifest.images).toHaveLength(1);
      expect(result.fragmentedImages).toHaveLength(1);
      expect(result.manifest.secure).toBe(true);
      expect(result.manifest.algorithm).toBe("aes-256-cbc");
    });

    test("fragments multiple images", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        prefix: "test",
        seed: "test-seed",
      });

      const result = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      expect(result.manifest.images).toHaveLength(2);
      expect(result.fragmentedImages).toHaveLength(2);
    });

    test("includes correct manifest metadata", async () => {
      const config: FragmentationConfig = {
        blockSize: 2,
        prefix: "testprefix",
        seed: "test-seed-123",
        restoreFileName: true,
      };
      const fragmenter = new ImageFragmenter(config);

      const result = await fragmenter.fragmentImages([testImagePath]);

      expect(result.manifest.id).toBeDefined();
      expect(result.manifest.version).toBeDefined();
      expect(result.manifest.timestamp).toBeDefined();
      expect(result.manifest.config.blockSize).toBe(2);
      expect(result.manifest.config.prefix).toBe("testprefix");
      expect(result.manifest.config.seed).toBe("test-seed-123");
      expect(result.manifest.config.restoreFileName).toBe(true);
    });

    test("creates valid fragment images", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });

      const result = await fragmenter.fragmentImages([testImagePath]);

      // Fragment images should be valid PNG buffers
      for (const fragmentBuffer of result.fragmentedImages) {
        expect(Buffer.isBuffer(fragmentBuffer)).toBe(true);
        expect(fragmentBuffer.length).toBeGreaterThan(0);

        // Should be able to read as PNG
        const jimpImage = await Jimp.read(fragmentBuffer);
        expect(jimpImage.mime).toBe("image/png");
      }
    });

    test("handles different block sizes", async () => {
      const fragmenter1 = new ImageFragmenter({ blockSize: 1 });
      const fragmenter2 = new ImageFragmenter({ blockSize: 4 });

      const result1 = await fragmenter1.fragmentImages([testImagePath]);
      const result2 = await fragmenter2.fragmentImages([testImagePath]);

      expect(result1.manifest.config.blockSize).toBe(1);
      expect(result2.manifest.config.blockSize).toBe(4);

      // Different block sizes should produce different results
      expect(result1.fragmentedImages[0]).not.toEqual(
        result2.fragmentedImages[0],
      );
    });

    test("throws error on duplicate file names when restoreFileName is enabled", async () => {
      // Create two files with the same base name in different directories
      const tmpDir2 = path.join(tmpdir(), "fragmenter_test_tmp2");
      if (!fs.existsSync(tmpDir2)) fs.mkdirSync(tmpDir2);

      const duplicatePath = path.join(tmpDir2, "test_image.png");
      await fs.promises.copyFile(testImagePath, duplicatePath);

      const fragmenter = new ImageFragmenter({
        restoreFileName: true,
      });

      try {
        await expect(
          fragmenter.fragmentImages([testImagePath, duplicatePath]),
        ).rejects.toThrow("Duplicate file name detected: test_image");
      } finally {
        // Clean up
        if (fs.existsSync(duplicatePath)) fs.unlinkSync(duplicatePath);
        if (fs.existsSync(tmpDir2)) fs.rmdirSync(tmpDir2);
      }
    });

    test("uses default config values when not specified", async () => {
      const fragmenter = new ImageFragmenter({});

      const result = await fragmenter.fragmentImages([testImagePath]);

      expect(result.manifest.config.blockSize).toBe(
        DEFAULT_FRAGMENTATION_CONFIG.BLOCK_SIZE,
      );
      expect(result.manifest.config.prefix).toBe(
        DEFAULT_FRAGMENTATION_CONFIG.PREFIX,
      );
      expect(result.manifest.config.restoreFileName).toBe(
        DEFAULT_FRAGMENTATION_CONFIG.RESTORE_FILE_NAME,
      );
      expect(result.manifest.config.seed).toBeDefined(); // Should be auto-generated
    });
  });

  describe("error handling", () => {
    test("handles non-existent image file", async () => {
      const fragmenter = new ImageFragmenter({});
      const nonExistentPath = path.join(tmpDir, "nonexistent.png");

      await expect(
        fragmenter.fragmentImages([nonExistentPath]),
      ).rejects.toThrow();
    });

    test("handles invalid image file", async () => {
      const invalidImagePath = path.join(tmpDir, "invalid.png");
      fs.writeFileSync(invalidImagePath, "not an image");

      const fragmenter = new ImageFragmenter({});

      try {
        await expect(
          fragmenter.fragmentImages([invalidImagePath]),
        ).rejects.toThrow();
      } finally {
        if (fs.existsSync(invalidImagePath)) fs.unlinkSync(invalidImagePath);
      }
    });
  });
});
