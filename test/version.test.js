import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve("bin/siaphp.js");

test("CLI version matches package.json", async () => {
  const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "-V"]);

  assert.equal(stdout.trim(), packageJson.version);
});
