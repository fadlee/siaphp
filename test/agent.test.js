import assert from "node:assert/strict";
import test from "node:test";
import PhpParser from "php-parser";
import { renderAgent } from "../src/agent.js";
import { PACKAGE_VERSION } from "../src/constants.js";

const parser = new PhpParser({
  parser: {
    suppressErrors: false
  }
});

test("agent flat menargetkan folder tempat agent berada", async () => {
  const agent = await renderAgent({ secret: "a".repeat(64), structure: "flat" });

  assert.match(agent, /const SIAPHP_SECRET = 'a{64}';/);
  assert.match(agent, new RegExp(`'agentVersion' => '${PACKAGE_VERSION}'`));
  assert.match(agent, /\$targetRoot = __DIR__;/);
  assert.doesNotMatch(agent, /__SIAPHP_/);
  assert.doesNotThrow(() => parser.parseCode(agent, "siaphp-agent.php"));
});

test("agent includes authenticated chunk upload handlers", async () => {
  const agent = await renderAgent({ secret: "c".repeat(64), structure: "flat" });

  assert.match(agent, /chunk-init/);
  assert.match(agent, /chunk-upload/);
  assert.match(agent, /chunk-finalize/);
  assert.match(agent, /hash_file\('sha256', \$source\)/);
  assert.doesNotThrow(() => parser.parseCode(agent, "siaphp-agent.php"));
});

test("agent public menargetkan parent dari document root", async () => {
  const agent = await renderAgent({ secret: "b".repeat(64), structure: "public" });

  assert.match(agent, /\$targetRoot = dirname\(__DIR__\);/);
  assert.doesNotMatch(agent, /__SIAPHP_/);
  assert.doesNotThrow(() => parser.parseCode(agent, "siaphp-agent.php"));
});
