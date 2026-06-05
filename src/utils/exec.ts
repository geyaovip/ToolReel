import { execFile } from "node:child_process";

export function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
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
