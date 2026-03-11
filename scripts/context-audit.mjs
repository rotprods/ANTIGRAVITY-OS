import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const BOOTSTRAP_FILES = [
  "claude.md",
  "codex.md",
  "CONTEXT.md",
  "CURRENT_TRUTH.md",
  "HANDOFF.md",
  ".mcp.json",
];

const DEFAULT_CONTEXT_SIZE = 200_000;
const DEFAULT_OVERHEAD = {
  framework: 4_000,
  tools: 6_500,
  mcp: 1_000,
};

function estimateTokens(chars) {
  return chars > 0 ? Math.max(1, Math.round(chars / 4)) : 0;
}

function readChars(filePath) {
  return readFileSync(filePath, "utf8").length;
}

function formatInt(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

function statusForTokens(tokens) {
  if (tokens >= 5_000) return "heavy";
  if (tokens >= 2_000) return "medium";
  return "ok";
}

function healthForPercent(percent) {
  if (percent >= 20) return "critical";
  if (percent >= 12) return "warning";
  return "healthy";
}

function parseArgs(argv) {
  const options = { json: false, ctxSize: DEFAULT_CONTEXT_SIZE };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--ctx-size") {
      const next = Number(argv[i + 1]);
      if (!Number.isFinite(next) || next <= 0) {
        throw new Error("--ctx-size must be a positive number");
      }
      options.ctxSize = next;
      i += 1;
    }
  }
  return options;
}

function collectBootstrapFiles() {
  return BOOTSTRAP_FILES.map((relativePath) => {
    const absolutePath = path.join(projectRoot, relativePath);
    const exists = existsSync(absolutePath);
    const chars = exists ? readChars(absolutePath) : 0;
    const tokens = estimateTokens(chars);
    return {
      path: relativePath,
      exists,
      chars,
      tokens,
      status: exists ? statusForTokens(tokens) : "missing",
    };
  });
}

function collectSkillFiles() {
  const skillsRoot = path.join(projectRoot, ".claude", "skills");
  if (!existsSync(skillsRoot)) {
    return [];
  }

  const skillFiles = [];
  for (const namespace of readdirSync(skillsRoot)) {
    const namespacePath = path.join(skillsRoot, namespace);
    let entries = [];
    try {
      entries = readdirSync(namespacePath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const skillPath = path.join(namespacePath, entry, "SKILL.md");
      if (!existsSync(skillPath)) continue;
      const chars = readChars(skillPath);
      const tokens = estimateTokens(chars);
      skillFiles.push({
        namespace,
        name: entry,
        path: path.relative(projectRoot, skillPath),
        chars,
        tokens,
      });
    }
  }

  return skillFiles.sort((a, b) => b.tokens - a.tokens);
}

function collectGitNexusMeta() {
  const metaPath = path.join(projectRoot, ".gitnexus", "meta.json");
  if (!existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    const kuzuPath = path.join(projectRoot, ".gitnexus", "kuzu");
    const kuzuExists = existsSync(kuzuPath);
    const kuzuBytes = kuzuExists ? statSync(kuzuPath).size : 0;
    return {
      indexedAt: meta.indexedAt ?? null,
      lastCommit: meta.lastCommit ?? null,
      stats: meta.stats ?? null,
      kuzuBytes,
    };
  } catch {
    return { error: "Failed to parse .gitnexus/meta.json" };
  }
}

function buildReport(options) {
  const bootstrapFiles = collectBootstrapFiles();
  const skillFiles = collectSkillFiles();
  const gitnexus = collectGitNexusMeta();

  const bootstrapTokens = bootstrapFiles.reduce((sum, file) => sum + file.tokens, 0);
  const skillsTokens = skillFiles.reduce((sum, file) => sum + file.tokens, 0);
  const overheadTokens =
    DEFAULT_OVERHEAD.framework + DEFAULT_OVERHEAD.tools + DEFAULT_OVERHEAD.mcp;
  const loadedTokens = bootstrapTokens + overheadTokens;
  const freeTokens = Math.max(0, options.ctxSize - loadedTokens);
  const usedPercent = pct(loadedTokens, options.ctxSize);

  return {
    projectRoot,
    contextSize: options.ctxSize,
    health: healthForPercent(usedPercent),
    bootstrapFiles,
    skills: {
      count: skillFiles.length,
      totalTokens: skillsTokens,
      files: skillFiles,
    },
    budget: {
      bootstrapTokens,
      overheadTokens,
      loadedTokens,
      freeTokens,
      usedPercent,
    },
    gitnexus,
  };
}

function printText(report) {
  console.log("OCULOPS OS Context Audit");
  console.log("");
  console.log(`Project: ${report.projectRoot}`);
  console.log(`Context window: ${formatInt(report.contextSize)} tokens`);
  console.log(`Health: ${report.health}`);
  console.log("");
  console.log("Bootstrap files");
  for (const file of report.bootstrapFiles) {
    console.log(
      `- ${file.path}: ${file.status} | ${formatInt(file.chars)} chars | ${formatInt(file.tokens)} tok`,
    );
  }
  console.log("");
  console.log("Budget");
  console.log(`- Bootstrap: ${formatInt(report.budget.bootstrapTokens)} tok`);
  console.log(`- Framework/tooling overhead: ${formatInt(report.budget.overheadTokens)} tok`);
  console.log(`- Total loaded before conversation: ${formatInt(report.budget.loadedTokens)} tok`);
  console.log(`- Free for conversation: ${formatInt(report.budget.freeTokens)} tok`);
  console.log(`- Context used before conversation: ${report.budget.usedPercent.toFixed(1)}%`);
  console.log("");
  console.log("Local skills");
  console.log(`- Count: ${report.skills.count}`);
  console.log(`- Total skill tokens on disk: ${formatInt(report.skills.totalTokens)} tok`);
  for (const skill of report.skills.files.slice(0, 6)) {
    console.log(`- ${skill.path}: ${formatInt(skill.tokens)} tok`);
  }
  console.log("");
  console.log("GitNexus");
  if (!report.gitnexus) {
    console.log("- Not indexed");
  } else if (report.gitnexus.error) {
    console.log(`- ${report.gitnexus.error}`);
  } else {
    console.log(`- Indexed at: ${report.gitnexus.indexedAt ?? "unknown"}`);
    console.log(`- Commit: ${report.gitnexus.lastCommit ?? "unknown"}`);
    if (report.gitnexus.stats) {
      const clusters =
        report.gitnexus.stats.clusters ?? report.gitnexus.stats.communities ?? 0;
      console.log(
        `- Graph: ${formatInt(report.gitnexus.stats.nodes ?? 0)} nodes | ${formatInt(report.gitnexus.stats.edges ?? 0)} edges | ${formatInt(clusters)} clusters | ${formatInt(report.gitnexus.stats.processes ?? 0)} flows`,
      );
    }
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = buildReport(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printText(report);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
