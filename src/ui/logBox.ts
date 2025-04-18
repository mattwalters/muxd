import blessed from "blessed";
import chalk from "chalk";
import { LogEntry } from "../log/store";
import { ProcessManager } from "../process/manager";

export type ColorAccessor = (processName: string) => string;

export class LogBox {
  private box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  private processManager: ProcessManager;

  constructor(screen: blessed.Widgets.Screen, processManager: ProcessManager) {
    this.processManager = processManager;
    this.screen = screen;
    this.box = blessed.box({
      top: 0,
      left: 0,
      width: "75%",
      height: "100%-1",
      border: { type: "line" },
      scrollbar: { ch: " " },
      alwaysScroll: true,
      scrollable: true,
      keys: true,
      mouse: true,
      vi: true,
      label: " Logs ",
      content: "",
    });

    this.screen.append(this.box);
  }

  updateLogs(
    entries: LogEntry[],
    filter?: string,
    muteFilter?: (entry: LogEntry) => boolean,
  ): void {
    // Apply mute filter if provided
    const filteredEntries = muteFilter ? entries.filter(muteFilter) : entries;

    // Format the log entries
    const content = this.formatLogEntries(filteredEntries, filter);

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

  // Page up
  pageUp(): void {
    this.box.scroll(-(this.box.height as number) / 2);
    this.screen.render();
  }

  // Page down
  pageDown(): void {
    this.box.scroll((this.box.height as number) / 2);
    this.screen.render();
  }

  // Scroll to top
  scrollToTop(): void {
    this.box.setScrollPerc(0);
    this.screen.render();
  }

  // Scroll to bottom
  scrollToBottom(): void {
    this.box.setScrollPerc(100);
    this.screen.render();
  }

  // Format multiple log entries
  private formatLogEntries(entries: LogEntry[], filter?: string): string {
    return entries
      .map((entry) => this.formatLogEntry(entry, filter))
      .join("\n");
  }

  private formatLogEntry(entry: LogEntry, filter?: string): string {
    const color = this.processManager.getColor(entry.process);
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
