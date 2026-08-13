import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkAgent, uploadDeployment } from "../src/http.js";

test("doctor dan deploy mengirim request bertanda tangan", async () => {
  const secret = "integration-secret";
  const seen = [];
  const server = http.createServer(async (request, response) => {
    const body = await readBody(request);
    const action = request.headers["content-type"]?.startsWith("application/json")
      ? JSON.parse(body.toString()).action
      : "deploy";
    const archiveHash =
      action === "doctor"
        ? createHash("sha256").update("").digest("hex")
        : extractField(body, "archiveHash");
    const canonical = [
      request.headers["x-siaphp-timestamp"],
      request.headers["x-siaphp-nonce"],
      action,
      archiveHash
    ].join("\n");
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");
    seen.push({ action, valid: expected === request.headers["x-siaphp-signature"] });

    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        action === "doctor"
          ? {
              ok: true,
              agentVersion: "0.1.0",
              phpVersion: "8.3.0",
              zipArchive: true,
              targetWritable: true,
              maxUploadBytes: 1024
            }
          : { ok: true, release: "test-release", deployedFiles: 1 }
      )
    );
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const agentUrl = `http://127.0.0.1:${address.port}/agent.php`;
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-http-"));
  const archivePath = path.join(directory, "release.zip");

  try {
    await writeFile(archivePath, "fake zip for signature test");
    await checkAgent(agentUrl, secret);
    const deployed = await uploadDeployment({ agentUrl, secret, archivePath });

    assert.equal(deployed.release, "test-release");
    assert.deepEqual(seen, [
      { action: "doctor", valid: true },
      { action: "deploy", valid: true }
    ]);
  } finally {
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("upload reports a clear message for HTTP 413 responses", async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(413, { "Content-Type": "text/html" });
    response.end("Payload Too Large");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-http-413-"));
  const archivePath = path.join(directory, "release.zip");

  try {
    await writeFile(archivePath, "fake zip");
    await assert.rejects(
      () => uploadDeployment({
        agentUrl: `http://127.0.0.1:${server.address().port}/agent.php`,
        secret: "integration-secret",
        archivePath
      }),
      /HTTP 413.*upload_max_filesize.*post_max_size/
    );
  } finally {
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

async function readBody(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function extractField(body, field) {
  const match = body.toString("latin1").match(new RegExp(`name="${field}"\\r\\n\\r\\n([^\\r]+)`));
  assert.ok(match, `${field} harus ada di multipart body`);
  return match[1];
}
