const UINT32_RANGE = 0x100000000;

export function normalizeSeed(seed) {
  return String(seed ?? "").trim().toLowerCase();
}

function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (const character of normalizeSeed(seed)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function seededShuffle(values, seed) {
  const shuffled = values.slice();
  const random = seededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    values[0] = (Date.now() ^ Math.floor(Math.random() * UINT32_RANGE)) >>> 0;
  }
  return values[0].toString(36).padStart(7, "0");
}
