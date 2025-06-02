/**
 * Verify if a secretKey is valid
 * @param secretKey - The secret key to verify
 * @returns The secret key if valid, undefined otherwise
 */
export function verifySecretKey(
  secretKey: string | undefined | null,
): string | undefined {
  if (!!secretKey && secretKey.trim().length > 0) {
    return secretKey;
  }
  return undefined;
}
