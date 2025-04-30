import { ChildProcess, spawn, exec } from "child_process";
import { Config, ProcessConfig, ReadyCheck } from "./config/schema.js";
import { LogStore } from "./logStore.js";
import EventEmitter from "events";
import { logger } from "./debug.js";

export enum ProcessState {
  PENDING = "PENDING", // Process is initialized but not started yet
  STARTING = "STARTING", // Process has been started but not ready
  HEALTHY = "HEALTHY", // Process is running and ready
  STOPPING = "STOPPING", // Process is being gracefully stopped
  STOPPED = "STOPPED", // Process is not running
  FAILED = "FAILED", // Process exited with error or health check failed
  RESTARTING = "RESTARTING", // Process is being restarted
}

export const colors = [
  "#FF0000",
  "#FFFF00",
  "#00FF00",
  "#0000FF",
  "#FF00FF",
  "#00FFFF",
];

export type CompleteProcessConfig = ProcessConfig & {
  color: string;
  state: ProcessState;
};

export const getStateColor = (state: string) => {
  if (state === ProcessState.HEALTHY) {
    return "green";
  } else if (state === ProcessState.FAILED) {
    return "red";
  } else {
    return "yellow";
  }
};

export class ProcessStore extends EventEmitter {
  private services: Record<string, CompleteProcessConfig>;
  private logStore: LogStore;
  private runningProcesses: Record<string, ChildProcess> = {};
  PROCESS_UPDATED_EVENT_NAME = "process-updated";

  constructor(config: Config, logStore: LogStore) {
    super();
    this.logStore = logStore;
    this.services = {};
    config.services.forEach((s, index) => {
      const color = s.color ?? colors[index % colors.length] ?? "white";
      this.services[s.name] = { ...s, color, state: ProcessState.PENDING };
    });
  }

  getProcesses(): CompleteProcessConfig[] {
    return Object.values(this.services);
  }

  getColor(serviceName: string) {
    return this.services[serviceName]?.color ?? "white";
  }

  async startAllProcesses() {
    for (const serviceName of Object.keys(this.services)) {
      const procConfig = this.services[serviceName]!;
      try {
        this.logStore.addSystemLog(`Starting ${procConfig.name}...`);
        this.startProcess(procConfig);
      } catch (err: any) {
        this.logStore.addSystemLog(
          `Failed to start ${procConfig.name}: ${err.message}`,
        );
      }
    }
  }

  async startProcess(procConfig: ProcessConfig): Promise<ChildProcess> {
    if (procConfig.dependsOn?.length) {
      this.logStore.addLog(
        procConfig.name,
        `Waiting for dependencies: ${procConfig.dependsOn.join(", ")}`,
      );
      await this.waitForDependencies(procConfig.name, procConfig.dependsOn);
      this.logStore.addLog(procConfig.name, "Dependencies are ready.");
    }

    this.updateProcessStatus(procConfig.name, ProcessState.STARTING);

    const proc = this.spawnProcess(procConfig, (data, isError) => {
      const lines = data.toString().split("\n");
      lines.forEach((line) => {
        logger("line", line, line.trim(), line.trimEnd());
        if (line.trim()) {
          this.logStore.addLog(
            procConfig.name,
            isError ? `ERROR: ${line.trimEnd()}` : line.trimEnd(),
          );
        }
      });
    });
    this.runningProcesses[procConfig.name] = proc;

    proc.on("close", (code: number | null, signal: string | null) => {
      logger("the process closed", procConfig.name);
      // Log exit with code and signal
      let msg = `exited with code ${code}`;
      if (signal) msg += ` and signal ${signal}`;
      this.logStore.addLog(procConfig.name, msg);
      // Clean up running process mapping
      delete this.runningProcesses[procConfig.name];
      // Only treat non-zero exit codes as failure; manual kills (signal) or zero codes are stopped
      const exitedWithError = code !== null && code !== 0;
      const finalState = exitedWithError
        ? ProcessState.FAILED
        : ProcessState.STOPPED;
      this.updateProcessStatus(procConfig.name, finalState);
    });

    if (procConfig.ready) {
      this.logStore.addLog(procConfig.name, "Performing ready check...");
      try {
        logger("waitForReadyCheck", procConfig.ready);
        await this.waitForReadyCheck(procConfig.ready as ReadyCheck);
        logger("we are ready", procConfig.name);
        this.logStore.addLog(procConfig.name, "Ready check passed.");
        logger("we are ready 2222", procConfig.name);
        this.updateProcessStatus(procConfig.name, ProcessState.HEALTHY);
      } catch (err: any) {
        this.logStore.addLog(
          procConfig.name,
          `Ready check failed: ${err.message}`,
        );
        logger("we are updating a process to stopped", procConfig.name);
        this.updateProcessStatus(procConfig.name, ProcessState.STOPPED);
      }
    } else {
      this.logStore.addLog(
        procConfig.name,
        "No ready check defined; marking as healthy.",
      );
      this.updateProcessStatus(procConfig.name, ProcessState.HEALTHY);
    }

    return proc;
  }

