// This file contains common type definitions used across multiple modules

import { ChildProcess } from "child_process";

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
  filterPrompt?: any;
  serviceModal?: any;
}
