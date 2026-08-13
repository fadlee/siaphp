import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createSignedHeaders, sha256 } from "../src/crypto.js";

test("signed headers menghasilkan signature HMAC yang dapat diverifikasi", () => {
  const secret = "secret-for-test";
  const payloadHash = sha256("archive");
  const headers = createSignedHeaders(secret, "deploy", payloadHash);
  const canonical = [
    headers["X-Siaphp-Timestamp"],
    headers["X-Siaphp-Nonce"],
    "deploy",
    payloadHash
  ].join("\n");
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");

  assert.equal(headers["X-Siaphp-Signature"], expected);
  assert.match(headers["X-Siaphp-Nonce"], /^[a-f0-9-]{36}$/);
});

test("chunk signatures bind upload metadata", () => {
  const secret = "secret-for-test";
  const headers = createSignedHeaders(secret, "chunk-upload", sha256("chunk"), "upload\narchive\n2\n4");
  const canonical = [
    headers["X-Siaphp-Timestamp"],
    headers["X-Siaphp-Nonce"],
    "chunk-upload",
    sha256("chunk"),
    "upload\narchive\n2\n4"
  ].join("\n");

  assert.equal(
    headers["X-Siaphp-Signature"],
    createHmac("sha256", secret).update(canonical).digest("hex")
  );
});
