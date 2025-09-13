// Browser-compatible image processing utilities

interface BrowserImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Load image from File or Blob and return ImageData
 * @param file File or Blob containing image data
 * @returns Promise resolving to ImageData
 */
export async function loadImageData(
  file: File | Blob,
): Promise<BrowserImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Cannot get 2D context");
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        URL.revokeObjectURL(url);
        resolve({
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Create a PNG Blob from ImageData
 * @param imageData ImageData object
 * @returns Promise resolving to PNG Blob
 */
export async function imageDataToPng(
  imageData: BrowserImageData,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Cannot get 2D context"));
      return;
    }

    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const domImageData = new ImageData(
      imageData.data,
      imageData.width,
      imageData.height,
    );
    ctx.putImageData(domImageData, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create PNG blob"));
      }
    }, "image/png");
  });
}

/**
 * Create ImageData from raw RGBA buffer
 * @param buffer Raw RGBA buffer
 * @param width Image width
 * @param height Image height
 * @returns ImageData object
 */
export function bufferToImageData(
  buffer: Buffer,
  width: number,
  height: number,
): BrowserImageData {
  const data = new Uint8ClampedArray(buffer);
  return { data, width, height };
}

/**
 * Convert ImageData to Buffer
 * @param imageData ImageData object
 * @returns Buffer containing RGBA data
 */
export function imageDataToBuffer(imageData: BrowserImageData): Buffer {
  return Buffer.from(imageData.data);
}

/**
 * Extract raw RGBA buffer from PNG blob
 * @param pngBlob PNG blob
 * @returns Promise resolving to object with buffer and dimensions
 */
export async function extractImageBuffer(pngBlob: Blob): Promise<{
  imageBuffer: Buffer;
  width: number;
  height: number;
}> {
  const imageData = await loadImageData(pngBlob);
  return {
    imageBuffer: Buffer.from(imageData.data),
    width: imageData.width,
    height: imageData.height,
  };
}

/**
 * Create PNG blob from raw RGBA buffer
 * @param imageBuffer Raw RGBA buffer
 * @param width Image width
 * @param height Image height
 * @returns Promise resolving to PNG Blob
 */
export async function createPngFromBuffer(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<Blob> {
  const imageData = bufferToImageData(imageBuffer, width, height);
  return await imageDataToPng(imageData);
}
