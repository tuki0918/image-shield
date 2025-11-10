import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ManifestData } from "@image-shield/core";
import { Jimp, JimpMime } from "jimp";
import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";

describe("ImageRestorer", () => {
  const tmpDir = path.join(tmpdir(), "restorer_test_tmp");
  let testImagePath: string;
  let originalImageData: Buffer;

  beforeAll(async () => {
    // Create tmp directory and test image
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    // Create a simple 4x4 RGBA test image
    originalImageData = Buffer.from([
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
      data: originalImageData,
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
    test("initializes successfully", () => {
      const restorer = new ImageRestorer();
      expect(restorer).toBeInstanceOf(ImageRestorer);
    });
  });

  describe("restoreImages", () => {
    test("restores single image", async () => {
      // First fragment the image
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      // Then restore it
      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);
      expect(Buffer.isBuffer(restoredImages[0])).toBe(true);

      // Should be able to read as PNG
      const jimpImage = await Jimp.read(restoredImages[0]);
      expect(jimpImage.mime).toBe("image/png");
      expect(jimpImage.bitmap.width).toBe(4);
      expect(jimpImage.bitmap.height).toBe(4);
    });

    test("restores multiple images", async () => {
      // First fragment multiple images
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      // Then restore them
      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(2);
      for (const restoredImage of restoredImages) {
        expect(Buffer.isBuffer(restoredImage)).toBe(true);

        const jimpImage = await Jimp.read(restoredImage);
        expect(jimpImage.mime).toBe("image/png");
        expect(jimpImage.bitmap.width).toBe(4);
        expect(jimpImage.bitmap.height).toBe(4);
      }
    });

    test("restores image with different block sizes", async () => {
      const blockSize = 1;

      // Fragment with block size 1
      const fragmenter = new ImageFragmenter({
        blockSize,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      // Restore
      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);
      const jimpImage = await Jimp.read(restoredImages[0]);
      expect(jimpImage.bitmap.width).toBe(4);
      expect(jimpImage.bitmap.height).toBe(4);
    });

    test("accepts fragment images as file paths", async () => {
      // First fragment and save to files
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      // Save fragment images to temporary files
      const fragmentPaths: string[] = [];
      for (let i = 0; i < fragmentedImages.length; i++) {
        const fragmentPath = path.join(tmpDir, `fragment_${i}.png`);
        fs.writeFileSync(fragmentPath, fragmentedImages[i]);
        fragmentPaths.push(fragmentPath);
      }

      // Restore using file paths
      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentPaths,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);

      // Clean up fragment files
      for (const fragmentPath of fragmentPaths) {
        if (fs.existsSync(fragmentPath)) fs.unlinkSync(fragmentPath);
      }
    });

    test("accepts mixed fragment images (buffers and paths)", async () => {
      // First fragment
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      // Save one fragment to file, keep one as buffer
      const fragmentPath = path.join(tmpDir, "fragment_mixed.png");
      fs.writeFileSync(fragmentPath, fragmentedImages[0]);

      const mixedFragments = [fragmentPath, fragmentedImages[1]];

      // Restore using mixed inputs
      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        mixedFragments,
        manifest,
      );

      expect(restoredImages).toHaveLength(2);

      // Clean up
      if (fs.existsSync(fragmentPath)) fs.unlinkSync(fragmentPath);
    });

    test("round-trip restoration preserves image data", async () => {
      // Use a deterministic seed for consistent results
      const fragmenter = new ImageFragmenter({
        blockSize: 1, // Use block size 1 for pixel-perfect restoration
        seed: "deterministic-seed",
      });

      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      // Compare the restored image data with original
      const originalJimp = await Jimp.read(testImagePath);
      const restoredJimp = await Jimp.read(restoredImages[0]);

      expect(restoredJimp.bitmap.width).toBe(originalJimp.bitmap.width);
      expect(restoredJimp.bitmap.height).toBe(originalJimp.bitmap.height);

      // The bitmap data should be very similar (allowing for PNG compression differences)
      expect(restoredJimp.bitmap.data.length).toBe(
        originalJimp.bitmap.data.length,
      );

      // Verify pixel RGBA values match
      for (let y = 0; y < originalJimp.bitmap.height; y++) {
        for (let x = 0; x < originalJimp.bitmap.width; x++) {
          const pixelIndex = (y * originalJimp.bitmap.width + x) * 4;
          const originalR = originalJimp.bitmap.data[pixelIndex];
          const originalG = originalJimp.bitmap.data[pixelIndex + 1];
          const originalB = originalJimp.bitmap.data[pixelIndex + 2];
          const originalA = originalJimp.bitmap.data[pixelIndex + 3];

          const restoredR = restoredJimp.bitmap.data[pixelIndex];
          const restoredG = restoredJimp.bitmap.data[pixelIndex + 1];
          const restoredB = restoredJimp.bitmap.data[pixelIndex + 2];
          const restoredA = restoredJimp.bitmap.data[pixelIndex + 3];

          expect(restoredR).toBe(originalR);
          expect(restoredG).toBe(originalG);
          expect(restoredB).toBe(originalB);
          expect(restoredA).toBe(originalA);
        }
      }
    });
  });

  describe("error handling", () => {
    test("throws error when fragment count doesn't match manifest", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      const restorer = new ImageRestorer();

      // Try to restore with wrong number of fragments
      await expect(
        restorer.restoreImages([fragmentedImages[0]], manifest),
      ).rejects.toThrow("Fragment image count mismatch");
    });

    test("handles non-existent fragment file", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest } = await fragmenter.fragmentImages([testImagePath]);

      const restorer = new ImageRestorer();
      const nonExistentPath = path.join(tmpDir, "nonexistent.png");

      await expect(
        restorer.restoreImages([nonExistentPath], manifest),
      ).rejects.toThrow();
    });

    test("handles invalid fragment file", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest } = await fragmenter.fragmentImages([testImagePath]);

      const invalidFragmentPath = path.join(tmpDir, "invalid_fragment.png");
      fs.writeFileSync(invalidFragmentPath, "not an image");

      const restorer = new ImageRestorer();

      try {
        await expect(
          restorer.restoreImages([invalidFragmentPath], manifest),
        ).rejects.toThrow();
      } finally {
        if (fs.existsSync(invalidFragmentPath))
          fs.unlinkSync(invalidFragmentPath);
      }
    });
  });

  describe("integration with different configurations", () => {
    test("works with preserveName enabled", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
        preserveName: true,
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);
      expect(manifest.images[0].name).toBe("dGVzdF9pbWFnZQ==");
    });

    test("works with custom prefix", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
        prefix: "custom-prefix",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);
      expect(manifest.config.prefix).toBe("custom-prefix");
    });
  });

  describe("crossImageShuffle restoration", () => {
    test("restores single image with per-image shuffle (default)", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);
      expect(manifest.config.crossImageShuffle).toBe(false);

      const jimpImage = await Jimp.read(restoredImages[0]);
      expect(jimpImage.bitmap.width).toBe(4);
      expect(jimpImage.bitmap.height).toBe(4);
    });

    test("restores multiple images with per-image shuffle (default)", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(2);
      expect(manifest.config.crossImageShuffle).toBe(false);

      for (const restoredImage of restoredImages) {
        const jimpImage = await Jimp.read(restoredImage);
        expect(jimpImage.bitmap.width).toBe(4);
        expect(jimpImage.bitmap.height).toBe(4);
      }
    });

    test("round-trip with per-image shuffle preserves image data", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 1,
        seed: "deterministic-seed",
        crossImageShuffle: false,
      });

      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      const originalJimp = await Jimp.read(testImagePath);
      const restoredJimp = await Jimp.read(restoredImages[0]);

      expect(restoredJimp.bitmap.width).toBe(originalJimp.bitmap.width);
      expect(restoredJimp.bitmap.height).toBe(originalJimp.bitmap.height);
      expect(restoredJimp.bitmap.data.length).toBe(
        originalJimp.bitmap.data.length,
      );

      // Verify pixel RGBA values match
      for (let y = 0; y < originalJimp.bitmap.height; y++) {
        for (let x = 0; x < originalJimp.bitmap.width; x++) {
          const pixelIndex = (y * originalJimp.bitmap.width + x) * 4;
          const originalR = originalJimp.bitmap.data[pixelIndex];
          const originalG = originalJimp.bitmap.data[pixelIndex + 1];
          const originalB = originalJimp.bitmap.data[pixelIndex + 2];
          const originalA = originalJimp.bitmap.data[pixelIndex + 3];

          const restoredR = restoredJimp.bitmap.data[pixelIndex];
          const restoredG = restoredJimp.bitmap.data[pixelIndex + 1];
          const restoredB = restoredJimp.bitmap.data[pixelIndex + 2];
          const restoredA = restoredJimp.bitmap.data[pixelIndex + 3];

          expect(restoredR).toBe(originalR);
          expect(restoredG).toBe(originalG);
          expect(restoredB).toBe(originalB);
          expect(restoredA).toBe(originalA);
        }
      }
    });

    test("round-trip with multiple images and per-image shuffle", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 1,
        seed: "deterministic-seed",
        crossImageShuffle: false,
      });

      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(2);

      const originalJimp = await Jimp.read(testImagePath);
      for (const restoredImage of restoredImages) {
        const restoredJimp = await Jimp.read(restoredImage);
        expect(restoredJimp.bitmap.width).toBe(originalJimp.bitmap.width);
        expect(restoredJimp.bitmap.height).toBe(originalJimp.bitmap.height);
        expect(restoredJimp.bitmap.data.length).toBe(
          originalJimp.bitmap.data.length,
        );

        // Verify pixel RGBA values match
        for (let y = 0; y < originalJimp.bitmap.height; y++) {
          for (let x = 0; x < originalJimp.bitmap.width; x++) {
            const pixelIndex = (y * originalJimp.bitmap.width + x) * 4;
            const originalR = originalJimp.bitmap.data[pixelIndex];
            const originalG = originalJimp.bitmap.data[pixelIndex + 1];
            const originalB = originalJimp.bitmap.data[pixelIndex + 2];
            const originalA = originalJimp.bitmap.data[pixelIndex + 3];

            const restoredR = restoredJimp.bitmap.data[pixelIndex];
            const restoredG = restoredJimp.bitmap.data[pixelIndex + 1];
            const restoredB = restoredJimp.bitmap.data[pixelIndex + 2];
            const restoredA = restoredJimp.bitmap.data[pixelIndex + 3];

            expect(restoredR).toBe(originalR);
            expect(restoredG).toBe(originalG);
            expect(restoredB).toBe(originalB);
            expect(restoredA).toBe(originalA);
          }
        }
      }
    });

    test("round-trip with different-sized images and per-image shuffle", async () => {
      // Create test images of different sizes
      const smallImagePath = path.join(tmpDir, "small_restore_test.png");
      const largeImagePath = path.join(tmpDir, "large_restore_test.png");

      // Create 2x2 image
      const smallImageData = Buffer.from([
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
      ]);
      const smallImage = Jimp.fromBitmap({
        data: smallImageData,
        width: 2,
        height: 2,
      });
      await smallImage.write(smallImagePath, JimpMime.png);

      // Create 6x6 image
      const largeImageData = Buffer.alloc(6 * 6 * 4);
      for (let i = 0; i < 6 * 6 * 4; i += 4) {
        largeImageData[i] = 128; // R
        largeImageData[i + 1] = 128; // G
        largeImageData[i + 2] = 128; // B
        largeImageData[i + 3] = 255; // A
      }
      const largeImage = Jimp.fromBitmap({
        data: largeImageData,
        width: 6,
        height: 6,
      });
      await largeImage.write(largeImagePath, JimpMime.png);

      try {
        const fragmenter = new ImageFragmenter({
          blockSize: 2,
          seed: "deterministic-seed",
          crossImageShuffle: false,
        });

        const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
          smallImagePath,
          largeImagePath,
        ]);

        const restorer = new ImageRestorer();
        const restoredImages = await restorer.restoreImages(
          fragmentedImages,
          manifest,
        );

        expect(restoredImages).toHaveLength(2);

        // Verify restored dimensions match originals
        const smallJimp = await Jimp.read(restoredImages[0]);
        const largeJimp = await Jimp.read(restoredImages[1]);

        expect(smallJimp.bitmap.width).toBe(2);
        expect(smallJimp.bitmap.height).toBe(2);
        expect(largeJimp.bitmap.width).toBe(6);
        expect(largeJimp.bitmap.height).toBe(6);
      } finally {
        // Clean up
        if (fs.existsSync(smallImagePath)) fs.unlinkSync(smallImagePath);
        if (fs.existsSync(largeImagePath)) fs.unlinkSync(largeImagePath);
      }
    });

    test("restores single image with cross-image shuffle", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
        crossImageShuffle: true,
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(1);
      expect(manifest.config.crossImageShuffle).toBe(true);

      const jimpImage = await Jimp.read(restoredImages[0]);
      expect(jimpImage.bitmap.width).toBe(4);
      expect(jimpImage.bitmap.height).toBe(4);
    });

    test("restores multiple images with cross-image shuffle", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 2,
        seed: "test-seed",
        crossImageShuffle: true,
      });
      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(2);
      expect(manifest.config.crossImageShuffle).toBe(true);

      for (const restoredImage of restoredImages) {
        const jimpImage = await Jimp.read(restoredImage);
        expect(jimpImage.bitmap.width).toBe(4);
        expect(jimpImage.bitmap.height).toBe(4);
      }
    });

    test("round-trip with cross-image shuffle preserves image data", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 1,
        seed: "deterministic-seed",
        crossImageShuffle: true,
      });

      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      const originalJimp = await Jimp.read(testImagePath);
      const restoredJimp = await Jimp.read(restoredImages[0]);

      expect(restoredJimp.bitmap.width).toBe(originalJimp.bitmap.width);
      expect(restoredJimp.bitmap.height).toBe(originalJimp.bitmap.height);
      expect(restoredJimp.bitmap.data.length).toBe(
        originalJimp.bitmap.data.length,
      );

      // Verify pixel RGBA values match
      for (let y = 0; y < originalJimp.bitmap.height; y++) {
        for (let x = 0; x < originalJimp.bitmap.width; x++) {
          const pixelIndex = (y * originalJimp.bitmap.width + x) * 4;
          const originalR = originalJimp.bitmap.data[pixelIndex];
          const originalG = originalJimp.bitmap.data[pixelIndex + 1];
          const originalB = originalJimp.bitmap.data[pixelIndex + 2];
          const originalA = originalJimp.bitmap.data[pixelIndex + 3];

          const restoredR = restoredJimp.bitmap.data[pixelIndex];
          const restoredG = restoredJimp.bitmap.data[pixelIndex + 1];
          const restoredB = restoredJimp.bitmap.data[pixelIndex + 2];
          const restoredA = restoredJimp.bitmap.data[pixelIndex + 3];

          expect(restoredR).toBe(originalR);
          expect(restoredG).toBe(originalG);
          expect(restoredB).toBe(originalB);
          expect(restoredA).toBe(originalA);
        }
      }
    });

    test("round-trip with multiple images and cross-image shuffle", async () => {
      const fragmenter = new ImageFragmenter({
        blockSize: 1,
        seed: "deterministic-seed",
        crossImageShuffle: true,
      });

      const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
        testImagePath,
        testImagePath,
      ]);

      const restorer = new ImageRestorer();
      const restoredImages = await restorer.restoreImages(
        fragmentedImages,
        manifest,
      );

      expect(restoredImages).toHaveLength(2);

      const originalJimp = await Jimp.read(testImagePath);
      for (const restoredImage of restoredImages) {
        const restoredJimp = await Jimp.read(restoredImage);
        expect(restoredJimp.bitmap.width).toBe(originalJimp.bitmap.width);
        expect(restoredJimp.bitmap.height).toBe(originalJimp.bitmap.height);
        expect(restoredJimp.bitmap.data.length).toBe(
          originalJimp.bitmap.data.length,
        );

        // Verify pixel RGBA values match
        for (let y = 0; y < originalJimp.bitmap.height; y++) {
          for (let x = 0; x < originalJimp.bitmap.width; x++) {
            const pixelIndex = (y * originalJimp.bitmap.width + x) * 4;
            const originalR = originalJimp.bitmap.data[pixelIndex];
            const originalG = originalJimp.bitmap.data[pixelIndex + 1];
            const originalB = originalJimp.bitmap.data[pixelIndex + 2];
            const originalA = originalJimp.bitmap.data[pixelIndex + 3];

            const restoredR = restoredJimp.bitmap.data[pixelIndex];
            const restoredG = restoredJimp.bitmap.data[pixelIndex + 1];
            const restoredB = restoredJimp.bitmap.data[pixelIndex + 2];
            const restoredA = restoredJimp.bitmap.data[pixelIndex + 3];

            expect(restoredR).toBe(originalR);
            expect(restoredG).toBe(originalG);
            expect(restoredB).toBe(originalB);
            expect(restoredA).toBe(originalA);
          }
        }
      }
    });

    test("round-trip with different-sized images and cross-image shuffle", async () => {
      // Create test images of different sizes
      const smallImagePath = path.join(tmpDir, "small_cross_restore_test.png");
      const largeImagePath = path.join(tmpDir, "large_cross_restore_test.png");

      // Create 2x2 image
      const smallImageData = Buffer.from([
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
      ]);
      const smallImage = Jimp.fromBitmap({
        data: smallImageData,
        width: 2,
        height: 2,
      });
      await smallImage.write(smallImagePath, JimpMime.png);

      // Create 6x6 image
      const largeImageData = Buffer.alloc(6 * 6 * 4);
      for (let i = 0; i < 6 * 6 * 4; i += 4) {
        largeImageData[i] = 128; // R
        largeImageData[i + 1] = 128; // G
        largeImageData[i + 2] = 128; // B
        largeImageData[i + 3] = 255; // A
      }
      const largeImage = Jimp.fromBitmap({
        data: largeImageData,
        width: 6,
        height: 6,
      });
      await largeImage.write(largeImagePath, JimpMime.png);

      try {
        const fragmenter = new ImageFragmenter({
          blockSize: 2,
          seed: "deterministic-seed",
          crossImageShuffle: true,
        });

        const { manifest, fragmentedImages } = await fragmenter.fragmentImages([
          smallImagePath,
          largeImagePath,
        ]);

        const restorer = new ImageRestorer();
        const restoredImages = await restorer.restoreImages(
          fragmentedImages,
          manifest,
        );

        expect(restoredImages).toHaveLength(2);
        expect(manifest.config.crossImageShuffle).toBe(true);

        // Verify restored dimensions match originals
        const smallJimp = await Jimp.read(restoredImages[0]);
        const largeJimp = await Jimp.read(restoredImages[1]);

        expect(smallJimp.bitmap.width).toBe(2);
        expect(smallJimp.bitmap.height).toBe(2);
        expect(largeJimp.bitmap.width).toBe(6);
        expect(largeJimp.bitmap.height).toBe(6);
      } finally {
        // Clean up
        if (fs.existsSync(smallImagePath)) fs.unlinkSync(smallImagePath);
        if (fs.existsSync(largeImagePath)) fs.unlinkSync(largeImagePath);
      }
    });
  });
});
