import { EventEmitter } from "events";

export interface LogEntry {
  process: string;
  text: string;
  index: number;
}

export class LogStore extends EventEmitter {
  LOG_ADDED_EVENT_NAME = "log-added";
  private logs: LogEntry[] = [];
  private nextIndex = 0;

  constructor() {
    super();
  }

  addLog(processName: string, text: string): void {
    const entry: LogEntry = {
      process: processName,
      text,
      index: this.nextIndex,
    };
    this.logs.push(entry);
    this.nextIndex++;
    this.emit(this.LOG_ADDED_EVENT_NAME, entry);
  }

  addSystemLog(text: string): void {
    this.addLog("SYSTEM", text);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  setLogs(logs: LogEntry[]): void {
    this.logs = logs;
  }
}
