import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { AGENT_FILE, CONFIG_FILE, CREDENTIALS_FILE } from "../constants.js";
import { createConfig, fileExists, projectPaths, writeProjectFiles } from "../config.js";
import { writeIgnoreFile } from "../ignore.js";
import { generateSecret } from "../crypto.js";
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
  await mkdir(paths.state, { recursive: true, mode: 0o700 });
  const agentPath = path.join(cwd, AGENT_FILE);
  await writeAgent(agentPath, { secret, structure });

  output.success(`Agent dibuat di ${AGENT_FILE}`);
  output.info(agentInstruction(structure));

  const agentUrl = await resolveAgentUrl(options);
  validateAgentUrl(agentUrl, options.allowHttp);

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

async function resolveAgentUrl(options) {
  if (options.agentUrl) return normalizeUrl(options.agentUrl);
  if (options.yes) {
    throw new Error("--agent-url wajib diisi ketika menggunakan --yes.");
  }

  const value = await input({
    message: "URL agent yang sudah di-upload:",
    validate: (url) => {
      try {
        normalizeUrl(url);
        return true;
      } catch (error) {
        return error.message;
      }
    }
  });

  return normalizeUrl(value);
}

function normalizeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL agent tidak valid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL agent harus menggunakan HTTP atau HTTPS.");
  }
  url.hash = "";
  return url.toString();
}

function validateAgentUrl(value, allowHttp) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local && !allowHttp) {
    throw new Error("Gunakan URL HTTPS untuk melindungi secret dan kode saat deploy.");
  }
}

function agentInstruction(structure) {
  if (structure === "public") {
    return `Upload ${AGENT_FILE} ke document root public, misalnya public/siaphp-agent.php.`;
  }
  return `Upload ${AGENT_FILE} ke folder yang sama dengan index.php.`;
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
