import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_EXCLUDES } from "../src/constants.js";
import { loadIgnoreFile, parseIgnore, resolveProjectExcludes, writeIgnoreFile } from "../src/ignore.js";

test("parseIgnore mengabaikan komentar dan baris kosong", () => {
  const contents = `
# komentar
*.log

   .github/  
!negasi
`;

  assert.deepEqual(parseIgnore(contents), ["*.log", ".github/", "!negasi"]);
});

test("loadIgnoreFile memuat pattern dari .siaphpignore", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-ignore-"));

  try {
    await writeFile(path.join(directory, ".siaphpignore"), "*.log\n# comment\n.github/\n");
    const patterns = await loadIgnoreFile(directory);
    assert.deepEqual(patterns, ["*.log", ".github/"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveProjectExcludes menggabungkan default, config, dan .siaphpignore", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-excludes-"));

  try {
    await writeFile(path.join(directory, ".siaphpignore"), "*.log\n.github/\n");
    const excludes = await resolveProjectExcludes(["vendor/"], directory);

    for (const pattern of DEFAULT_EXCLUDES) {
      assert.ok(excludes.includes(pattern), `missing default ${pattern}`);
    }
    assert.ok(excludes.includes("vendor/"));
    assert.ok(excludes.includes("*.log"));
    assert.ok(excludes.includes(".github/"));
    assert.equal(new Set(excludes).size, excludes.length);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("writeIgnoreFile membuat file sampel jika belum ada", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-writeignore-"));

  try {
    await writeIgnoreFile(directory);
    const contents = await readFile(path.join(directory, ".siaphpignore"), "utf8");
    assert.match(contents, /# File ini menambahkan/);

    await writeFile(path.join(directory, ".siaphpignore"), "existing");
    await writeIgnoreFile(directory);
    const existing = await readFile(path.join(directory, ".siaphpignore"), "utf8");
    assert.equal(existing, "existing");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
