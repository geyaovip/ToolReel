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

