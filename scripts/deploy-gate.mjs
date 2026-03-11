import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function run(command, args, label) {
  console.log(`\n[gate] ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`\n[gate] failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("node", ["scripts/protected-files-check.mjs"], "protected files");

console.log("\n[gate] context audit");
const contextAudit = spawnSync("node", ["scripts/context-audit.mjs", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: "pipe",
});
if (contextAudit.stderr) process.stderr.write(contextAudit.stderr);
if (contextAudit.status !== 0) {
  process.stdout.write(contextAudit.stdout || "");
  console.error("\n[gate] failed: context audit");
  process.exit(contextAudit.status ?? 1);
}
const audit = JSON.parse(contextAudit.stdout);
const usedPercent = audit?.budget?.usedPercent ?? 0;
console.log(`Context used before conversation: ${usedPercent.toFixed(1)}%`);
if (usedPercent > 12) {
  console.error("[gate] failed: context usage is above 12%");
  process.exit(1);
}

console.log("\n[gate] gitnexus status");
const meta = JSON.parse(readFileSync(path.join(projectRoot, ".gitnexus", "meta.json"), "utf8"));
const currentCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: projectRoot,
  encoding: "utf8",
});
if (currentCommit.status !== 0) {
  process.stderr.write(currentCommit.stderr || "");
  process.exit(currentCommit.status ?? 1);
}
const head = currentCommit.stdout.trim();
console.log(`Indexed commit: ${meta.lastCommit}`);
console.log(`Current commit: ${head}`);
if (meta.lastCommit !== head) {
  console.error("[gate] failed: GitNexus index is stale");
  process.exit(1);
}

run("npm", ["run", "build"], "build");
run("npm", ["run", "lint"], "lint");
run("npm", ["test"], "test");
run("git", ["status", "--short"], "git status");

console.log("\n[gate] all checks passed");
