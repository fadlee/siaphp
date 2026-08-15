import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { CONFIG_FILE, CREDENTIALS_FILE, STATE_DIRECTORY } from "../constants.js";
import { createConfig, fileExists, projectPaths, writeProjectFiles } from "../config.js";
import { writeIgnoreFile } from "../ignore.js";
import { generateAgentFilename, generateSecret } from "../crypto.js";
import { writeAgent } from "../agent.js";
import { checkAgent } from "../http.js";
import { output } from "../output.js";

export async function initCommand(options) {
  const cwd = process.cwd();
  const paths = projectPaths(cwd);
  output.heading("\nsiaphp init");

  if (await fileExists(paths.config)) {
    const overwrite =
      options.yes ||
      (await confirm({
        message: `${CONFIG_FILE} sudah ada. Buat ulang konfigurasi dan agent?`,
        default: false
      }));

    if (!overwrite) {
      output.info("Init dibatalkan.");
      return;
    }
  }

  const structure = await resolveStructure(cwd, options);
  const secret = generateSecret();
  const agentFilename = generateAgentFilename();
  const agentPath = path.join(cwd, STATE_DIRECTORY, agentFilename);
  const agentRelativePath = path.join(STATE_DIRECTORY, agentFilename);

  await mkdir(paths.state, { recursive: true, mode: 0o700 });
  await writeAgent(agentPath, { secret, structure });

  output.success(`Agent dibuat di ${agentRelativePath}`);
  output.info(agentInstruction(structure, agentFilename));

  const baseUrl = await resolveBaseUrl(options);
  validateBaseUrl(baseUrl, options.allowHttp);
  const agentUrl = buildAgentUrl(baseUrl, agentFilename);

  const config = createConfig({ structure, agentUrl });
  const credentials = { schemaVersion: 1, secret };
  await writeProjectFiles(cwd, config, credentials);
  await writeIgnoreFile(cwd);
  await ensureGitignore(cwd);

  output.success(`${CONFIG_FILE}, ${CREDENTIALS_FILE}, dan .siaphpignore sudah dibuat.`);

  if (!options.skipCheck) {
    output.step("Menghubungi agent...");
    try {
      const status = await checkAgent(agentUrl, secret);
      output.success(`Agent terhubung, PHP ${status.phpVersion}.`);
    } catch (error) {
      output.warning("Konfigurasi sudah disimpan, tetapi agent belum dapat diverifikasi.");
      throw error;
    }
  }

  output.success('Siap. Jalankan "npx siaphp doctor", lalu "npx siaphp deploy".');
}

async function resolveStructure(cwd, options) {
  if (options.structure) {
    if (!["flat", "public"].includes(options.structure)) {
      throw new Error("--structure harus bernilai flat atau public.");
    }
    return options.structure;
  }

  const detected = (await fileExists(path.join(cwd, "public/index.php"))) ? "public" : "flat";
  if (options.yes) return detected;

  return select({
    message: "Struktur entrypoint proyek:",
    default: detected,
    choices: [
      { name: "Flat (index.php di root)", value: "flat" },
      { name: "Public folder (public/index.php)", value: "public" }
    ]
  });
}

async function resolveBaseUrl(options) {
  if (options.baseUrl) return normalizeBaseUrl(options.baseUrl);
  if (options.yes) {
    throw new Error("--base-url wajib diisi ketika menggunakan --yes.");
  }

  const value = await input({
    message: "Base URL hosting (domain atau subfolder tempat agent di-upload):",
    validate: (url) => {
      try {
        normalizeBaseUrl(url);
        return true;
      } catch (error) {
        return error.message;
      }
    }
  });

  return normalizeBaseUrl(value);
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Base URL tidak valid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Base URL harus menggunakan HTTP atau HTTPS.");
  }
  url.hash = "";
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}

function validateBaseUrl(value, allowHttp) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local && !allowHttp) {
    throw new Error("Gunakan URL HTTPS untuk melindungi secret dan kode saat deploy.");
  }
}

function buildAgentUrl(baseUrl, filename) {
  const separator = baseUrl.endsWith("/") ? "" : "/";
  return `${baseUrl}${separator}${filename}`;
}

function agentInstruction(structure, agentFilename) {
  if (structure === "public") {
    return `Upload ${agentFilename} ke document root public, misalnya public/${agentFilename}.`;
  }
  return `Upload ${agentFilename} ke folder yang sama dengan index.php.`;
}

async function ensureGitignore(cwd) {
  const file = path.join(cwd, ".gitignore");
  let contents = "";
  try {
    contents = await readFile(file, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const lines = new Set(contents.split(/\r?\n/));
  const missing = [".siaphp/"].filter((line) => !lines.has(line));
  if (missing.length) {
    const prefix = contents && !contents.endsWith("\n") ? "\n" : "";
    await appendFile(file, `${prefix}${missing.join("\n")}\n`);
  }
}
