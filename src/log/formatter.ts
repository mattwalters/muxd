import chalk from "chalk";
import { LogEntry } from "./store";

// Interface to track color assignments
interface ColorMap {
  [processName: string]: string;
}

// Map of color names to hex values
const colorMapping: Record<string, string> = {
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#00FF00",
  blue: "#0000FF",
  magenta: "#FF00FF",
  cyan: "#00FFFF",
};

// Get a color name by index
function getColorName(index: number): string {
  const keys = Object.keys(colorMapping);
  return keys[index % keys.length];
}

// Create process color mapping
export function createProcessColorMap(processNames: string[]): ColorMap {
  const colorMap: ColorMap = {};

  processNames.forEach((name, i) => {
    const colorName = getColorName(i);
    colorMap[name] = colorMapping[colorName];
  });

  return colorMap;
}

// Format a log entry
export function formatLogEntry(
  entry: LogEntry,
  colorMap: ColorMap,
  filter?: string,
): string {
  let line = colorMap[entry.process]
    ? chalk.hex(colorMap[entry.process])(`[${entry.process}] `) + entry.text
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
  colorMap: ColorMap,
  filter?: string,
): string {
  return entries
    .map((entry) => formatLogEntry(entry, colorMap, filter))
    .join("\n");
}
