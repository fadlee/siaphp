import { readFile } from "node:fs/promises";
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
    throw new Error(
      `Agent mengembalikan respons non-JSON (HTTP ${response.status}). Periksa URL dan log PHP.`
    );
  }

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Agent gagal dengan HTTP ${response.status}.`);
  }

  return payload;
}
