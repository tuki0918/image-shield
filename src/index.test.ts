import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import ImageShield from "./index";
import type { ManifestData } from "./types";
import {
  generateFragmentFileName,
  generateRestoredFileName,
} from "./utils/helpers";

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
      const manifestDataForFragment = {
        config: { prefix },
        images: new Array(originalImages.length).fill({
          name: `original_${i}.png`,
        }),
      } as unknown as ManifestData;
      fragmentPaths.push(
        path.join(tmpDir, generateFragmentFileName(manifestDataForFragment, i)),
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
          generateRestoredFileName(
            {
              config: { prefix },
              images: new Array(originalImages.length).fill({
                name: `original_${i}.png`,
              }),
            } as unknown as ManifestData,
            i,
          ),
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
        // If encrypted, it should still be a valid PNG but with encrypted content
        const jimpImage = await Jimp.read(fragmentPath);
        expect(jimpImage.mime).toBe("image/png");
        expect(jimpImage.bitmap.width).toBeGreaterThan(0);
        expect(jimpImage.bitmap.height).toBeGreaterThan(0);
        // The encrypted image should have different dimensions or content from originals
        expect(
          jimpImage.bitmap.width * jimpImage.bitmap.height,
        ).toBeGreaterThanOrEqual(4); // At least encrypted data size
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

describe("ImageShield (restoreFileName + encrypt integration)", () => {
  const tmpDir = path.join(tmpdir(), "index_test_tmp_restoreFileName");
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
  const prefix = "indextestimgorig";
  let imagePaths: string[] = [];
  let manifestPath = "";
  let fragmentPaths: string[] = [];
  let restoredPaths: string[] = [];
  let manifest: ManifestData | null = null;

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
    // Fragment images using ImageShield.encrypt (with restoreFileName)
    await ImageShield.encrypt({
      imagePaths,
      config: { blockSize, prefix, restoreFileName: true },
      outputDir: tmpDir,
      secretKey,
    });
    // Find manifest and fragment files
    manifestPath = path.join(tmpDir, "manifest.json");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    fragmentPaths = [];

    if (!manifest) {
      throw new Error("Manifest is not defined");
    }

    for (let i = 0; i < originalImages.length; i++) {
      fragmentPaths.push(
        path.join(tmpDir, generateFragmentFileName(manifest, i)),
      );
    }
    // Restore images using ImageShield.decrypt
    await ImageShield.decrypt({
      imagePaths: fragmentPaths,
      manifestPath,
      outputDir: tmpDir,
      secretKey,
    });
    // Find restored images (should be named as original file name)
    restoredPaths = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const origName = path.parse(imagePaths[i]).name;
      restoredPaths.push(path.join(tmpDir, `${origName}.png`));
    }
  });

  afterAll(() => {
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

  test("manifest images[].name contains original file name when restoreFileName=true (encrypt mode)", () => {
    expect(manifest).toBeDefined();
    expect(manifest?.config.restoreFileName).toBe(true);
    expect(Array.isArray(manifest?.images)).toBe(true);
    for (let i = 0; i < imagePaths.length; i++) {
      const expectedName = path.parse(imagePaths[i]).name;
      expect(manifest?.images[i].name).toBe(expectedName);
    }
  });

  test("restored file names are original file names (with .png)", () => {
    for (let i = 0; i < imagePaths.length; i++) {
      const origName = path.parse(imagePaths[i]).name;
      const restoredPath = path.join(tmpDir, `${origName}.png`);
      expect(fs.existsSync(restoredPath)).toBe(true);
    }
  });
});
