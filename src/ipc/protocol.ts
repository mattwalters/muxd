import { LogEntry } from "../log/store";

// Interface for IPC message types
export interface HistoryMessage {
  type: "history";
  data: LogEntry[];
}

export interface LogMessage {
  type: "log";
  data: LogEntry;
}

export interface RestartMessage {
  type: "restart";
  processName: string;
}

export type IPCMessage = HistoryMessage | LogMessage | RestartMessage;

// Message protocol helper functions
export class MessageProtocol {
  // Create a history message with all logs
  static createHistoryMessage(logs: LogEntry[]): HistoryMessage {
    return {
      type: "history",
      data: logs,
    };
  }

  // Create a log message for a single log entry
  static createLogMessage(entry: LogEntry): LogMessage {
    return {
      type: "log",
      data: entry,
    };
  }

  // Create a restart command message
  static createRestartMessage(processName: string): RestartMessage {
    return {
      type: "restart",
      processName,
    };
  }

  // Parse an IPC message
  static parseMessage(json: string): IPCMessage {
    try {
      return JSON.parse(json) as IPCMessage;
    } catch (err) {
      throw new Error(`Invalid IPC message format: ${err}`);
    }
  }
}
