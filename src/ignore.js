import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_EXCLUDES, IGNORE_FILE } from "./constants.js";

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function resolveProjectExcludes(configExclude, root) {
  const ignorePatterns = await loadIgnoreFile(root);
  return [...new Set([...DEFAULT_EXCLUDES, ...configExclude, ...ignorePatterns])];
}

export async function loadIgnoreFile(root) {
  const file = path.join(root, IGNORE_FILE);
  if (!(await fileExists(file))) {
    return [];
  }

  const contents = await readFile(file, "utf8");
  return parseIgnore(contents);
}

export function parseIgnore(contents) {
  const patterns = [];

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    patterns.push(line);
  }

  return patterns;
}

export async function writeIgnoreFile(root) {
  const file = path.join(root, IGNORE_FILE);
  if (await fileExists(file)) {
    return;
  }

  const sample = `# File ini menambahkan pola exclusion di atas default siaphp.
# Default yang sudah selalu dikecualikan: .git, .siaphp, .env, node_modules, siaphp.json

# Contoh:
# *.log
# tests/
# .github/
`;

  await writeFile(file, sample);
}
