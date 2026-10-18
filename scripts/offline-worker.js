// Keep this function self-contained: the build emits it as dist/sw.js.
export function setupOfflineWorker({ version, assets }) {
  const scope = new URL(self.registration.scope);
  const prefix = `set-offline:${scope.href}:`;
  const cacheName = `${prefix}${version}`;
  const indexURL = new URL("index.html", scope).href;
  const assetURLs = new Set(
    assets.map((asset) => new URL(asset.url, scope).href),
  );

  self.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(cacheName);
          // Integrity checks reject mixed versions during a deployment, and
          // reload bypasses potentially stale entries in the HTTP cache.
          await cache.addAll(
            assets.map(
              ({ url, integrity }) =>
                new Request(new URL(url, scope), { cache: "reload", integrity }),
            ),
          );
        } catch (error) {
          await caches.delete(cacheName);
          throw error;
        }
      })(),
    );
    // Updates wait for all existing game tabs to close before taking over.
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith(prefix) && name !== cacheName)
            .map((name) => caches.delete(name)),
        );
        await self.clients.claim();
      })(),
    );
  });

  async function fromCache(request, key) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(key);
    if (!response) return fetch(request);

    // Audio players can request only part of a cached sound file.
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
    if (!range || (!range[1] && !range[2])) return response;
    const data = await response.arrayBuffer();
    const start = range[1]
      ? Number(range[1])
      : Math.max(0, data.byteLength - Number(range[2]));
    const end =
      range[1] && range[2]
        ? Math.min(Number(range[2]), data.byteLength - 1)
        : data.byteLength - 1;
    if (start > end || start >= data.byteLength) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${data.byteLength}` },
      });
    }
    const headers = new Headers(response.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${data.byteLength}`);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Accept-Ranges", "bytes");
    return new Response(data.slice(start, end + 1), { status: 206, headers });
  }

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== scope.origin) return;
    url.search = "";
    if (
      request.mode === "navigate" &&
      (url.href === scope.href || url.href === indexURL)
    ) {
      event.respondWith(fromCache(request, indexURL));
    } else if (assetURLs.has(url.href)) {
      event.respondWith(fromCache(request, url.href));
    }
  });
}
