import { checkMvpReadiness } from "../src/quality/checkMvpReadiness.ts";

const outputDir = process.argv[2];

if (!outputDir) {
  console.error("Usage: pnpm mvp:check outputs/YYYY-MM-DD-tool");
  process.exit(1);
}

const readiness = await checkMvpReadiness(outputDir);
console.log(`MVP readiness: ${readiness.ready ? "ready" : "not ready"}`);
console.log(`${outputDir}/mvp-readiness.json`);

if (!readiness.ready) {
  for (const check of readiness.checks.filter((item) => !item.passed)) {
    console.log(`- ${check.name}: expected ${check.expected}, actual ${check.actual}`);
  }
  process.exit(1);
}
