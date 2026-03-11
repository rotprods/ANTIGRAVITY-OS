import { spawn } from "node:child_process";

const args = process.argv.slice(2);

const child = spawn("gws", args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(
      [
        "Google Workspace CLI not found.",
        "Install it with:",
        "  npm install -g @googleworkspace/cli",
      ].join("\n"),
    );
    process.exit(1);
  }
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
