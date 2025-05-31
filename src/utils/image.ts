import type sharp from "sharp";

export interface ImageBlockInfo {
  width: number;
  height: number;
  channels: number;
  blockCountX: number;
  blockCountY: number;
}

/**
 * Calculate block counts and image info from sharp metadata and block size
 */
export function getImageBlockInfo(
  metadata: sharp.Metadata,
  blockSize: number,
): ImageBlockInfo {
  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image metadata: width/height missing");
  }
  const width = metadata.width;
  const height = metadata.height;
  const channels = metadata.channels || 3;
  const blockCountX = Math.ceil(width / blockSize);
  const blockCountY = Math.ceil(height / blockSize);
  return {
    width,
    height,
    channels,
    blockCountX,
    blockCountY,
  };
}
