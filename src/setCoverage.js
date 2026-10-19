import { findAllSets, generateCards, initializeDeck, setKey } from "./gameLogic";

export function coverageEntry(cards, found = false) {
  return { key: setKey(cards), cards: cards.slice().sort(), found };
}

export function mergeCoverage(current, entries) {
  const next = new Map(current);
  for (const entry of entries) {
    const previous = next.get(entry.key);
    next.set(entry.key, {
      ...entry,
      found: Boolean(entry.found || previous?.found),
    });
  }
  return next;
}

// Old find records contain the board immediately before a successful move.
// Boards from abandoned games were not saved and cannot be recovered.
export function coverageFromFinds(finds) {
  const coverage = new Map();
  for (const find of finds) {
    for (const cards of findAllSets(find.board || [])) {
      const entry = coverageEntry(cards);
      if (!coverage.has(entry.key)) coverage.set(entry.key, entry);
    }
    const found = coverageEntry(find.cards, true);
    coverage.set(found.key, found);
  }
  return coverage;
}

export function computeSetCoverage(coverage, gameMode = "normal") {
  const deck = new Set(initializeDeck(generateCards(), gameMode));
  const size = gameMode === "ultraset" ? 4 : 3;
  let found = 0;
  let appeared = 0;
  for (const entry of coverage.values()) {
    if (
      entry.cards.length !== size ||
      !entry.cards.every((card) => deck.has(card))
    ) {
      continue;
    }
    appeared += 1;
    if (entry.found) found += 1;
  }
  // Every pair determines a third card. For UltraSet, each of n conjugates
  // has (n - 1) / 2 disjoint pairs; choose two pairs to form a quartet.
  const n = deck.size;
  const total = size === 4 ? (n * (n - 1) * (n - 3)) / 8 : (n * (n - 1)) / 6;
  return { found, appeared, total };
}
