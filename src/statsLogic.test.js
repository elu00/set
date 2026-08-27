import { describe, expect, it } from "vitest";

import { checkSet } from "./gameLogic";
import {
  MIN_SAMPLE_SIZE,
  computeAttributeEffectBySameCount,
  computeBoardSizeTiers,
  computeDifferenceTiers,
  computeHypercubeCellStats,
  differsCount,
  durationHistogram,
  exampleSetForPattern,
  hasEnoughData,
  hypercubePatterns,
  percentileAtThreshold,
  sameCount,
  selectFindsByPattern,
  selectStudyPool,
} from "./statsLogic";

function makeFind(overrides) {
  return {
    id: 1,
    sessionId: 1000,
    findIndex: 0,
    time: 2000,
    durationMs: 1000,
    board: [],
    cards: ["0000", "0001", "0002"],
    sameAttrs: [true, true, true, false],
    studyState: "unreviewed",
    ...overrides,
  };
}

describe("differsCount()", () => {
  it("counts how many of the 4 attributes are different", () => {
    expect(differsCount([true, true, true, true])).toBe(0);
    expect(differsCount([false, true, true, true])).toBe(1);
    expect(differsCount([false, false, true, true])).toBe(2);
    expect(differsCount([false, false, false, false])).toBe(4);
  });
});

describe("sameCount()", () => {
  it("counts how many of the 4 attributes match", () => {
    expect(sameCount([true, true, true, true])).toBe(4);
    expect(sameCount([false, true, true, true])).toBe(3);
    expect(sameCount([false, false, true, true])).toBe(2);
    expect(sameCount([false, false, false, false])).toBe(0);
  });
});

describe("computeAttributeEffectBySameCount()", () => {
  it("splits each same-count bin by one attribute's same/different value", () => {
    // attributeIndex 0 = Color
    const finds = [
      // sameCount 1 bin: color is the one matching attribute
      makeFind({ durationMs: 1000, sameAttrs: [true, false, false, false] }),
      makeFind({ durationMs: 3000, sameAttrs: [true, false, false, false] }),
      // sameCount 1 bin: color differs (shape is the matching attribute)
      makeFind({ durationMs: 9000, sameAttrs: [false, true, false, false] }),
    ];
    const tiers = computeAttributeEffectBySameCount(finds, 0);
    expect(tiers[0]).toStrictEqual({
      sameCount: 1,
      same: { count: 2, meanMs: 2000, stdDevMs: 1000 },
      different: { count: 1, meanMs: 9000, stdDevMs: 0 },
    });
    expect(tiers[1]).toStrictEqual({
      sameCount: 2,
      same: { count: 0, meanMs: null, stdDevMs: null },
      different: { count: 0, meanMs: null, stdDevMs: null },
    });
  });

  it("excludes the sameCount=0 bin, where the attribute is always different", () => {
    const tiers = computeAttributeEffectBySameCount([], 0);
    expect(tiers.map((tier) => tier.sameCount)).toStrictEqual([1, 2, 3]);
  });
});

describe("computeDifferenceTiers()", () => {
  it("buckets finds by how many attributes differ and computes mean/stdDev per tier", () => {
    const finds = [
      makeFind({ durationMs: 1000, sameAttrs: [false, true, true, true] }), // 1 differs
      makeFind({ durationMs: 3000, sameAttrs: [false, true, true, true] }), // 1 differs
      makeFind({ durationMs: 9000, sameAttrs: [false, false, false, false] }), // 4 differ
    ];
    const tiers = computeDifferenceTiers(finds);
    expect(tiers[0]).toStrictEqual({
      tier: 1,
      count: 2,
      meanMs: 2000,
      stdDevMs: 1000,
    });
    expect(tiers[1]).toStrictEqual({
      tier: 2,
      count: 0,
      meanMs: null,
      stdDevMs: null,
    });
    expect(tiers[3]).toStrictEqual({
      tier: 4,
      count: 1,
      meanMs: 9000,
      stdDevMs: 0,
    });
  });
});

describe("computeBoardSizeTiers()", () => {
  it("buckets finds into 12 / 15 / 18+ card boards and computes mean/stdDev per bucket", () => {
    const finds = [
      makeFind({ durationMs: 1000, board: Array(12).fill("0000") }),
      makeFind({ durationMs: 3000, board: Array(12).fill("0000") }),
      makeFind({ durationMs: 5000, board: Array(15).fill("0000") }),
      makeFind({ durationMs: 9000, board: Array(21).fill("0000") }),
    ];
    const tiers = computeBoardSizeTiers(finds);
    expect(tiers[0]).toStrictEqual({
      tier: 12,
      count: 2,
      meanMs: 2000,
      stdDevMs: 1000,
    });
    expect(tiers[1]).toStrictEqual({
      tier: 15,
      count: 1,
      meanMs: 5000,
      stdDevMs: 0,
    });
    // 21-card board lumped into 18+
    expect(tiers[2]).toStrictEqual({
      tier: 18,
      count: 1,
      meanMs: 9000,
      stdDevMs: 0,
    });
  });
});

