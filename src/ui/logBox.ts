import blessed from "blessed";
import chalk from "chalk";
import { LogEntry } from "../log/store";
import { ProcessStore } from "../processStore";
import contrib from "blessed-contrib";

export type ColorAccessor = (processName: string) => string;

export class LogBox {
  private box: blessed.Widgets.BoxElement;

  constructor(
    grid: contrib.grid,
    private screen: blessed.Widgets.Screen,
    private processStore: ProcessStore,
  ) {
    this.box = grid.set(0, 0, 12, 8, blessed.box, {
      label: "Logs",
      width: "100%",
      height: "100%",
      border: { type: "line" },
      scrollbar: { ch: " " },
      alwaysScroll: true,
      scrollable: true,
      keys: true,
      mouse: true,
      vi: true,
      content: "",
    });
  }

  updateLogs(entries: LogEntry[], filter?: string): void {
    // Format the log entries
    const content = this.formatLogEntries(entries, filter);

    // Update the box content
    this.box.setContent(content);
    this.box.setScrollPerc(100);
    this.screen.render();
  }

  // Scroll up
  scrollUp(amount: number = 1): void {
    this.box.scroll(-amount);
    this.screen.render();
  }

  // Scroll down
  scrollDown(amount: number = 1): void {
    this.box.scroll(amount);
    this.screen.render();
  }

  // Format multiple log entries
  private formatLogEntries(entries: LogEntry[], filter?: string): string {
    return entries
      .map((entry) => this.formatLogEntry(entry, filter))
      .join("\n");
  }

  private formatLogEntry(entry: LogEntry, filter?: string): string {
    const color = this.processStore.getColor(entry.process);
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
}
