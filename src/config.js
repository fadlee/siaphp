import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_FILE,
  CREDENTIALS_FILE,
  DEFAULT_CHUNK_BYTES,
  DEFAULT_EXCLUDES,
  STATE_DIRECTORY
} from "./constants.js";

export function projectPaths(cwd = process.cwd()) {
  const root = path.resolve(cwd);

  return {
    root,
    config: path.join(root, CONFIG_FILE),
    state: path.join(root, STATE_DIRECTORY),
    credentials: path.join(root, CREDENTIALS_FILE)
  };
}

export function createConfig({ structure, agentUrl }) {
  if (!["flat", "public"].includes(structure)) {
    throw new Error(`Struktur proyek tidak didukung: ${structure}`);
  }

  return {
    schemaVersion: 1,
    agentUrl,
    structure,
    entrypoint: structure === "public" ? "public/index.php" : "index.php",
    chunkSize: DEFAULT_CHUNK_BYTES,
    exclude: [...DEFAULT_EXCLUDES]
  };
}

export async function writeProjectFiles(cwd, config, credentials) {
  const paths = projectPaths(cwd);
  await mkdir(paths.state, { recursive: true, mode: 0o700 });
  await writeJson(paths.config, config, 0o644);
  await writeJson(paths.credentials, credentials, 0o600);
}

export async function loadProject(cwd = process.cwd()) {
  const paths = projectPaths(cwd);
  const [config, credentials] = await Promise.all([
    readJson(paths.config, `Tidak menemukan ${CONFIG_FILE}. Jalankan "siaphp init" terlebih dahulu.`),
    readJson(
      paths.credentials,
      `Tidak menemukan ${CREDENTIALS_FILE}. Jalankan ulang "siaphp init".`
    )
  ]);

  validateConfig(config);
  validateCredentials(credentials);

  return { paths, config, credentials };
}

export async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export function validateConfig(config) {
  if (config?.schemaVersion !== 1) {
    throw new Error("Versi konfigurasi siaphp tidak didukung.");
  }
  if (!["flat", "public"].includes(config.structure)) {
    throw new Error("Nilai structure di siaphp.json harus flat atau public.");
  }
  if (typeof config.agentUrl !== "string" || !config.agentUrl) {
    throw new Error("agentUrl di siaphp.json belum diisi.");
  }
  if (config.chunkSize !== undefined && (!Number.isInteger(config.chunkSize) || config.chunkSize < 1)) {
    throw new Error("chunkSize di siaphp.json harus berupa bilangan positif.");
  }
  if (!Array.isArray(config.exclude)) {
    throw new Error("exclude di siaphp.json harus berupa array.");
  }
}

function validateCredentials(credentials) {
  if (credentials?.schemaVersion !== 1 || typeof credentials.secret !== "string") {
    throw new Error("Kredensial siaphp tidak valid. Jalankan ulang \"siaphp init\".");
  }
}

async function readJson(file, notFoundMessage) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(notFoundMessage);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`JSON tidak valid: ${path.basename(file)}`);
    }
    throw error;
  }
}

async function writeJson(file, value, mode) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await chmod(file, mode);
}
