import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createConfig, writeProjectFiles } from "../src/config.js";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve("bin/siaphp.js");

test("deploy exposes the --verbose option", async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "deploy", "--help"]);

  assert.match(stdout, /--verbose/);
});

test("verbose deploy prints diagnostic details", async () => {
  const agent = await createAgentServer();
  const directory = await mkdtemp(path.join(os.tmpdir(), "siaphp-deploy-"));

  try {
    await writeFile(path.join(directory, "index.php"), "<?php echo 'ok';");
    const config = createConfig({ structure: "flat", agentUrl: agent.url });
    await writeProjectFiles(directory, config, { schemaVersion: 1, secret: "test-secret" });

    const { stdout } = await execFileAsync(
      process.execPath,
      [cliPath, "deploy", "--allow-http", "--verbose"],
      { cwd: directory, env: { ...process.env, NO_COLOR: "1" } }
    );

    assert.match(stdout, new RegExp(`Project root: .+${escapeRegExp(path.basename(directory))}`));
    assert.match(stdout, /Entrypoint: index\.php/);
    assert.match(stdout, new RegExp(`Agent: ${escapeRegExp(agent.url)}`));
    assert.match(stdout, /Agent version: 0\.1\.0/);
    assert.match(stdout, /PHP version: 8\.3\.0/);
    assert.match(stdout, /Archive entries: 1/);
    assert.match(stdout, /Archive path:/);
    assert.match(stdout, /Release: test-release/);
    assert.match(stdout, /Files deployed: 1/);
  } finally {
    agent.server.close();
    await once(agent.server, "close");
    await rm(directory, { recursive: true, force: true });
  }
});

async function createAgentServer() {
  let requestCount = 0;
  const server = http.createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Consume the request body before responding.
    }

    requestCount += 1;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        requestCount === 1
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
  return { server, url: `http://127.0.0.1:${server.address().port}/agent.php` };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
