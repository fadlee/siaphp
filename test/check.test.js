import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectJavaScriptFiles, resolveSyntaxCheckFiles } from "../src/check.js";

test("collectJavaScriptFiles mengumpulkan file js lintas subfolder secara terurut", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-check-"));

  try {
    await writeFile(path.join(directory, "root.js"), "export const root = true;\n");
    await writeFile(path.join(directory, "skip.txt"), "ignored\n");
    await writeFile(path.join(directory, "nested.mjs"), "ignored\n");

    const commandsDir = path.join(directory, "commands");
    const deepDir = path.join(commandsDir, "deep");
    await mkdir(deepDir, { recursive: true });
    await writeFile(path.join(directory, "commands.js"), "export const command = true;\n");
    await writeFile(path.join(commandsDir, "deploy.js"), "export const deploy = true;\n");
    await writeFile(path.join(commandsDir, "doctor.txt"), "ignored\n");
    await writeFile(path.join(deepDir, "init.js"), "export const init = true;\n");

    const files = await collectJavaScriptFiles(directory);

    assert.deepEqual(files, [
      path.join(directory, "commands.js"),
      path.join(directory, "commands", "deep", "init.js"),
      path.join(directory, "commands", "deploy.js"),
      path.join(directory, "root.js")
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveSyntaxCheckFiles menerima campuran file dan folder lalu menghapus duplikasi", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-resolve-check-"));

  try {
    const srcDir = path.join(directory, "src");
    const nestedDir = path.join(srcDir, "nested");
    await mkdir(nestedDir, { recursive: true });

    const rootFile = path.join(directory, "bin.js");
    const srcFile = path.join(srcDir, "index.js");
    const nestedFile = path.join(nestedDir, "deep.js");

    await writeFile(rootFile, "export const bin = true;\n");
    await writeFile(srcFile, "export const index = true;\n");
    await writeFile(nestedFile, "export const deep = true;\n");
    await writeFile(path.join(srcDir, "ignore.txt"), "ignored\n");

    const files = await resolveSyntaxCheckFiles([rootFile, srcDir, srcFile], directory);

    assert.deepEqual(files, [rootFile, srcFile, nestedFile]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveSyntaxCheckFiles memberi pesan jelas untuk path yang tidak ada", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-missing-check-"));

  try {
    await assert.rejects(
      () => resolveSyntaxCheckFiles(["missing.js"], directory),
      /Target check tidak ditemukan: missing\.js/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveSyntaxCheckFiles memberi pesan jelas untuk file non-JS", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-non-js-check-"));

  try {
    await writeFile(path.join(directory, "README.md"), "# ignored\n");

    await assert.rejects(
      () => resolveSyntaxCheckFiles(["README.md"], directory),
      /Target check harus berupa file \.js atau folder: README\.md/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
