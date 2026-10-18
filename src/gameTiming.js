export const MAX_MOVE_DURATION_MS = 120000;

export function capMoveDuration(durationMs) {
  return Math.min(MAX_MOVE_DURATION_MS, Math.max(0, durationMs));
}

export function createTimer(startedAt) {
  return { startedAt, pausedAt: null, pausedMs: 0 };
}

export function elapsedTime(timer, now) {
  return Math.max(
    0,
    (timer.pausedAt ?? now) - timer.startedAt - timer.pausedMs,
  );
}

export function pauseTimer(timer, now) {
  return timer.pausedAt === null ? { ...timer, pausedAt: now } : timer;
}

export function resumeTimer(timer, now) {
  return timer.pausedAt === null
    ? timer
    : {
        ...timer,
        pausedAt: null,
        pausedMs: timer.pausedMs + now - timer.pausedAt,
      };
}

export function moveTiming(history, elapsedMs) {
  const previousElapsed = history.length
    ? history[history.length - 1].elapsedMs
    : 0;
  const durationMs = capMoveDuration(elapsedMs - previousElapsed);
  return {
    durationMs,
    statsElapsedMs:
      history.reduce((sum, event) => sum + event.durationMs, 0) + durationMs,
  };
}
