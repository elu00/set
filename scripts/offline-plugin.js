import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { setupOfflineWorker } from "./offline-worker.js";

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const name = `${prefix}${entry.name}`;
      return entry.isDirectory()
        ? listFiles(join(directory, entry.name), `${name}/`)
        : name;
    }),
  );
  return files.flat();
}

// Generate the precache from the finished build, including lazy chunks,
// sounds and public assets. No hand-maintained asset list is needed.
export default function offlinePlugin() {
  return {
    name: "offline-cache",
    apply: "build",
    enforce: "post",
    async writeBundle({ dir }) {
      const files = (await listFiles(dir))
        .filter((name) => name !== "sw.js" && !name.endsWith(".map"))
        .sort();
      const worker = setupOfflineWorker.toString();
      const hash = createHash("sha256").update(worker);
      const assets = [];
      for (const file of files) {
        const content = await readFile(join(dir, file));
        hash.update(file).update("\0").update(content).update("\0");
        assets.push({
          url: file,
          integrity: `sha256-${createHash("sha256").update(content).digest("base64")}`,
        });
      }
      const config = { version: hash.digest("hex"), assets };
      await writeFile(
        join(dir, "sw.js"),
        `(${worker})(${JSON.stringify(config)});\n`,
      );
    },
  };
}
