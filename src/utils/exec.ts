import { execFile } from "node:child_process";

type RunCommandOptions = {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        const details = [stdout, stderr].filter(Boolean).join("\n");
        reject(new Error(`${command} failed: ${details || error.message}`));
        return;
      }
      resolve();
    });
  });
}

export function runCommandCapture(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      const exitCode =
        typeof error === "object" && error && "code" in error && typeof error.code === "number"
          ? error.code
          : 0;

      if (error && exitCode === 0) {
        reject(error);
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode,
      });
    });
  });
}
