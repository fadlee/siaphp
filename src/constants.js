export const PACKAGE_NAME = "siaphp";
export const PACKAGE_VERSION = "0.1.0";
export const CONFIG_FILE = "siaphp.json";
export const STATE_DIRECTORY = ".siaphp";
export const CREDENTIALS_FILE = ".siaphp/credentials.json";
export const AGENT_FILE = ".siaphp/siaphp-agent.php";
export const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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
