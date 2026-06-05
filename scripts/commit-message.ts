import { execFileSync } from "node:child_process";

type Change = {
  status: string;
  path: string;
};

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function readChanges(): Change[] {
  const staged = git(["diff", "--cached", "--name-status"]);
  const source = staged || git(["diff", "--name-status"]);

  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split(/\s+/);
      return {
        status,
        path: pathParts[pathParts.length - 1],
      };
    });
}

function typeFor(changes: Change[]): string {
  if (changes.every((change) => change.path.startsWith("docs/") || change.path === "README.md")) {
    return "docs";
  }

  if (
    changes.some((change) =>
      ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".gitignore"].includes(change.path),
    )
  ) {
    return changes.some((change) => change.path.startsWith("src/")) ? "feat" : "chore";
  }

  return changes.some((change) => change.status.startsWith("A")) ? "feat" : "fix";
}

function scopeFor(changes: Change[]): string {
  if (changes.some((change) => change.path.includes("/renderers/remotion/"))) return "remotion";
  if (changes.some((change) => change.path.includes("/quality/"))) return "quality";
  if (changes.some((change) => change.path.includes("/pipeline/"))) return "pipeline";
  if (changes.some((change) => change.path.startsWith("docs/"))) return "docs";
  return "toolreel";
}

function summaryFor(changes: Change[]): string {
  if (changes.some((change) => change.path.includes("/renderers/remotion/"))) {
    return "add real Remotion scene rendering";
  }

  if (changes.some((change) => change.path.includes("/quality/"))) {
    return "add output quality validation";
  }

  if (changes.every((change) => change.path.startsWith("docs/") || change.path === "README.md")) {
    return "update project documentation";
  }

  return "update MVP pipeline";
}

const changes = readChanges();

if (changes.length === 0) {
  console.log("chore: no local changes");
} else {
  console.log(`${typeFor(changes)}(${scopeFor(changes)}): ${summaryFor(changes)}`);
}