  async restartProcess(processName: string): Promise<void> {
    const procConfig = this.services[processName];
    if (!procConfig) {
      this.logStore.addSystemLog(`Configuration for ${processName} not found.`);
      return;
    }

    this.logStore.addSystemLog(`Restarting process ${processName}...`);
    const currentProc = this.runningProcesses[processName];
    // Indicate stopping if process is running
    if (currentProc && !currentProc.killed) {
      this.updateProcessStatus(processName, ProcessState.STOPPING);
      try {
        currentProc.kill();
      } catch (err) {
        console.error("Error killing process", processName, err);
      }
      // Wait for the process to close before restarting
      await new Promise<void>((resolve) =>
        currentProc.once("close", () => resolve()),
      );
    }
    // Now restart
    this.updateProcessStatus(processName, ProcessState.RESTARTING);
    try {
      await this.startProcess(procConfig);
    } catch (err: any) {
      this.logStore.addSystemLog(
        `Failed to restart ${processName}: ${err.message}`,
      );
    }
  }

  cleanup(): void {
    Object.values(this.runningProcesses).forEach((proc) => {
      try {
        if (!proc.killed) proc.kill();
      } catch {
        // ignore
      }
    });
  }

  private waitForDependencies(procName: string, deps: string[]): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const unreadyDeps = deps.filter(
          (dep) => this.services[dep]?.state !== ProcessState.HEALTHY,
        );
        if (unreadyDeps.length === 0) {
          clearInterval(interval);
          resolve();
        } else {
          this.logStore.addLog(
            procName,
            `Waiting for dependencies: ${unreadyDeps.join(", ")}`,
          );
        }
      }, 1000);
    });
  }

  private waitForReadyCheck(check: ReadyCheck): Promise<void> {
    return new Promise((resolve, reject) => {
      const intervalMs = check.interval || 1000;
      const timeoutMs = check.timeout || 5000;
      logger("timeout", timeoutMs);
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (Date.now() - startTime > timeoutMs) {
          logger("ITS OVER");
          clearInterval(interval);
          reject(new Error("Ready check timed out"));
          return;
        }
        exec(check.command, (error: Error | null) => {
          logger("ready check error", error);
          if (!error) {
            logger("we foooooood");
            clearInterval(interval);
            resolve();
          }
        });
      }, intervalMs);
    });
  }

  private spawnProcess(
    procConfig: ProcessConfig,
    onData: (data: Buffer, isError: boolean) => void,
  ): ChildProcess {
    const proc = spawn(procConfig.cmd, procConfig.args ?? [], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    proc.stdout.on("data", (data: Buffer) => onData(data, false));
    proc.stderr.on("data", (data: Buffer) => onData(data, true));

    this.emit(this.PROCESS_UPDATED_EVENT_NAME, procConfig.name, procConfig);

    return proc;
  }

  private updateProcessStatus(
    processName: string,
    newState: ProcessState,
  ): void {
    logger("We are updating a process", newState);
    const service = this.services[processName]!;
    const oldState = service.state;
    service.state = newState;
    if (oldState !== newState) {
      this.emit(this.PROCESS_UPDATED_EVENT_NAME, processName, newState);
    }
  }
}
