import { EventEmitter } from "events";

export interface LogEntry {
  process: string;
  text: string;
}

export class LogStore extends EventEmitter {
  private logs: LogEntry[] = [];
  private currentFilter: string = "";

  constructor() {
    super();
  }

  // Add a log entry for a service
  addLog(processName: string, text: string): void {
    const entry: LogEntry = { process: processName, text };
    this.logs.push(entry);
    this.emit("logAdded", entry);
  }

  // Add a system log entry
  addSystemLog(text: string): void {
    this.addLog("SYSTEM", text);
  }

  // Get all logs (optionally filtered)
  getLogs(
    filterFn?: (entry: LogEntry) => boolean,
    regexFilter?: string,
  ): LogEntry[] {
    let filtered = filterFn ? this.logs.filter(filterFn) : [...this.logs];

    if (regexFilter && regexFilter.trim() !== "") {
      try {
        const re = new RegExp(regexFilter, "gi");
        filtered = filtered.filter((entry) => {
          const plainLine = `[${entry.process}] ${entry.text}`;
          return re.test(plainLine);
        });
      } catch (err) {
        console.error("Invalid filter regex", err);
      }
    }

    return filtered;
  }

  // Set the current filter
  setFilter(filter: string): void {
    this.currentFilter = filter;
    this.emit("filterChanged", filter);
  }

  // Get the current filter
  getFilter(): string {
    return this.currentFilter;
  }

  // Replace all logs with a new set (used for IPC client mode)
  setLogs(logs: LogEntry[]): void {
    this.logs = logs;
    this.emit("logsReplaced");
  }
}
