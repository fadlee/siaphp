import { createRequire } from "node:module";

const packageJson = createRequire(import.meta.url)("../package.json");

export const PACKAGE_NAME = packageJson.name;
export const PACKAGE_VERSION = packageJson.version;
export const CONFIG_FILE = "siaphp.json";
export const STATE_DIRECTORY = ".siaphp";
export const CREDENTIALS_FILE = ".siaphp/credentials.json";
export const AGENT_FILE = ".siaphp/siaphp-agent.php";
export const IGNORE_FILE = ".siaphpignore";
export const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

export const DEFAULT_EXCLUDES = [
  ".git",
  ".git/**",
  ".siaphp",
  ".siaphp/**",
  ".env",
  ".env.*",
  "node_modules",
  "node_modules/**",
  "siaphp.json"
];
