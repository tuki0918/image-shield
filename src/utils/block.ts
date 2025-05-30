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
  // If the block is at the edge, calculate the actual width/height
  const blockWidth = imageWidth
    ? Math.min(blockSize, imageWidth - startX)
    : blockSize;
  const blockHeight =
    imageHeight !== undefined
      ? Math.min(blockSize, imageHeight - startY)
      : blockSize;
  const blockData: number[] = [];
  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const srcX = startX + x;
      const srcY = startY + y;
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
 * @param blockWidth Block width (optional)
 * @param blockHeight Block height (optional)
 */
export function placeBlock(
  targetBuffer: Buffer,
  blockData: Buffer,
  targetWidth: number,
  destX: number,
  destY: number,
  blockSize: number,
  blockWidth?: number,
  blockHeight?: number,
): void {
  const channels = 4;
  // blockWidth/blockHeight is used if specified, otherwise blockSize is used
  const w = blockWidth ?? blockSize;
  const h = blockHeight ?? blockSize;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIndex = (y * w + x) * channels;
      const destIndex = ((destY + y) * targetWidth + (destX + x)) * channels;
      if (destIndex + channels <= targetBuffer.length) {
        for (let c = 0; c < channels; c++) {
          targetBuffer[destIndex + c] = blockData[srcIndex + c];
        }
      }
    }
  }
}
