import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

import { setupOfflineWorker } from "./offline-worker.js";

const scope = "https://example.test/set/";
const assets = [
  "index.html",
  "assets/app.js",
  "assets/lazy.js",
  "assets/sound.mp3",
].map((url) => ({ url, integrity: "sha256-test" }));

function storage() {
  const entries = new Map();
  const downloads = [];
  return {
    entries,
    downloads,
    fail: false,
    async keys() {
      return [...entries.keys()];
    },
    async delete(name) {
      return entries.delete(name);
    },
    async open(name) {
      if (!entries.has(name)) entries.set(name, new Map());
      const cache = entries.get(name);
      return {
        addAll: async (requests) => {
          if (this.fail) throw new Error("Download failed");
          for (const request of requests) {
            downloads.push(request);
            cache.set(
              request.url,
              new Response(
                request.url.endsWith(".mp3") ? "0123456789" : request.url,
              ),
            );
          }
        },
        match: async (key) => cache.get(key)?.clone(),
      };
    },
  };
}

function boot(caches, version = "v1", appScope = scope) {
  const listeners = new Map();
  const fetch = vi.fn(async () => {
    throw new Error("Offline");
  });
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn();
  runInNewContext(`(${setupOfflineWorker.toString()})(config)`, {
    config: { version, assets },
    self: {
      registration: { scope: appScope },
      clients: { claim },
      skipWaiting,
      addEventListener: (type, handler) => listeners.set(type, handler),
    },
    caches,
    fetch,
    Request,
    Response,
    Headers,
    URL,
  });
  return {
    fetch,
    claim,
    skipWaiting,
    lifecycle(type) {
      let work;
      listeners.get(type)({
        waitUntil: (promise) => {
          work = promise;
        },
      });
      return work;
    },
    request(url, options = {}) {
      let response;
      listeners.get("fetch")({
        request: {
          url,
          method: "GET",
          mode: "cors",
          headers: new Headers(),
          ...options,
        },
        respondWith: (promise) => {
          response = promise;
        },
      });
      return response;
    },
  };
}

describe("offline worker", () => {
  it("downloads every asset with integrity checks before activation", async () => {
    const caches = storage();
    const worker = boot(caches);
    await worker.lifecycle("install");
    expect(caches.downloads.map((request) => request.url)).toEqual(
      assets.map(({ url }) => new URL(url, scope).href),
    );
    expect(
      caches.downloads.every(
        (request) =>
          request.cache === "reload" && request.integrity === "sha256-test",
      ),
    ).toBe(true);
    expect(worker.claim).not.toHaveBeenCalled();
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    await worker.lifecycle("activate");
    expect(worker.claim).toHaveBeenCalledOnce();
  });

  it("serves the app and lazy assets from saved storage in a fresh worker", async () => {
    const caches = storage();
    await boot(caches).lifecycle("install");
    const restarted = boot(caches);
    for (const url of [
      scope,
      `${scope}?bookmark=1`,
      `${scope}index.html?bookmark=1`,
    ]) {
      const response = await restarted.request(url, { mode: "navigate" });
      expect(await response.text()).toBe(`${scope}index.html`);
    }
    const lazy = await restarted.request(`${scope}assets/lazy.js`);
    expect(await lazy.text()).toBe(`${scope}assets/lazy.js`);
    expect(restarted.fetch).not.toHaveBeenCalled();
  });

  it("also supports deployment at the origin root", async () => {
    const caches = storage();
    const root = "https://example.test/";
    const worker = boot(caches, "v1", root);
    await worker.lifecycle("install");
    const response = await worker.request(root, { mode: "navigate" });
    expect(await response.text()).toBe(`${root}index.html`);
  });

  it("retains the old cache until activation and preserves other apps", async () => {
    const caches = storage();
    await boot(caches).lifecycle("install");
    const otherApp = "set-offline:https://example.test/another/:v1";
    await caches.open(otherApp);
    await caches.open("unrelated");
    const update = boot(caches, "v2");
    await update.lifecycle("install");
    expect(await caches.keys()).toContain(`set-offline:${scope}:v1`);
    expect(update.skipWaiting).not.toHaveBeenCalled();
    await update.lifecycle("activate");
    expect((await caches.keys()).sort()).toEqual(
      [otherApp, "unrelated", `set-offline:${scope}:v2`].sort(),
    );
  });

  it("removes a failed download without losing the working version", async () => {
    const caches = storage();
    const original = boot(caches);
    await original.lifecycle("install");
    caches.fail = true;
    await expect(boot(caches, "v2").lifecycle("install")).rejects.toThrow(
      "Download failed",
    );
    expect(await caches.keys()).toEqual([`set-offline:${scope}:v1`]);
    const response = await original.request(scope, { mode: "navigate" });
    expect(await response.text()).toBe(`${scope}index.html`);
  });

  it("leaves unrelated requests and non-GET requests alone", () => {
    const worker = boot(storage());
    expect(
      worker.request("https://elsewhere.test/set/index.html"),
    ).toBeUndefined();
    expect(worker.request("https://example.test/another/")).toBeUndefined();
    expect(worker.request(`${scope}missing.js`)).toBeUndefined();
    expect(
      worker.request(scope, { method: "POST", mode: "navigate" }),
    ).toBeUndefined();
  });

  it("serves audio byte ranges entirely offline", async () => {
    const caches = storage();
    const worker = boot(caches);
    await worker.lifecycle("install");
    for (const [range, body, contentRange] of [
      ["bytes=2-5", "2345", "bytes 2-5/10"],
      ["bytes=7-", "789", "bytes 7-9/10"],
      ["bytes=-3", "789", "bytes 7-9/10"],
      ["bytes=7-99", "789", "bytes 7-9/10"],
    ]) {
      const response = await worker.request(`${scope}assets/sound.mp3`, {
        headers: new Headers({ Range: range }),
      });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(contentRange);
      expect(await response.text()).toBe(body);
    }
    const invalid = await worker.request(`${scope}assets/sound.mp3`, {
      headers: new Headers({ Range: "bytes=20-" }),
    });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");
    expect(worker.fetch).not.toHaveBeenCalled();
  });
});
