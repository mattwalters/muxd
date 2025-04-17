import { ChildProcess, spawn } from "child_process";
import { Config, ProcessConfig, ReadyCheck } from "../config/schema";
import { LogStore } from "../log/store";
import EventEmitter from "events";

const colorMapping = [
  "#FF0000",
  "#FFFF00",
  "#00FF00",
  "#0000FF",
  "#FF00FF",
  "#00FFFF",
];

export class ProcessManager extends EventEmitter {
  private config: Config;
  private logStore: LogStore;
  private runningProcesses: Record<string, ChildProcess> = {};
  private processStatus: Record<string, boolean> = {};
  private serviceFlags: Record<string, { mute: boolean; solo: boolean }> = {};
  private serviceColors: Record<string, string> = {};
  STATUS_CHANGE_EVENT_NAME = "status-change";

  constructor(config: Config, logStore: LogStore) {
    super();
    this.config = config;
    this.logStore = logStore;

    // Initialize process status and flags
    config.services.forEach((proc, i) => {
      this.processStatus[proc.name] = false;
      this.serviceFlags[proc.name] = { mute: false, solo: false };
      this.serviceColors[proc.name] =
        proc.color ?? colorMapping[i % colorMapping.length];
    });
  }

  forEachService(callback: (p: ProcessConfig) => void) {
    this.config.services.forEach((proc) => {
      callback(proc);
    });
  }

  getColor(serviceName: string) {
    return this.serviceColors[serviceName];
  }

  // Get process flags (mute/solo)
  getServiceFlags(serviceName: string) {
    return this.serviceFlags[serviceName] || { mute: false, solo: false };
  }

  // Toggle mute flag for a service
  toggleMute(serviceName: string): boolean {
    if (!this.serviceFlags[serviceName]) return false;
    this.serviceFlags[serviceName].mute = !this.serviceFlags[serviceName].mute;
    this.logStore.addSystemLog(
      `${serviceName} is now ${this.serviceFlags[serviceName].mute ? "muted" : "unmuted"}.`,
    );
    return true;
  }

  // Toggle solo flag for a service
  toggleSolo(serviceName: string): boolean {
    if (!this.serviceFlags[serviceName]) return false;
    this.serviceFlags[serviceName].solo = !this.serviceFlags[serviceName].solo;
    this.logStore.addSystemLog(
      `${serviceName} is now ${this.serviceFlags[serviceName].solo ? "solo" : "unsolo"}.`,
    );
    return true;
  }

  // Start all processes
  async startAllProcesses() {
    for (const procConfig of this.config.services) {
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

  // Start a single process
  async startProcess(procConfig: ProcessConfig): Promise<ChildProcess> {
    if (procConfig.dependsOn && procConfig.dependsOn.length > 0) {
      this.logStore.addLog(
        procConfig.name,
        `Waiting for dependencies: ${procConfig.dependsOn.join(", ")}`,
      );
      await this.waitForDependencies(procConfig.dependsOn);
      this.logStore.addLog(procConfig.name, "Dependencies are ready.");
    }

    const proc = this.spawnProcess(
      procConfig,
      (data: Buffer, isError: boolean) => {
        const lines = data.toString().split("\n");
        lines.forEach((line) => {
          if (line.trim() !== "") {
            this.logStore.addLog(
              procConfig.name,
              isError ? `ERROR: ${line.trimEnd()}` : line.trimEnd(),
            );
          }
        });
      },
    );

    this.runningProcesses[procConfig.name] = proc;
    this.updateProcessStatus(procConfig.name, true);

    proc.on("close", (code) => {
      this.logStore.addLog(procConfig.name, `exited with code ${code}`);
      delete this.runningProcesses[procConfig.name];
      this.processStatus[procConfig.name] = false;
    });

    if (procConfig.ready) {
      this.logStore.addLog(procConfig.name, "Performing ready check...");
      try {
        await this.waitForReadyCheck(procConfig.ready);
        this.logStore.addLog(procConfig.name, "Ready check passed.");
      } catch (err: any) {
        this.logStore.addLog(
          procConfig.name,
          `Ready check failed: ${err.message}`,
        );
      }
    } else {
      this.logStore.addLog(
        procConfig.name,
        "No ready check defined; marking as ready.",
      );
    }

    return proc;
  }

  // Restart a process
  async restartProcess(processName: string): Promise<void> {
    const procConfig = this.config.services.find((p) => p.name === processName);
    if (!procConfig) {
      this.logStore.addSystemLog(`Configuration for ${processName} not found.`);
      return;
    }

    this.logStore.addSystemLog(`Restarting process ${processName}...`);
    const currentProc = this.runningProcesses[processName];
    if (currentProc) {
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

  // Cleanup all processes
  cleanup(): void {
    Object.values(this.runningProcesses).forEach((proc) => {
      try {
        if (!proc.killed) proc.kill();
      } catch (err) {
        // Ignore errors
      }
    });
  }

  // Wait for dependencies to be ready
  private waitForDependencies(deps: string[]): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const allReady = deps.every((dep) => this.processStatus[dep] === true);
        if (allReady) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });
  }

  // Wait for ready check to pass
  private waitForReadyCheck(check: ReadyCheck): Promise<void> {
    return new Promise((resolve, reject) => {
      const { exec } = require("child_process");
      const { http, https } = require("http");

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

    proc.stdout.on("data", (data: Buffer) => {
      onData(data, false);
    });

    proc.stderr.on("data", (data: Buffer) => {
      onData(data, true);
    });

    return proc;
  }

  private updateProcessStatus(processName: string, isRunning: boolean): void {
    const oldStatus = this.processStatus[processName];
    this.processStatus[processName] = isRunning;

    if (oldStatus !== isRunning) {
      this.emit(this.STATUS_CHANGE_EVENT_NAME, processName, isRunning);
    }
  }
}
