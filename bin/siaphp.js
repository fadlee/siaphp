#!/usr/bin/env node

import { run } from "../src/cli.js";

run(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nsiaphp gagal: ${message}`);

  if (process.env.SIAPHP_DEBUG && error instanceof Error && error.stack) {
    console.error(error.stack);
  }

  process.exitCode = 1;
});
