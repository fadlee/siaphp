import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createArchive } from "../src/archive.js";
import { DEFAULT_EXCLUDES } from "../src/constants.js";

test("archive memasukkan source dan mengecualikan secret", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-archive-"));

  try {
    await writeFile(path.join(directory, "index.php"), "<?php echo 'ok';");
    await writeFile(path.join(directory, ".env"), "APP_KEY=secret");
    const archivePath = path.join(os.tmpdir(), `siaphp-${Date.now()}.zip`);

    const result = await createArchive({
      root: directory,
      destination: archivePath,
      exclude: DEFAULT_EXCLUDES
    });
    const bytes = await readFile(archivePath);

    assert.ok(result.bytes > 0);
    assert.ok(bytes.includes(Buffer.from("index.php")));
    assert.ok(!bytes.includes(Buffer.from(".env")));
    await rm(archivePath, { force: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
