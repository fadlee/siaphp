import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createConfig, loadProject, writeProjectFiles } from "../src/config.js";

test("createConfig memilih entrypoint sesuai struktur", () => {
  assert.equal(
    createConfig({ structure: "flat", agentUrl: "https://example.test/agent.php" }).entrypoint,
    "index.php"
  );
  assert.equal(
    createConfig({ structure: "public", agentUrl: "https://example.test/agent.php" }).entrypoint,
    "public/index.php"
  );
});

test("config dan credentials dapat ditulis lalu dibaca", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-config-"));

  try {
    const config = createConfig({
      structure: "flat",
      agentUrl: "https://example.test/siaphp-agent.php"
    });
    await writeProjectFiles(directory, config, { schemaVersion: 1, secret: "abc" });

    const loaded = await loadProject(directory);
    assert.deepEqual(loaded.config, config);
    assert.equal(loaded.credentials.secret, "abc");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
