import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createArchive, formatBytes } from "../archive.js";
import { fileExists, loadProject } from "../config.js";
import { checkAgent, uploadDeployment } from "../http.js";
import { output } from "../output.js";

export async function deployCommand(options) {
  output.heading("\nsiaphp deploy");
  const { paths, config, credentials } = await loadProject();
  const entrypoint = path.join(paths.root, config.entrypoint);

  if (!(await fileExists(entrypoint))) {
    throw new Error(`Entrypoint tidak ditemukan: ${config.entrypoint}`);
  }

  validateTransport(config.agentUrl, options.allowHttp);

  let tempDirectory;
  let archivePath;

  if (options.dryRun) {
    tempDirectory = paths.state;
    archivePath = path.join(tempDirectory, "siaphp-dry-run.zip");
  } else {
    output.step("Memeriksa agent...");
    const status = await checkAgent(config.agentUrl, credentials.secret);
    if (!status.zipArchive || !status.targetWritable) {
      throw new Error('Agent belum siap. Jalankan "siaphp doctor" untuk detailnya.');
    }
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "siaphp-"));
    archivePath = path.join(tempDirectory, "release.zip");
  }

  try {
    output.step("Membuat archive proyek...");
    const archive = await createArchive({
      root: paths.root,
      destination: archivePath,
      exclude: config.exclude
    });

    if (archive.bytes === 0) {
      throw new Error("Archive kosong. Periksa konfigurasi exclude.");
    }

    output.success(`Archive siap: ${formatBytes(archive.bytes)}.`);

    if (options.dryRun) {
      output.success(`Dry run selesai: ${path.relative(paths.root, archivePath)}`);
      return;
    }

    output.step("Mengunggah dan memasang release...");
    const result = await uploadDeployment({
      agentUrl: config.agentUrl,
      secret: credentials.secret,
      archivePath
    });

    output.success(`Deploy ${result.release} selesai, ${result.deployedFiles} file terpasang.`);
  } finally {
    if (!options.dryRun && tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}

function validateTransport(value, allowHttp) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local && !allowHttp) {
    throw new Error("Deploy ke URL HTTP ditolak. Gunakan HTTPS atau --allow-http untuk lokal.");
  }
}
