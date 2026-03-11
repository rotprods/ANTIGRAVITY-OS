import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const gitnexusCli = path.resolve(
  projectRoot,
  "../github-repos/GitNexus/gitnexus/dist/cli/index.js",
);
const args = process.argv.slice(2);

function findActualName(dir, expectedLower) {
  return readdirSync(dir).find((entry) => entry.toLowerCase() === expectedLower);
}

function captureFileState(dir, expectedLower) {
  const actualName = findActualName(dir, expectedLower);
  if (!actualName) return null;
  const filePath = path.join(dir, actualName);
  return {
    actualName,
    content: readFileSync(filePath),
  };
}

function restoreFileState(dir, expectedName, previousState) {
  const currentName = findActualName(dir, expectedName.toLowerCase());
  if (previousState) {
    writeFileSync(path.join(dir, previousState.actualName), previousState.content);
    if (currentName && currentName !== previousState.actualName) {
      rmSync(path.join(dir, currentName), { force: true });
    }
    return;
  }
  if (currentName) {
    rmSync(path.join(dir, currentName), { force: true });
  }
}

function compareFileState(dir, expectedLower, previousState) {
  const currentName = findActualName(dir, expectedLower);
  if (!previousState) {
    return currentName ? `Unexpected file created: ${currentName}` : null;
  }
  if (!currentName) {
    return `Protected file missing after analyze: ${previousState.actualName}`;
  }
  const currentContent = readFileSync(path.join(dir, currentName));
  if (currentName !== previousState.actualName) {
    return `Protected file casing changed: expected ${previousState.actualName}, got ${currentName}`;
  }
  if (!currentContent.equals(previousState.content)) {
    return `Protected file content changed unexpectedly: ${currentName}`;
  }
  return null;
}

function resolveAnalyzeTarget(cliArgs) {
  const candidate = cliArgs[1];
  if (!candidate || candidate.startsWith("-")) {
    return projectRoot;
  }
  return path.resolve(projectRoot, candidate);
}

if (!existsSync(gitnexusCli)) {
  console.error(
    [
      "GitNexus CLI not built.",
      "Run:",
      "  cd ../github-repos/GitNexus/gitnexus && npm install",
      "or from this project:",
      "  npm run gitnexus:build",
    ].join("\n"),
  );
  process.exit(1);
}

let cleanup = null;
let verify = null;

if (args[0] === "analyze") {
  const analyzeTarget = resolveAnalyzeTarget(args);
  const claudeState = captureFileState(analyzeTarget, "claude.md");
  const agentsState = captureFileState(analyzeTarget, "agents.md");
  cleanup = () => {
    restoreFileState(analyzeTarget, "CLAUDE.md", claudeState);
    restoreFileState(analyzeTarget, "AGENTS.md", agentsState);
  };
  verify = () => {
    const issues = [
      compareFileState(analyzeTarget, "claude.md", claudeState),
      compareFileState(analyzeTarget, "agents.md", agentsState),
    ].filter(Boolean);
    if (issues.length > 0) {
      console.error(issues.join("\n"));
      process.exit(1);
    }
  };
}

const child = spawn(process.execPath, [gitnexusCli, ...args], {
  cwd: projectRoot,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (cleanup) {
    cleanup();
  }
  if (verify) {
    verify();
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
