import { spawn, ChildProcess } from "child_process";
import { ProcessConfig } from "../config/schema";

// Launch a process and set up stdout/stderr handlers
export function launchProcess(
  procConfig: ProcessConfig,
  onData: (data: Buffer, isError: boolean) => void,
): ChildProcess {
  const proc = spawn(procConfig.cmd, procConfig.args ?? [], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  proc.stdout.on("data", (data: Buffer) => {
    onData(data, false);
  });

  proc.stderr.on("data", (data: Buffer) => {
    onData(data, true);
  });

  return proc;
}
