// Safari can ignore overscroll-behavior for pull-to-refresh:
// https://bugs.webkit.org/show_bug.cgi?id=275947
// Cancel only downward, single-finger pulls with nowhere left to scroll up.
export function preventPullToRefresh(doc = document) {
  let previousTouch = null;
  let target = null;

  function canScrollUp() {
    const root = doc.scrollingElement || doc.documentElement;
    for (let element = target; element; element = element.parentElement) {
      if (element === root) return element.scrollTop > 0;
      if (element.scrollTop > 0 && element.scrollHeight > element.clientHeight) {
        const { overflowY } = doc.defaultView.getComputedStyle(element);
        if (/^(auto|scroll|overlay)$/.test(overflowY)) return true;
      }
    }
    return root.scrollTop > 0;
  }

  function reset() {
    previousTouch = null;
    target = null;
  }

  function start(event) {
    if (event.touches.length !== 1) {
      reset();
      return;
    }
    previousTouch = event.touches[0];
    target = event.target;
  }

  function move(event) {
    if (!previousTouch || event.touches.length !== 1) {
      reset();
      return;
    }
    const touch = event.touches[0];
    const deltaX = touch.clientX - previousTouch.clientX;
    const deltaY = touch.clientY - previousTouch.clientY;
    previousTouch = touch;
    if (event.cancelable && deltaY > Math.abs(deltaX) && !canScrollUp()) {
      event.preventDefault();
    }
  }

  doc.addEventListener("touchstart", start, { passive: true });
  doc.addEventListener("touchmove", move, { passive: false });
  doc.addEventListener("touchend", reset, { passive: true });
  doc.addEventListener("touchcancel", reset, { passive: true });
  return () => {
    doc.removeEventListener("touchstart", start);
    doc.removeEventListener("touchmove", move);
    doc.removeEventListener("touchend", reset);
    doc.removeEventListener("touchcancel", reset);
  };
}
