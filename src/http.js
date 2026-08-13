import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createSignedHeaders, sha256 } from "./crypto.js";

export async function checkAgent(agentUrl, secret) {
  return requestJson(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...createSignedHeaders(secret, "doctor")
    },
    body: JSON.stringify({ action: "doctor" })
  });
}

export async function uploadDeployment({ agentUrl, secret, archivePath }) {
  const archive = await readFile(archivePath);
  const archiveHash = sha256(archive);
  const form = new FormData();
  form.set("action", "deploy");
  form.set("archiveHash", archiveHash);
  form.set("archive", new Blob([archive], { type: "application/zip" }), "release.zip");

  return requestJson(agentUrl, {
    method: "POST",
    headers: createSignedHeaders(secret, "deploy", archiveHash),
    body: form
  });
}

export async function uploadDeploymentInChunks({
  agentUrl,
  secret,
  archivePath,
  maxUploadBytes,
  chunkSize = Math.min(8 * 1024 * 1024, Math.max(1, maxUploadBytes - 1024 * 1024)),
  onProgress = () => {}
}) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize >= maxUploadBytes) {
    throw new Error("Ukuran chunk harus berupa bilangan positif dan lebih kecil dari batas agent.");
  }
  const archive = await readFile(archivePath);
  const archiveHash = sha256(archive);
  const uploadId = randomUUID();
  const totalChunks = Math.ceil(archive.length / chunkSize);
  const context = `${uploadId}\n${archiveHash}\n${archive.length}\n${totalChunks}`;

  await requestJson(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...createSignedHeaders(secret, "chunk-init", archiveHash, context)
    },
    body: JSON.stringify({
      action: "chunk-init",
      uploadId,
      archiveHash,
      totalBytes: archive.length,
      totalChunks
    })
  });

  for (let index = 0; index < totalChunks; index += 1) {
    const chunk = archive.subarray(index * chunkSize, Math.min((index + 1) * chunkSize, archive.length));
    const chunkHash = sha256(chunk);
    const form = new FormData();
    form.set("action", "chunk-upload");
    form.set("uploadId", uploadId);
    form.set("archiveHash", archiveHash);
    form.set("chunkIndex", String(index));
    form.set("totalChunks", String(totalChunks));
    form.set("chunkHash", chunkHash);
    form.set("chunk", new Blob([chunk], { type: "application/octet-stream" }), `chunk-${index}`);
    await requestJson(agentUrl, {
      method: "POST",
      headers: createSignedHeaders(
        secret,
        "chunk-upload",
        chunkHash,
        `${uploadId}\n${archiveHash}\n${index}\n${totalChunks}`
      ),
      body: form
    });
    onProgress({
      uploadedBytes: Math.min((index + 1) * chunkSize, archive.length),
      totalBytes: archive.length,
      chunkIndex: index,
      totalChunks
    });
  }

  return requestJson(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...createSignedHeaders(secret, "chunk-finalize", archiveHash, context)
    },
    body: JSON.stringify({
      action: "chunk-finalize",
      uploadId,
      archiveHash,
      totalBytes: archive.length,
      totalChunks
    })
  });
}

async function requestJson(url, options) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(120_000)
    });
  } catch (error) {
    throw new Error(`Tidak dapat menghubungi agent: ${error.message}`);
  }

  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    if (response.status === 413) {
      throw new Error(
        "Upload ditolak (HTTP 413): archive terlalu besar. Periksa upload_max_filesize dan post_max_size di hosting."
      );
    }
    throw new Error(
      `Agent mengembalikan respons non-JSON (HTTP ${response.status}). Periksa URL dan log PHP.`
    );
  }

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Agent gagal dengan HTTP ${response.status}.`);
  }

  return payload;
}
