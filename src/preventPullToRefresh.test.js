import { describe, expect, it } from "vitest";

import { preventPullToRefresh } from "./preventPullToRefresh";

function setup(scrollTop = 0) {
  const listeners = new Map();
  const root = { scrollTop, parentElement: null };
  const doc = {
    scrollingElement: root,
    defaultView: { getComputedStyle: (element) => element.style },
    addEventListener: (type, handler, options) => {
      listeners.set(type, { handler, options });
    },
    removeEventListener: (type) => listeners.delete(type),
  };
  const cleanup = preventPullToRefresh(doc);
  function dispatch(type, touches, target = root, cancelable = true) {
    let prevented = false;
    listeners.get(type).handler({
      touches: touches.map(([clientX, clientY]) => ({ clientX, clientY })),
      target,
      cancelable,
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  }
  return { root, listeners, cleanup, dispatch };
}

describe("pull-to-refresh prevention", () => {
  it("blocks a downward pull at the top of the page", () => {
    const { dispatch, listeners } = setup();
    expect(listeners.get("touchmove").options.passive).toBe(false);
    dispatch("touchstart", [[50, 50]]);
    expect(dispatch("touchmove", [[50, 100]])).toBe(true);
  });

  it("allows scrolling toward the top until the page reaches it", () => {
    const { dispatch, root } = setup(50);
    dispatch("touchstart", [[50, 50]]);
    expect(dispatch("touchmove", [[50, 100]])).toBe(false);
    root.scrollTop = 0;
    expect(dispatch("touchmove", [[50, 150]])).toBe(true);
  });

  it("allows upward and horizontal gestures", () => {
    const { dispatch } = setup();
    dispatch("touchstart", [[50, 50]]);
    expect(dispatch("touchmove", [[50, 10]])).toBe(false);
    dispatch("touchstart", [[50, 50]]);
    expect(dispatch("touchmove", [[100, 55]])).toBe(false);
  });

  it("preserves scrolling in a nested dialog", () => {
    const { dispatch, root } = setup();
    const dialog = {
      scrollTop: 50,
      scrollHeight: 500,
      clientHeight: 200,
      style: { overflowY: "auto" },
      parentElement: root,
    };
    dispatch("touchstart", [[50, 50]], dialog);
    expect(dispatch("touchmove", [[50, 100]])).toBe(false);
    dialog.scrollTop = 0;
    expect(dispatch("touchmove", [[50, 150]])).toBe(true);
  });

  it("leaves pinch zoom and the remainder of multi-touch gestures alone", () => {
    const { dispatch } = setup();
    dispatch("touchstart", [[50, 50]]);
    dispatch("touchstart", [
      [50, 50],
      [100, 50],
    ]);
    expect(
      dispatch("touchmove", [
        [50, 100],
        [100, 100],
      ]),
    ).toBe(false);
    expect(dispatch("touchmove", [[50, 150]])).toBe(false);
  });

  it("does not cancel non-cancelable events and removes listeners on cleanup", () => {
    const { dispatch, cleanup, listeners } = setup();
    dispatch("touchstart", [[50, 50]]);
    expect(dispatch("touchmove", [[50, 100]], undefined, false)).toBe(false);
    dispatch("touchcancel", []);
    expect(dispatch("touchmove", [[50, 150]])).toBe(false);
    cleanup();
    expect(listeners.size).toBe(0);
  });
});
