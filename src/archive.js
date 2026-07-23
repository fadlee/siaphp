import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import { ZipFile } from "yazl";

export async function createArchive({ root, destination, exclude }) {
  await mkdir(path.dirname(destination), { recursive: true });

  const entries = (
    await fastGlob("**/*", {
      cwd: root,
      dot: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      ignore: exclude
    })
  ).sort();

  if (entries.length === 0) {
    throw new Error("Tidak ada file yang dapat dimasukkan ke archive.");
  }

  const output = createWriteStream(destination, { mode: 0o600 });
  const archive = new ZipFile();

  const completed = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.outputStream.on("error", reject);
  });

  archive.outputStream.pipe(output);
  for (const entry of entries) {
    archive.addFile(path.join(root, entry), entry);
  }

  archive.end();
  await completed;

  const details = await stat(destination);
  return { bytes: details.size, entries: entries.length };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
