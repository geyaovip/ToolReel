import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const source = join(".githooks", "prepare-commit-msg");
const target = join(".git", "hooks", "prepare-commit-msg");

if (!existsSync(".git") || !existsSync(source)) {
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
try {
  copyFileSync(source, target);
  chmodSync(target, 0o755);
  console.log(`Installed git hook: ${target}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Skipped git hook install: ${message}`);
}
