import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_TARGETS = ["bin/siaphp.js", "src"];

export async function collectJavaScriptFiles(rootDirectory) {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

export async function resolveSyntaxCheckFiles(targets, cwd = process.cwd()) {
  const resolvedFiles = [];

  for (const target of targets) {
    const fullPath = path.resolve(cwd, target);
    let targetStat;

    try {
      targetStat = await stat(fullPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`Target check tidak ditemukan: ${target}`);
      }
      throw error;
    }

    if (targetStat.isDirectory()) {
      resolvedFiles.push(...(await collectJavaScriptFiles(fullPath)));
      continue;
    }

    if (!targetStat.isFile() || !fullPath.endsWith(".js")) {
      throw new Error(`Target check harus berupa file .js atau folder: ${target}`);
    }

    resolvedFiles.push(fullPath);
  }

  return [...new Set(resolvedFiles)].sort();
}

export async function runSyntaxCheck(files) {
  for (const file of files) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--check", file], {
        stdio: "inherit"
      });

      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Syntax check gagal untuk ${file}`));
      });
    });
  }
}

export async function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const targets = argv.length > 0 ? argv : DEFAULT_TARGETS;
  const files = await resolveSyntaxCheckFiles(targets, cwd);
  await runSyntaxCheck(files);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
