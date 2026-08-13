import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createArchive, formatBytes } from "../archive.js";
import { fileExists, loadProject } from "../config.js";
import { checkAgent, uploadDeployment, uploadDeploymentInChunks } from "../http.js";
import { output } from "../output.js";

export async function deployCommand(options) {
  output.heading("\nsiaphp deploy");
  const { paths, config, credentials } = await loadProject();
  const entrypoint = path.join(paths.root, config.entrypoint);

  if (options.verbose) {
    output.info(`Project root: ${paths.root}`);
    output.info(`Entrypoint: ${config.entrypoint}`);
    output.info(`Agent: ${config.agentUrl}`);
  }

  if (!(await fileExists(entrypoint))) {
    throw new Error(`Entrypoint tidak ditemukan: ${config.entrypoint}`);
  }

  validateTransport(config.agentUrl, options.allowHttp);

  let tempDirectory;
  let archivePath;
  let status;

  if (options.dryRun) {
    tempDirectory = paths.state;
    archivePath = path.join(tempDirectory, "siaphp-dry-run.zip");
  } else {
    output.step("Memeriksa agent...");
    status = await checkAgent(config.agentUrl, credentials.secret);
    if (!status.zipArchive || !status.targetWritable) {
      throw new Error('Agent belum siap. Jalankan "siaphp doctor" untuk detailnya.');
    }
    if (options.verbose) {
      output.info(`Agent version: ${status.agentVersion}`);
      output.info(`PHP version: ${status.phpVersion}`);
      output.info(`Agent archive limit: ${formatBytes(status.maxUploadBytes)}`);
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

    if (!options.dryRun && archive.bytes > status.maxUploadBytes && !status.chunkUpload) {
      assertArchiveFitsAgent(archive, status);
    }
    output.success(`Archive siap: ${formatBytes(archive.bytes)}.`);
    if (options.verbose) {
      output.info(`Archive entries: ${archive.entries}`);
      output.info(`Archive path: ${archivePath}`);
    }

    if (options.dryRun) {
      output.success(`Dry run selesai: ${path.relative(paths.root, archivePath)}`);
      return;
    }

    const result =
      archive.bytes > status.maxUploadBytes
        ? await uploadDeploymentInChunks({
            agentUrl: config.agentUrl,
            secret: credentials.secret,
            archivePath,
            maxUploadBytes: status.maxUploadBytes,
            chunkSize: config.chunkSize,
            onProgress: ({ uploadedBytes, totalBytes, chunkIndex, totalChunks }) => {
              const percentage = Math.round((uploadedBytes / totalBytes) * 100);
              output.info(`Upload ${percentage}% (${chunkIndex + 1}/${totalChunks} chunk, ${formatBytes(uploadedBytes)}/${formatBytes(totalBytes)})`);
            }
          })
        : await uploadDeployment({
            agentUrl: config.agentUrl,
            secret: credentials.secret,
            archivePath
          });

    if (options.verbose) {
      output.info(`Release: ${result.release}`);
      output.info(`Files deployed: ${result.deployedFiles}`);
    }
    output.success(`Deploy ${result.release} selesai, ${result.deployedFiles} file terpasang.`);
  } finally {
    if (!options.dryRun && tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}

export function assertArchiveFitsAgent(archive, status) {
  if (archive.bytes > status.maxUploadBytes) {
    throw new Error(
      `Archive terlalu besar: ${formatBytes(archive.bytes)}. Batas agent: ${formatBytes(status.maxUploadBytes)}. Periksa konfigurasi exclude dan upload_max_filesize/post_max_size di hosting.`
    );
  }
}

function validateTransport(value, allowHttp) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local && !allowHttp) {
    throw new Error("Deploy ke URL HTTP ditolak. Gunakan HTTPS atau --allow-http untuk lokal.");
  }
}
