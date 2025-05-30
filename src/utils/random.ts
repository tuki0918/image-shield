import crypto from "node:crypto";

export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // This method uses a Linear Congruential Generator (LCG) to produce pseudo-random numbers.
  // The numbers 9301 (multiplier), 49297 (increment), and 233280 (modulus) are classic parameters
  // often used in simple LCG implementations, such as in old BASIC languages. They provide a reasonable
  // period and distribution for non-cryptographic purposes, but are not suitable for cryptographic use.
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  static createSeedFromKeyAndSeed(secretKey: string, seed: number): number {
    // Hash secretKey+seed with SHA256, then convert the lower 8 digits to decimal
    const hash = crypto
      .createHash("sha256")
      .update(secretKey + seed)
      .digest("hex");
    // Convert the first 8 digits to a number
    return Number.parseInt(hash.slice(0, 8), 16) % 100000000;
  }
}
