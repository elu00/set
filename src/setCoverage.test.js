import { describe, expect, it } from "vitest";

import {
  checkSet,
  checkSetUltra,
  findAllSets,
  generateCards,
  initializeDeck,
  setKey,
} from "./gameLogic";
import {
  computeSetCoverage,
  coverageEntry,
  coverageFromFinds,
  mergeCoverage,
} from "./setCoverage";

describe("all playable sets", () => {
  it("enumerates every standard and Junior set exactly once", () => {
    for (const [mode, total] of [
      ["normal", 1080],
      ["setjr", 117],
    ]) {
      const cards = initializeDeck(generateCards(), mode);
      const sets = findAllSets(cards, mode);
      expect(sets).toHaveLength(total);
      expect(new Set(sets.map(setKey)).size).toBe(total);
      expect(sets.every((set) => checkSet(...set))).toBe(true);
      expect(
        findAllSets(cards.slice().reverse(), mode).map(setKey).sort(),
      ).toStrictEqual(sets.map(setKey).sort());
    }
  });

  it("finds exactly the UltraSets recognized by the game's rules", () => {
    const cards = generateCards().slice(0, 12);
    const expected = [];
    for (let a = 0; a < cards.length; a += 1) {
      for (let b = a + 1; b < cards.length; b += 1) {
        for (let c = b + 1; c < cards.length; c += 1) {
          for (let d = c + 1; d < cards.length; d += 1) {
            const set = [cards[a], cards[b], cards[c], cards[d]];
            if (checkSetUltra(...set)) expected.push(setKey(set));
          }
        }
      }
    }
    expect(findAllSets(cards, "ultraset").map(setKey).sort()).toStrictEqual(
      expected.sort(),
    );
    const all = findAllSets(generateCards(), "ultraset");
    expect(new Set(all.map(setKey)).size).toBe(63180);
    expect(all).toHaveLength(63180);
  });

  it("counts chain sets only when one card comes from the preceding set", () => {
    const old = ["0000", "0001", "0002"];
    const board = ["0010", "0020", "0011", "0021", "0012", "0022"];
    const sets = findAllSets(board, "setchain", old);
    expect(sets).toHaveLength(9);
    expect(sets.every((set) => checkSet(...set))).toBe(true);
    expect(
      sets.every(
        (set) => set.filter((card) => old.includes(card)).length === 1,
      ),
    ).toBe(true);
    expect(findAllSets(old, "setchain")).toHaveLength(1);
  });

  it("never counts repeated cards as a set", () => {
    expect(findAllSets(["0000", "0000", "0000"])).toHaveLength(0);
    expect(findAllSets(["0000", "0001", "0002", "0002"])).toHaveLength(1);
  });
});

describe("lifetime set coverage", () => {
  it("counts a set once across games and selection orders", () => {
    const cards = ["0000", "0001", "0002"];
    let coverage = mergeCoverage(new Map(), [coverageEntry(cards)]);
    expect(computeSetCoverage(coverage)).toStrictEqual({
      found: 0,
      appeared: 1,
      total: 1080,
    });
    coverage = mergeCoverage(coverage, [
      coverageEntry(cards.slice().reverse(), true),
    ]);
    coverage = mergeCoverage(coverage, [coverageEntry(cards)]);
    expect(computeSetCoverage(coverage)).toStrictEqual({
      found: 1,
      appeared: 1,
      total: 1080,
    });
  });

  it("merges saved data without losing finds made while it was loading", () => {
    const first = ["0000", "0001", "0002"];
    const second = ["0010", "0011", "0012"];
    const local = new Map([[setKey(first), coverageEntry(first, true)]]);
    const coverage = mergeCoverage(local, [
      coverageEntry(first),
      coverageEntry(second),
    ]);
    expect(computeSetCoverage(coverage)).toStrictEqual({
      found: 1,
      appeared: 2,
      total: 1080,
    });
    expect(local.size).toBe(1);
  });

  it("recovers found and unselected sets from all saved boards", () => {
    const first = ["0000", "0001", "0002"];
    const second = ["0010", "0011", "0012"];
    const board = [...first, ...second];
    const finds = [
      { board, cards: first },
      { board: first, cards: first.slice().reverse() },
    ];
    const coverage = coverageFromFinds(finds);
    expect(computeSetCoverage(coverage)).toStrictEqual({
      found: 1,
      appeared: 2,
      total: 1080,
    });
    expect(coverage.get(setKey(second)).found).toBe(false);
    // Missing old board snapshots can still contribute their recorded find.
    const recoveredFind = coverageFromFinds([{ cards: first }]);
    expect(computeSetCoverage(recoveredFind).found).toBe(1);
  });

  it("shares three-card progress across modes and separates UltraSets", () => {
    const coverage = mergeCoverage(new Map(), [
      coverageEntry(["0000", "0001", "0002"], true),
      coverageEntry(["0010", "0011", "0012"], true),
      coverageEntry(["1202", "0001", "0002", "2101"], true),
    ]);
    expect(computeSetCoverage(coverage)).toStrictEqual({
      found: 2,
      appeared: 2,
      total: 1080,
    });
    expect(computeSetCoverage(coverage, "setjr")).toStrictEqual({
      found: 1,
      appeared: 1,
      total: 117,
    });
    expect(computeSetCoverage(coverage, "setchain")).toStrictEqual({
      found: 2,
      appeared: 2,
      total: 1080,
    });
    expect(computeSetCoverage(coverage, "ultraset")).toStrictEqual({
      found: 1,
      appeared: 1,
      total: 63180,
    });
  });

  it("retains coverage after a storage round trip and resets when cleared", () => {
    const entries = [coverageEntry(["0000", "0001", "0002"], true)];
    const restored = mergeCoverage(
      new Map(),
      JSON.parse(JSON.stringify(entries)),
    );
    expect(computeSetCoverage(restored).found).toBe(1);
    expect(computeSetCoverage(new Map())).toStrictEqual({
      found: 0,
      appeared: 0,
      total: 1080,
    });
  });
});
