// This file contains common type definitions used across multiple modules

import { ChildProcess } from "child_process";

export enum ProcessState {
  PENDING = "PENDING", // Process is initialized but not started yet
  STARTING = "STARTING", // Process has been started but not ready
  HEALTHY = "HEALTHY", // Process is running and ready
  STOPPING = "STOPPING", // Process is being gracefully stopped
  STOPPED = "STOPPED", // Process is not running
  FAILED = "FAILED", // Process exited with error or health check failed
  RESTARTING = "RESTARTING", // Process is being restarted
}

// Interface for process status
export interface ProcessStatus {
  name: string;
  running: boolean;
  pid?: number;
  uptime?: number;
}

// Interface for service flags
export interface ServiceFlags {
  mute: boolean;
  solo: boolean;
}

// Interface for running processes
export interface RunningProcess {
  process: ChildProcess;
  config: {
    name: string;
    cmd: string;
    args?: string[];
  };
  startTime: number;
}

// Interface for UI component references
export interface UIComponents {
  screen: any;
  logBox: any;
  statusBar: any;
  statusBox: any;
  filterPrompt: any;
  serviceModal: any;
  restartPrompt: any;
}
