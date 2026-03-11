import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const REQUIRED_PATHS = [
  "claude.md",
  "codex.md",
  "CONTEXT.md",
  "CURRENT_TRUTH.md",
  "HANDOFF.md",
  ".mcp.json",
  "scripts/gitnexus.mjs",
  "scripts/context-audit.mjs",
  "scripts/gws.mjs",
];

const FORBIDDEN_ROOT_FILES = ["CLAUDE.md", "AGENTS.md"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

for (const relativePath of REQUIRED_PATHS) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing protected file: ${relativePath}`);
  }
}

const rootEntries = new Set(readdirSync(projectRoot));
for (const forbidden of FORBIDDEN_ROOT_FILES) {
  if (rootEntries.has(forbidden)) {
    fail(`Forbidden generated root file detected: ${forbidden}`);
  }
}

const gitStatus = spawnSync("git", ["status", "--short"], {
  cwd: projectRoot,
  encoding: "utf8",
});

if (gitStatus.status !== 0) {
  fail(gitStatus.stderr || "Failed to read git status");
}

const deletedLines = gitStatus.stdout
  .split("\n")
  .map((line) => line.trimEnd())
  .filter((line) => line.startsWith("D ") || line.startsWith("D") || line.includes(" D "));

if (deletedLines.length > 0) {
  fail(`Deleted files detected in git status:\n${deletedLines.join("\n")}`);
}

console.log("Protected file check passed");
