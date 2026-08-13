import assert from "node:assert/strict";
import test from "node:test";
import { chooseReleaseType, ensureClean, RELEASE_TYPES } from "../scripts/release.js";

test("release selector offers patch, minor, and major", async () => {
  let promptOptions;
  const selected = await chooseReleaseType(async (options) => {
    promptOptions = options;
    return "minor";
  });

  assert.equal(selected, "minor");
  assert.deepEqual(
    promptOptions.choices.map(({ name, value }) => ({ name, value })),
    [
      { name: "Patch (bug fixes)", value: "patch" },
      { name: "Minor (backward-compatible features)", value: "minor" },
      { name: "Major (breaking changes)", value: "major" }
    ]
  );
});

test("release types are valid npm version increments", () => {
  assert.deepEqual(RELEASE_TYPES, ["patch", "minor", "major"]);
});

test("release preflight rejects a dirty working tree", async () => {
  await assert.rejects(
    () => ensureClean(async () => " M package.json\n"),
    /working directory is not clean/
  );
});