describe("hypercubePatterns()", () => {
  it("enumerates all 16 same/different combinations as a 4x4 grid", () => {
    const patterns = hypercubePatterns();
    expect(patterns).toHaveLength(16);
    const keys = new Set(patterns.map((p) => p.sameAttrs.join(",")));
    expect(keys.size).toBe(16);
    for (const pattern of patterns) {
      expect(pattern.row).toBeGreaterThanOrEqual(0);
      expect(pattern.row).toBeLessThan(4);
      expect(pattern.col).toBeGreaterThanOrEqual(0);
      expect(pattern.col).toBeLessThan(4);
    }
  });
});

describe("exampleSetForPattern()", () => {
  it("constructs a valid checkSet triple matching the requested pattern", () => {
    for (const pattern of hypercubePatterns().map((p) => p.sameAttrs)) {
      const [a, b, c] = exampleSetForPattern(pattern);
      expect(checkSet(a, b, c)).toBe(true);
      for (let i = 0; i < 4; i += 1) {
        const allSame = a[i] === b[i] && b[i] === c[i];
        expect(allSame).toBe(pattern[i]);
      }
    }
  });
});

describe("selectFindsByPattern() / computeHypercubeCellStats()", () => {
  it("filters to exact pattern matches and computes mean/stdDev", () => {
    const pattern = [true, false, true, false];
    const finds = [
      makeFind({ durationMs: 2000, sameAttrs: pattern }),
      makeFind({ durationMs: 4000, sameAttrs: pattern }),
      makeFind({ durationMs: 1000, sameAttrs: [true, true, true, false] }),
    ];
    const matched = selectFindsByPattern(finds, pattern);
    expect(matched).toHaveLength(2);

    const stats = computeHypercubeCellStats(finds, pattern);
    expect(stats.count).toBe(2);
    expect(stats.meanMs).toBe(3000);
    expect(stats.stdDevMs).toBe(1000); // sqrt of mean squared deviation of [2000,4000] from 3000
  });

  it("returns null mean/stdDev with no matches", () => {
    const stats = computeHypercubeCellStats([], [true, true, true, true]);
    expect(stats.count).toBe(0);
    expect(stats.meanMs).toBe(null);
    expect(stats.stdDevMs).toBe(null);
  });
});

describe("durationHistogram()", () => {
  it("buckets durations into 5-second bins", () => {
    const finds = [
      makeFind({ durationMs: 1000 }), // 1s -> bucket 0
      makeFind({ durationMs: 4000 }), // 4s -> bucket 0
      makeFind({ durationMs: 7000 }), // 7s -> bucket 1
    ];
    const histogram = durationHistogram(finds);
    expect(histogram[0]).toStrictEqual({
      bucketStartSec: 0,
      bucketEndSec: 5,
      count: 2,
    });
    expect(histogram[1]).toStrictEqual({
      bucketStartSec: 5,
      bucketEndSec: 10,
      count: 1,
    });
  });

  it("caps durations above maxSeconds into the final bucket", () => {
    const finds = [
      makeFind({ durationMs: 500000 }),
      makeFind({ durationMs: 119000 }),
    ];
    const histogram = durationHistogram(finds, { maxSeconds: 120 });
    const lastBucket = histogram[histogram.length - 1];
    expect(lastBucket).toStrictEqual({
      bucketStartSec: 115,
      bucketEndSec: 120,
      count: 2,
    });
  });
});

describe("percentileAtThreshold()", () => {
  it("computes the fraction of finds at or above a threshold", () => {
    const finds = [
      makeFind({ durationMs: 1000 }),
      makeFind({ durationMs: 2000 }),
      makeFind({ durationMs: 3000 }),
      makeFind({ durationMs: 4000 }),
    ];
    expect(percentileAtThreshold(finds, 3000)).toBe(0.5);
    expect(percentileAtThreshold(finds, 0)).toBe(1);
    expect(percentileAtThreshold(finds, 5000)).toBe(0);
  });

  it("returns 0 for an empty list", () => {
    expect(percentileAtThreshold([], 1000)).toBe(0);
  });
});

describe("selectStudyPool()", () => {
  it("filters by threshold and excludes confident finds, sorted worst-first", () => {
    const finds = [
      makeFind({ id: 1, durationMs: 1000, studyState: "unreviewed" }),
      makeFind({ id: 2, durationMs: 8000, studyState: "unreviewed" }),
      makeFind({ id: 3, durationMs: 9000, studyState: "confident" }),
      makeFind({ id: 4, durationMs: 6000, studyState: "needsReview" }),
    ];
    const pool = selectStudyPool(finds, 5000);
    expect(pool.map((find) => find.id)).toStrictEqual([2, 4]);
  });
});

describe("hasEnoughData()", () => {
  it("gates on MIN_SAMPLE_SIZE by default", () => {
    const below = Array.from({ length: MIN_SAMPLE_SIZE - 1 }, () =>
      makeFind({}),
    );
    const at = Array.from({ length: MIN_SAMPLE_SIZE }, () => makeFind({}));
    const above = Array.from({ length: MIN_SAMPLE_SIZE + 1 }, () =>
      makeFind({}),
    );
    expect(hasEnoughData(below)).toBe(false);
    expect(hasEnoughData(at)).toBe(true);
    expect(hasEnoughData(above)).toBe(true);
  });
});
