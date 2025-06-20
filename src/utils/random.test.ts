import { SeededRandom } from "./random";
import {
  applyShuffleByIndices,
  generateShuffleIndices,
  shuffleArrayWithKey,
  unshuffleArrayWithKey,
  unshuffleByIndices,
} from "./random";

describe("SeededRandom", () => {
  test("next() returns deterministic sequence", () => {
    const rand1 = new SeededRandom(123);
    const rand2 = new SeededRandom(123);
    expect(rand1.next()).toBeCloseTo(rand2.next());
    expect(rand1.next()).toBeCloseTo(rand2.next());
  });

  test("shuffle() shuffles array deterministically", () => {
    const rand = new SeededRandom(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled1 = rand.shuffle(arr);
    const rand2 = new SeededRandom(42);
    const shuffled2 = rand2.shuffle(arr);
    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(arr); // Rarely, the order may not change
  });

  test("generateSeed returns number", () => {
    const seed = SeededRandom.generateSeed();
    expect(typeof seed).toBe("number");
    expect(Number.isInteger(seed)).toBe(true);
  });
});

describe("shuffle/unshuffle helpers", () => {
  test("generateShuffleIndices produces deterministic indices", () => {
    const idx1 = generateShuffleIndices(10, 12345);
    const idx2 = generateShuffleIndices(10, 12345);
    expect(idx1).toEqual(idx2);
    expect(idx1.length).toBe(10);
    // The indices are a permutation of 0-9
    expect([...idx1].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  test("applyShuffleByIndices applies shuffle order", () => {
    const arr = ["a", "b", "c", "d"];
    const indices = [2, 0, 3, 1];
    const shuffled = applyShuffleByIndices(arr, indices);
    expect(shuffled).toEqual(["c", "a", "d", "b"]);
  });

  test("unshuffleByIndices restores original order", () => {
    const arr = ["c", "a", "d", "b"];
    const indices = [2, 0, 3, 1];
    const restored = unshuffleByIndices(arr, indices);
    expect(restored).toEqual(["a", "b", "c", "d"]); // Restore the original order
  });
});

describe("shuffleArrayWithKey & unshuffleArrayWithKey", () => {
  const arr = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  const seed = 42;

  test("shuffleArrayWithKey is deterministic for same key/seed", () => {
    const shuffled1 = shuffleArrayWithKey(arr, seed);
    const shuffled2 = shuffleArrayWithKey(arr, seed);
    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(arr); // Usually shuffled
  });

  test("unshuffleArrayWithKey restores original order", () => {
    const shuffled = shuffleArrayWithKey(arr, seed);
    const restored = unshuffleArrayWithKey(shuffled, seed);
    expect(restored).toEqual(arr);
  });

  test("different key or seed gives different shuffle", () => {
    const shuffled1 = shuffleArrayWithKey(arr, seed);
    const shuffled2 = shuffleArrayWithKey(arr, seed + 1);
    expect(shuffled1).not.toEqual(shuffled2);
  });

  test("empty array returns empty array", () => {
    expect(shuffleArrayWithKey([], seed)).toEqual([]);
    expect(unshuffleArrayWithKey([], seed)).toEqual([]);
  });
});
