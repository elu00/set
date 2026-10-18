function waitForActivation(registration) {
  if (registration.active?.state === "activated") return Promise.resolve();
  const worker =
    registration.installing || registration.waiting || registration.active;
  if (!worker) return Promise.reject(new Error("Offline worker unavailable"));

  return new Promise((resolve, reject) => {
    const check = () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        worker.removeEventListener("statechange", check);
        if (worker.state === "activated") resolve();
        else reject(new Error("Offline download failed"));
      }
    };
    worker.addEventListener("statechange", check);
    check();
  });
}

export async function prepareOffline() {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  let registration;
  try {
    registration = await navigator.serviceWorker.register(
      new URL("sw.js", base),
      { scope: base.href, updateViaCache: "none" },
    );
  } catch (error) {
    // An offline revisit can still use a previously installed worker even
    // when checking for an update fails.
    registration = await navigator.serviceWorker.getRegistration(base.href);
    if (registration?.scope !== base.href || !registration.active) throw error;
  }
  await waitForActivation(registration);
}
