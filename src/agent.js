import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MAX_UPLOAD_BYTES } from "./constants.js";

const templatePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
  "siaphp-agent.php.tpl"
);

export async function renderAgent({ secret, structure }) {
  const template = await readFile(templatePath, "utf8");
  const targetExpression = structure === "public" ? "dirname(__DIR__)" : "__DIR__";

  return template
    .replaceAll("__SIAPHP_SECRET__", secret)
    .replaceAll("__SIAPHP_TARGET_ROOT__", targetExpression)
    .replaceAll("__SIAPHP_MAX_UPLOAD_BYTES__", String(DEFAULT_MAX_UPLOAD_BYTES));
}

export async function writeAgent(file, options) {
  const contents = await renderAgent(options);
  await writeFile(file, contents, { mode: 0o600 });
  await chmod(file, 0o600);
}
