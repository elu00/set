export const ATTRIBUTE_NAMES = ["Color", "Shape", "Shade", "Number"];
export const MIN_SAMPLE_SIZE = 15;
export const HYPERCUBE_MIN_SAMPLES = 3;

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values) {
  if (values.length === 0) return null;
  const m = mean(values);
  return (
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length
  );
}

function stdDev(values) {
  const v = variance(values);
  return v === null ? null : Math.sqrt(v);
}

// How many of the 4 attributes differ (rather than match) across a found
// set's 3 cards. Ranges 1-4 for any valid set of distinct cards (0 would
// mean 3 identical cards, which can't happen in an 81-card deck).
export function differsCount(sameAttrs) {
  return sameAttrs.filter((same) => !same).length;
}

export function computeDifferenceTiers(finds) {
  return [1, 2, 3, 4].map((tier) => {
    const durations = finds
      .filter((find) => differsCount(find.sameAttrs) === tier)
      .map((find) => find.durationMs);
    return {
      tier,
      count: durations.length,
      meanMs: mean(durations),
      stdDevMs: stdDev(durations),
    };
  });
}

// How many of the 4 attributes match (rather than differ). Ranges 0-3 for
// any valid set of distinct cards (3 would mean only 1 attribute differs;
// 4 is impossible, same reasoning as differsCount).
export function sameCount(sameAttrs) {
  return sameAttrs.filter((same) => same).length;
}

// Within each "how many attributes matched overall" bin (1, 2, or 3 —
// 0 is excluded because every attribute is necessarily different there,
// so a single attribute can't vary between same/different within that
// bin), splits finds by whether one specific attribute was itself the
// same or different, and computes mean/stdDev for each half. Answers
// "controlling for how many attributes matched, does this attribute in
// particular make a difference?"
export function computeAttributeEffectBySameCount(finds, attributeIndex) {
  return [1, 2, 3].map((bin) => {
    const inBin = finds.filter((find) => sameCount(find.sameAttrs) === bin);
    const same = inBin.filter((find) => find.sameAttrs[attributeIndex]);
    const different = inBin.filter((find) => !find.sameAttrs[attributeIndex]);
    const toStats = (group) => ({
      count: group.length,
      meanMs: mean(group.map((find) => find.durationMs)),
      stdDevMs: stdDev(group.map((find) => find.durationMs)),
    });
    return {
      sameCount: bin,
      same: toStats(same),
      different: toStats(different),
    };
  });
}

// Buckets a board size into one of the sizes normal-mode boards actually
// take: 12 (the common case), 15, or 18+ (rare — lumped together since
// splitDeck only grows further when even a 15-card board has no set).
function boardSizeBucket(boardSize) {
  if (boardSize <= 12) return 12;
  if (boardSize === 15) return 15;
  return 18;
}

export function computeBoardSizeTiers(finds) {
  return [12, 15, 18].map((bucket) => {
    const durations = finds
      .filter((find) => boardSizeBucket(find.board.length) === bucket)
      .map((find) => find.durationMs);
    return {
      tier: bucket,
      count: durations.length,
      meanMs: mean(durations),
      stdDevMs: stdDev(durations),
    };
  });
}

// The possible combinations of same/different across the 4 attributes,
// positioned in a 4x4 grid: rows vary Color/Shape, columns vary Shade/Number.
export function hypercubePatterns() {
  const pairs = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];
  const patterns = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      patterns.push({ row, col, sameAttrs: [...pairs[row], ...pairs[col]] });
    }
  }
  // The all-same pattern would require selecting the same card three times.
  // It can never occur in a real game, where cards on the board are distinct.
  return patterns.filter((pattern) => pattern.sameAttrs.some((same) => !same));
}

export function selectFindsByPattern(finds, sameAttrs) {
  return finds.filter((find) =>
    find.sameAttrs.every((same, index) => same === sameAttrs[index]),
  );
}

export function computeHypercubeCellStats(finds, sameAttrs) {
  const durations = selectFindsByPattern(finds, sameAttrs).map(
    (find) => find.durationMs,
  );
  return {
    sameAttrs,
    count: durations.length,
    meanMs: mean(durations),
    stdDevMs: stdDev(durations),
  };
}

// A constructed (not necessarily played) example set illustrating a
// same/different pattern: matching attributes are pinned to digit 0,
// differing attributes cycle 0/1/2 — both are valid per checkSet's
// per-attribute mod-3 rule.
export function exampleSetForPattern(sameAttrs) {
  const cards = [[], [], []];
  for (let i = 0; i < 4; i += 1) {
    if (sameAttrs[i]) {
      cards[0].push("0");
      cards[1].push("0");
      cards[2].push("0");
    } else {
      cards[0].push("0");
      cards[1].push("1");
      cards[2].push("2");
    }
  }
  return cards.map((digits) => digits.join(""));
}

export function durationHistogram(finds, options = {}) {
  const { maxSeconds = 120, bucketSeconds = 5 } = options;
  const bucketCount = Math.ceil(maxSeconds / bucketSeconds);
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    bucketStartSec: i * bucketSeconds,
    bucketEndSec: Math.min((i + 1) * bucketSeconds, maxSeconds),
    count: 0,
  }));

  for (const find of finds) {
    const seconds = find.durationMs / 1000;
    const index = Math.min(
      Math.floor(seconds / bucketSeconds),
      bucketCount - 1,
    );
    buckets[index].count += 1;
  }

  return buckets;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function finishDurations(finds) {
  return finds
    .map((find) => find.finishDurationMs)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
}

export function computeFinishTimeStats(finds) {
  const durations = finishDurations(finds);
  return {
    count: durations.length,
    meanMs: mean(durations),
    medianMs: median(durations),
    stdDevMs: stdDev(durations),
    minMs: durations.length ? Math.min(...durations) : null,
    maxMs: durations.length ? Math.max(...durations) : null,
  };
}

export function finishTimeHistogram(finds, options = {}) {
  const { bucketSeconds = 60 } = options;
  const durations = finishDurations(finds);
  if (durations.length === 0) return [];
  const maxDurationSeconds = Math.max(...durations) / 1000;
  const maxSeconds = Math.max(
    bucketSeconds,
    Math.ceil(maxDurationSeconds / bucketSeconds) * bucketSeconds,
  );
  return durationHistogram(
    durations.map((durationMs) => ({ durationMs })),
    { maxSeconds, bucketSeconds },
  );
}

export function percentileAtThreshold(finds, thresholdMs) {
  if (finds.length === 0) return 0;
  const slowCount = finds.filter(
    (find) => find.durationMs >= thresholdMs,
  ).length;
  return slowCount / finds.length;
}

export function selectStudyPool(finds, thresholdMs) {
  return finds
    .filter(
      (find) =>
        find.durationMs >= thresholdMs && find.studyState !== "confident",
    )
    .sort((a, b) => b.durationMs - a.durationMs);
}

export function hasEnoughData(finds, minSamples = MIN_SAMPLE_SIZE) {
  return finds.length >= minSamples;
}
