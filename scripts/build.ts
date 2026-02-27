import { join } from "path";
import { execSync } from "child_process";
import { chmodSync, existsSync, mkdirSync } from "fs";

const ROOT = join(import.meta.dir, "..");

console.log("Building ohaninio-manager...\n");

// Step 1: Build frontend with Vite
console.log("[1/3] Building frontend...");
execSync("bunx --bun vite build --outDir ../dist/web", {
  cwd: join(ROOT, "web"),
  stdio: "inherit",
});

// Step 2: Build CLI entry point
console.log("\n[2/3] Building CLI...");
const cliResult = await Bun.build({
  entrypoints: [join(ROOT, "src", "cli.ts")],
  outdir: join(ROOT, "dist"),
  target: "bun",
  format: "esm",
});
if (!cliResult.success) {
  console.error("CLI build failed:", cliResult.logs);
  process.exit(1);
}

// Ensure shebang and executable permissions
const cliPath = join(ROOT, "dist", "cli.js");
const cliContent = await Bun.file(cliPath).text();
if (!cliContent.startsWith("#!/")) {
  await Bun.write(cliPath, `#!/usr/bin/env bun\n${cliContent}`);
}
chmodSync(cliPath, 0o755);

// Step 3: Build server
console.log("[3/3] Building server...");
const serverResult = await Bun.build({
  entrypoints: [join(ROOT, "src", "server.ts")],
  outdir: join(ROOT, "dist"),
  target: "bun",
  format: "esm",
});
if (!serverResult.success) {
  console.error("Server build failed:", serverResult.logs);
  process.exit(1);
}

console.log("\nBuild complete! Files in dist/:");
console.log("  dist/cli.js     (CLI entry point)");
console.log("  dist/server.js  (Server)");
console.log("  dist/web/       (Frontend assets)");
