import { describe, expect, it } from "vitest";

import {
  capMoveDuration,
  createTimer,
  elapsedTime,
  moveTiming,
  pauseTimer,
  resumeTimer,
} from "./gameTiming";

describe("game timing", () => {
  it("freezes the clock and excludes the entire pause when play resumes", () => {
    const timer = pauseTimer(createTimer(1000), 6000);
    expect(elapsedTime(timer, 6000)).toBe(5000);
    expect(elapsedTime(timer, 606000)).toBe(5000);
    const resumed = resumeTimer(timer, 606000);
    expect(elapsedTime(resumed, 609000)).toBe(8000);
  });

  it("handles multiple pauses without double-counting repeated events", () => {
    let timer = pauseTimer(createTimer(1000), 6000);
    timer = pauseTimer(timer, 8000);
    timer = resumeTimer(timer, 16000);
    timer = resumeTimer(timer, 18000);
    timer = pauseTimer(timer, 20000);
    timer = resumeTimer(timer, 30000);
    expect(elapsedTime(timer, 31000)).toBe(10000);
  });

  it("excludes a pause when the resuming action completes the current set", () => {
    const timer = pauseTimer(createTimer(1000), 11000);
    const resumed = resumeTimer(timer, 611000);
    const timing = moveTiming([], elapsedTime(resumed, 611000));
    expect(timing).toStrictEqual({ durationMs: 10000, statsElapsedMs: 10000 });
  });

  it("caps each move independently without carrying excess into the next", () => {
    const first = moveTiming([], 300000);
    expect(first.durationMs).toBe(120000);
    const history = [{ elapsedMs: 300000, durationMs: first.durationMs }];
    expect(moveTiming(history, 310000)).toStrictEqual({
      durationMs: 10000,
      statsElapsedMs: 130000,
    });
    history.push({ elapsedMs: 310000, durationMs: 10000 });
    expect(moveTiming(history, 600000)).toStrictEqual({
      durationMs: 120000,
      statsElapsedMs: 250000,
    });
  });

  it("keeps the active clock uncapped and resets it for a new game", () => {
    expect(elapsedTime(createTimer(1000), 301000)).toBe(300000);
    const fresh = createTimer(301000);
    expect(fresh.pausedAt).toBe(null);
    expect(elapsedTime(fresh, 302000)).toBe(1000);
    expect(moveTiming([], 1000).statsElapsedMs).toBe(1000);
  });

  it("preserves ordinary moves and caps at exactly 120 seconds", () => {
    expect(capMoveDuration(0)).toBe(0);
    expect(capMoveDuration(119999)).toBe(119999);
    expect(capMoveDuration(120000)).toBe(120000);
    expect(capMoveDuration(120001)).toBe(120000);
  });
});
