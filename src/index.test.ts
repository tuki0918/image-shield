import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import ImageShield from "./index";
import { generateFragmentFileName } from "./utils/helpers";

describe("ImageShield (integration)", () => {
  // Use OS temp directory for test files
  const tmpDir = path.join(tmpdir(), "index_test_tmp");
  const originalImages = [
    Buffer.from([
      // 2x2 RGBA image 1
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
    ]),
    Buffer.from([
      // 2x2 RGBA image 2
      0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 64, 64, 64, 255,
    ]),
  ];
  const width = 2;
  const height = 2;
  const blockSize = 1;
  const secretKey = "index-test-key";
  const prefix = "indextestimg";
  let imagePaths: string[] = [];
  let manifestPath = "";
  let fragmentPaths: string[] = [];
  let restoredPaths: string[] = [];

  beforeAll(async () => {
    // Create tmp directory and save original images as PNG
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    imagePaths = [];
    for (let i = 0; i < originalImages.length; i++) {
      const filePath = path.join(tmpDir, `original_${i}.png`);
      const image = Jimp.fromBitmap({
        data: originalImages[i],
        width,
        height,
      });
      await image.write(filePath, JimpMime.png);
      imagePaths.push(filePath);
    }
    // Fragment images using ImageShield.encrypt
    await ImageShield.encrypt({
      imagePaths,
      config: { blockSize, prefix },
      outputDir: tmpDir,
      secretKey,
    });
    // Find manifest and fragment files
    manifestPath = path.join(tmpDir, "manifest.json");
    fragmentPaths = [];
    for (let i = 0; i < originalImages.length; i++) {
      const ext = secretKey ? "png.enc" : "png";
      fragmentPaths.push(
        path.join(
          tmpDir,
          generateFragmentFileName(prefix, i, originalImages.length, ext),
        ),
      );
    }
    // Restore images using ImageShield.decrypt
    await ImageShield.decrypt({
      imagePaths: fragmentPaths,
      manifestPath,
      outputDir: tmpDir,
      secretKey,
    });
    // Find restored images (use the same logic as index.ts, based on fragmentPaths)
    restoredPaths = [];
    for (let i = 0; i < fragmentPaths.length; i++) {
      restoredPaths.push(
        path.join(
          tmpDir,
          generateFragmentFileName(prefix, i, fragmentPaths.length, "png"),
        ),
      );
    }
  });

  afterAll(() => {
    // Clean up tmp files
    for (const f of [
      ...imagePaths,
      ...fragmentPaths,
      ...restoredPaths,
      manifestPath,
    ]) {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  test("restored images match original images", async () => {
    // Check that manifest.json exists
    expect(fs.existsSync(manifestPath)).toBe(true);

    // Check that fragment images exist and are valid PNGs
    for (const fragmentPath of fragmentPaths) {
      expect(fs.existsSync(fragmentPath)).toBe(true);
      if (secretKey) {
        // If encrypted, it is correct that it cannot be opened as PNG
        await expect(async () => {
          await Jimp.read(fragmentPath);
        }).rejects.toThrow();
      } else {
        // If not encrypted, it should be openable as PNG
        const jimpImage = await Jimp.read(fragmentPath);
        expect(jimpImage.mime).toBe("image/png");
        expect(jimpImage.bitmap.width).toBeGreaterThan(0);
        expect(jimpImage.bitmap.height).toBeGreaterThan(0);
      }
    }

    // Check that restored images exist before comparing content
    for (const restoredPath of restoredPaths) {
      expect(fs.existsSync(restoredPath)).toBe(true);
    }

    // Check that restored images match original images
    for (let i = 0; i < originalImages.length; i++) {
      const orig = await Jimp.read(imagePaths[i]);
      const restored = await Jimp.read(restoredPaths[i]);
      expect(restored.bitmap.data).toEqual(orig.bitmap.data);
    }
  });
});
