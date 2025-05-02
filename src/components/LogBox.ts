import blessed from "blessed";
import chalk from "chalk";
import { LogStore } from "../logStore";
import { ProcessStore } from "../processStore";
import { LogEntry } from "../log/store";

export class LogBox {
  private box: blessed.Widgets.BoxElement;
  private onLogAdded;
  following = true;
  constructor(
    private screen: blessed.Widgets.Screen,
    private grid: any,
    private logStore: LogStore,
    private processStore: ProcessStore,
  ) {
    this.box = this.grid.set(1, 0, 11, 12, blessed.box, {
      label: "Logs",
      height: "100%",
      alwaysScroll: true,
      scrollable: true,
      scrollbar: { ch: " " },
    });
    this.onLogAdded = () => {
      const lines = this.logStore.getLogs();
      const formattedLines = this.formatLogEntries(lines);

      this.box.setContent(formattedLines);
      if (this.following) {
        setImmediate(() => {
          this.box.setScrollPerc(100);
          this.screen.render();
        });
      }
      this.screen.render();
    };
    this.screen.render();
    this.logStore.on(this.logStore.LOG_ADDED_EVENT_NAME, this.onLogAdded);
  }

  destroy() {
    this.logStore.off(this.logStore.LOG_ADDED_EVENT_NAME, this.onLogAdded);
    this.box.destroy();
  }

  private formatLogEntries(entries: LogEntry[]): string {
    return entries.map((entry) => this.formatLogEntry(entry)).join("\n");
  }

  private formatLogEntry(entry: LogEntry): string {
    const color = this.processStore.getColor(entry.process);
    let line = color
      ? chalk.hex(color)(`[${entry.process}] `) + entry.text
      : `[${entry.process}] ` + entry.text;

    return line;
  }
}
