import { describe, expect, it } from "vitest";

import { normalizeSeed, seededShuffle } from "./seededShuffle";

describe("seededShuffle()", () => {
  const values = Array.from({ length: 30 }, (_, index) => index);

  it("reproduces the same ordering for the same seed", () => {
    expect(seededShuffle(values, "example-seed")).toStrictEqual(
      seededShuffle(values, "example-seed"),
    );
  });

  it("produces a different ordering for a different seed", () => {
    expect(seededShuffle(values, "first-seed")).not.toStrictEqual(
      seededShuffle(values, "second-seed"),
    );
  });

  it("does not mutate or change the contents of the input", () => {
    const original = values.slice();
    expect(seededShuffle(values, "example-seed").sort((a, b) => a - b)).toStrictEqual(
      original,
    );
    expect(values).toStrictEqual(original);
  });
});

describe("normalizeSeed()", () => {
  it("makes pasted seeds insensitive to whitespace and case", () => {
    expect(normalizeSeed("  AbC-123  ")).toBe("abc-123");
  });
});
