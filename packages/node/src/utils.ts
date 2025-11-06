import crypto from "node:crypto";

/**
 * Generate a unique manifest ID
 * @returns A UUID string
 */
export function generateManifestId(): string {
  return crypto.randomUUID();
}
