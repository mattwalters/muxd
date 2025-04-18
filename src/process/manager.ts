import { ChildProcess, spawn, exec } from "child_process";
import { Config, ProcessConfig, ReadyCheck } from "../config/schema";
import { LogStore } from "../log/store";
import EventEmitter from "events";
import { ProcessState } from "../types";
import * as http from "http";
import * as https from "https";

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

export class ProcessManager extends EventEmitter {
  private config: Config;
  private services: CompleteProcessConfig[];
  private logStore: LogStore;
  private runningProcesses: Record<string, ChildProcess> = {};
  private processStatus: Record<string, ProcessState> = {};
  private serviceFlags: Record<string, { mute: boolean; solo: boolean }> = {};
  private serviceColors: Record<string, string> = {};
  STATUS_CHANGE_EVENT_NAME = "status-change";

  constructor(config: Config, logStore: LogStore) {
    super();
    this.config = config;
    this.logStore = logStore;
    this.services = config.services.map((s, index) => {
      const color = s.color ?? colors[index % colors.length];
      this.serviceColors[s.name] = color;
      this.serviceFlags[s.name] = { mute: false, solo: false };
      this.processStatus[s.name] = ProcessState.PENDING;
      return { ...s, color, state: ProcessState.PENDING };
    });
  }

  forEachService(callback: (p: CompleteProcessConfig) => void) {
    this.services.forEach(callback);
  }

  getColor(serviceName: string) {
    return this.serviceColors[serviceName];
  }

  getServiceFlags(serviceName: string) {
    return this.serviceFlags[serviceName] || { mute: false, solo: false };
  }

  toggleMute(serviceName: string): boolean {
    if (!this.serviceFlags[serviceName]) return false;
    this.serviceFlags[serviceName].mute = !this.serviceFlags[serviceName].mute;
    this.logStore.addSystemLog(
      `${serviceName} is now ${this.serviceFlags[serviceName].mute ? "muted" : "unmuted"}.`,
    );
    return true;
  }

  toggleSolo(serviceName: string): boolean {
    if (!this.serviceFlags[serviceName]) return false;
    this.serviceFlags[serviceName].solo = !this.serviceFlags[serviceName].solo;
    this.logStore.addSystemLog(
      `${serviceName} is now ${this.serviceFlags[serviceName].solo ? "solo" : "unsolo"}.`,
    );
    return true;
  }

  async startAllProcesses() {
    for (const procConfig of this.services) {
      this.logStore.addLog(procConfig.name, "Starting process...");
      try {
        await this.startProcess(procConfig);
      } catch (err: any) {
        this.logStore.addLog(
          procConfig.name,
          `Failed to start: ${err.message}`,
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
      await this.waitForDependencies(procConfig.dependsOn);
      this.logStore.addLog(procConfig.name, "Dependencies are ready.");
    }

    // Mark as STARTING
    this.updateProcessStatus(procConfig.name, ProcessState.STARTING);

    const proc = this.spawnProcess(procConfig, (data, isError) => {
      const lines = data.toString().split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          this.logStore.addLog(
            procConfig.name,
            isError ? `ERROR: ${line.trimEnd()}` : line.trimEnd(),
          );
        }
      });
    });

    this.runningProcesses[procConfig.name] = proc;

    proc.on("close", (code) => {
      this.logStore.addLog(procConfig.name, `exited with code ${code}`);
      delete this.runningProcesses[procConfig.name];
      const newState = code === 0 ? ProcessState.STOPPED : ProcessState.FAILED;
      this.updateProcessStatus(procConfig.name, newState);
    });

    if (procConfig.ready) {
      this.logStore.addLog(procConfig.name, "Performing ready check...");
      try {
        await this.waitForReadyCheck(procConfig.ready as ReadyCheck);
        this.logStore.addLog(procConfig.name, "Ready check passed.");
        this.updateProcessStatus(procConfig.name, ProcessState.HEALTHY);
      } catch (err: any) {
        this.logStore.addLog(
          procConfig.name,
          `Ready check failed: ${err.message}`,
        );
        this.updateProcessStatus(procConfig.name, ProcessState.FAILED);
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
    const procConfig = this.services.find((p) => p.name === processName);
    if (!procConfig) {
      this.logStore.addSystemLog(`Configuration for ${processName} not found.`);
      return;
    }

    this.logStore.addSystemLog(`Restarting process ${processName}...`);
    this.updateProcessStatus(processName, ProcessState.RESTARTING);

    const currentProc = this.runningProcesses[processName];
    if (currentProc && !currentProc.killed) {
      try {
        currentProc.kill();
      } catch (err) {
        console.error("Error killing process", processName, err);
      }
    }

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

  private waitForDependencies(deps: string[]): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (
          deps.every((dep) => this.processStatus[dep] === ProcessState.HEALTHY)
        ) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });
  }

  private waitForReadyCheck(check: ReadyCheck): Promise<void> {
    return new Promise((resolve, reject) => {
      const intervalMs = check.interval || 1000;
      const timeoutMs = check.timeout || 30000;
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error("Ready check timed out"));
          return;
        }
        if (check.type === "command" && check.command) {
          exec(check.command, (error: Error | null) => {
            if (!error) {
              clearInterval(interval);
              resolve();
            }
          });
        } else if (check.type === "url" && check.url) {
          const lib = check.url.startsWith("https") ? https : http;
          lib
            .get(check.url, (res: any) => {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                clearInterval(interval);
                resolve();
              }
            })
            .on("error", () => {
              /* ignore */
            });
        } else {
          clearInterval(interval);
          reject(new Error("Invalid ready check configuration"));
        }
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

    return proc;
  }

  private updateProcessStatus(
    processName: string,
    newState: ProcessState,
  ): void {
    const oldState = this.processStatus[processName];
    this.processStatus[processName] = newState;
    if (oldState !== newState) {
      this.emit(this.STATUS_CHANGE_EVENT_NAME, processName, newState);
    }
  }
}
