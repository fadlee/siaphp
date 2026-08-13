import assert from "node:assert/strict";
import test from "node:test";
import { assertArchiveFitsAgent } from "../src/commands/deploy.js";

test("archive size preflight rejects archives above agent limit", () => {
  assert.throws(
    () => assertArchiveFitsAgent({ bytes: 101 * 1024 * 1024 }, { maxUploadBytes: 100 * 1024 * 1024 }),
    /Archive terlalu besar.*101\.0 MB.*100\.0 MB/
  );
});

test("archive size preflight accepts archives within agent limit", () => {
  assert.doesNotThrow(() =>
    assertArchiveFitsAgent({ bytes: 100 * 1024 * 1024 }, { maxUploadBytes: 100 * 1024 * 1024 })
  );
});
