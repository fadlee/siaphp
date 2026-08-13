import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { select } from "@inquirer/prompts";

const execFileAsync = promisify(execFile);

export const RELEASE_TYPES = ["patch", "minor", "major"];

export async function chooseReleaseType(prompt = select) {
  return prompt({
    message: "Choose release type:",
    choices: [
      { name: "Patch (bug fixes)", value: "patch" },
      { name: "Minor (backward-compatible features)", value: "minor" },
      { name: "Major (breaking changes)", value: "major" }
    ]
  });
}

export async function ensureClean(getStatus = getGitStatus) {
  const status = await getStatus();
  if (status.trim()) {
    throw new Error("Git working directory is not clean. Commit your changes before releasing.");
  }
}

async function getGitStatus() {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"]);
  return stdout;
}

export async function release() {
  await ensureClean();
  const type = await chooseReleaseType();
  await run("npm", ["version", type]);
  await run("npm", ["publish", "--access", "public"]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  release().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
