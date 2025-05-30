import { SeededRandom } from "../../src/utils/random";
import {
  applyShuffleByIndices,
  generateShuffleIndices,
  unshuffleByIndices,
} from "../../src/utils/random";

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
    expect(shuffled1).not.toEqual(arr); // ごく稀に順序が変わらない可能性あり
  });

  test("createSeedFromKeyAndSeed returns consistent number", () => {
    const s1 = SeededRandom.createSeedFromKeyAndSeed("key", 123);
    const s2 = SeededRandom.createSeedFromKeyAndSeed("key", 123);
    expect(s1).toBe(s2);
    expect(typeof s1).toBe("number");
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
