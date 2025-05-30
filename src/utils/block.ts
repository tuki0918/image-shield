import sharp from "sharp";

/**
 * Extract a block from a buffer (specify image width/height/start position/block size)
 * Fixed to RGBA channels
 *
 * @param buffer Source image buffer
 * @param imageWidth Image width
 * @param imageHeight Image height (optional)
 * @param startX Block top-left X
 * @param startY Block top-left Y
 * @param blockSize Block size
 * @returns Block buffer
 */
export function extractBlock(
  buffer: Buffer,
  imageWidth: number,
  imageHeight: number | undefined,
  startX: number,
  startY: number,
  blockSize: number,
): Buffer {
  const channels = 4;
  const blockData: number[] = [];
  for (let y = 0; y < blockSize; y++) {
    for (let x = 0; x < blockSize; x++) {
      // Prevent out-of-bounds access
      const srcX =
        imageWidth && imageHeight !== undefined
          ? Math.min(startX + x, imageWidth - 1)
          : startX + x;
      const srcY =
        imageWidth && imageHeight !== undefined
          ? Math.min(startY + y, (imageHeight ?? 0) - 1)
          : startY + y;
      const pixelIndex = (srcY * imageWidth + srcX) * channels;
      for (let c = 0; c < channels; c++) {
        blockData.push(buffer[pixelIndex + c] || 0);
      }
    }
  }
  return Buffer.from(blockData);
}

/**
 * Place block data at the specified position in the image buffer
 * Fixed to RGBA channels
 *
 * @param targetBuffer Target buffer
 * @param blockData Block data
 * @param targetWidth Target image width
 * @param destX Destination X
 * @param destY Destination Y
 * @param blockSize Block size
 */
export function placeBlock(
  targetBuffer: Buffer,
  blockData: Buffer,
  targetWidth: number,
  destX: number,
  destY: number,
  blockSize: number,
): void {
  const channels = 4;
  for (let y = 0; y < blockSize; y++) {
    for (let x = 0; x < blockSize; x++) {
      const srcIndex = (y * blockSize + x) * channels;
      const destIndex = ((destY + y) * targetWidth + (destX + x)) * channels;
      // Prevent out-of-bounds access
      if (destIndex + channels <= targetBuffer.length) {
        for (let c = 0; c < channels; c++) {
          targetBuffer[destIndex + c] = blockData[srcIndex + c];
        }
      }
    }
  }
}
