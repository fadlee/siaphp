import path from "node:path";
import { fileExists, loadProject } from "../config.js";
import { checkAgent } from "../http.js";
import { formatBytes } from "../archive.js";
import { output } from "../output.js";

export async function doctorCommand(options) {
  output.heading("\nsiaphp doctor");
  const { paths, config, credentials } = await loadProject();
  let failed = false;

  if (await fileExists(path.join(paths.root, config.entrypoint))) {
    output.success(`Entrypoint ditemukan: ${config.entrypoint}`);
  } else {
    output.warning(`Entrypoint tidak ditemukan: ${config.entrypoint}`);
    failed = true;
  }

  const url = new URL(config.agentUrl);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol === "https:") {
    output.success("Agent menggunakan HTTPS.");
  } else if (local || options.allowHttp) {
    output.warning("Agent menggunakan HTTP. Gunakan hanya untuk pengembangan lokal.");
  } else {
    output.warning("Agent harus menggunakan HTTPS.");
    failed = true;
  }

  let status;
  try {
    status = await checkAgent(config.agentUrl, credentials.secret);
    output.success(`Agent v${status.agentVersion} merespons dengan PHP ${status.phpVersion}.`);
  } catch (error) {
    output.warning(error.message);
    failed = true;
  }

  if (status) {
    if (status.zipArchive) {
      output.success("Ekstensi PHP ZipArchive tersedia.");
    } else {
      output.warning("Ekstensi PHP ZipArchive belum tersedia.");
      failed = true;
    }

    if (status.targetWritable) {
      output.success("Folder target dapat ditulis oleh PHP.");
    } else {
      output.warning("Folder target tidak dapat ditulis oleh PHP.");
      failed = true;
    }

    output.info(`Batas archive agent: ${formatBytes(status.maxUploadBytes)}.`);
  }

  if (failed) {
    throw new Error("Pemeriksaan menemukan masalah yang perlu diperbaiki.");
  }

  output.success("Semua pemeriksaan lolos.");
}
