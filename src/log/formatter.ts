import chalk from "chalk";
import { LogEntry } from "./store";

// Type for process color getter function
export type ColorGetter = (processName: string) => string;

// Format a log entry
export function formatLogEntry(
  entry: LogEntry,
  getColor: ColorGetter,
  filter?: string,
): string {
  const color = getColor(entry.process);
  let line = color
    ? chalk.hex(color)(`[${entry.process}] `) + entry.text
    : `[${entry.process}] ` + entry.text;

  if (filter && filter.trim() !== "") {
    try {
      const re = new RegExp(filter, "gi");
      line = line.replace(re, (match) => chalk.bgYellow(match));
    } catch (err) {
      /* ignore */
    }
  }

  return line;
}

// Format multiple log entries
export function formatLogEntries(
  entries: LogEntry[],
  getColor: ColorGetter,
  filter?: string,
): string {
  return entries
    .map((entry) => formatLogEntry(entry, getColor, filter))
    .join("\n");
}
