import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { uploadDeploymentInChunks } from "../src/http.js";

const secret = "chunk-test-secret";

test("chunk upload initializes, uploads chunks, and finalizes", async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ method: request.method, contentType: request.headers["content-type"], body });
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        requests.length === 1
          ? { ok: true }
          : requests.length === 6
            ? { ok: true, release: "chunk-release", deployedFiles: 2 }
            : { ok: true }
      )
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-chunk-"));
  const archivePath = path.join(directory, "release.zip");

  try {
    await writeFile(archivePath, Buffer.from("0123456789abcdef"));
    const progress = [];
    const result = await uploadDeploymentInChunks({
      agentUrl: `http://127.0.0.1:${server.address().port}/agent.php`,
      secret,
      archivePath,
      maxUploadBytes: 10,
      chunkSize: 5,
      onProgress: (event) => progress.push(event)
    });

    assert.deepEqual(result, { ok: true, release: "chunk-release", deployedFiles: 2 });
    assert.equal(requests.length, 6);
    assert.deepEqual(progress, [
      { uploadedBytes: 5, totalBytes: 16, chunkIndex: 0, totalChunks: 4 },
      { uploadedBytes: 10, totalBytes: 16, chunkIndex: 1, totalChunks: 4 },
      { uploadedBytes: 15, totalBytes: 16, chunkIndex: 2, totalChunks: 4 },
      { uploadedBytes: 16, totalBytes: 16, chunkIndex: 3, totalChunks: 4 }
    ]);
    assert.match(requests[0].body.toString(), /chunk-init/);
    assert.match(requests[1].body.toString(), /name="chunk"/);
    assert.match(requests[2].body.toString(), /name="chunk"/);
    assert.match(requests[5].body.toString(), /chunk-finalize/);
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
