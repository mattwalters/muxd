import blessed from "blessed";
import chalk from "chalk";
import { LogStore, LogEntry } from "../logStore";
import { ProcessStore } from "../processStore";

export class LogBox {
  private box: blessed.Widgets.BoxElement;
  private onLogAdded;
  following = true;
  constructor(
    private screen: blessed.Widgets.Screen,
    private container: blessed.Widgets.BoxElement,
    private offset: number,
    private logStore: LogStore,
    private processStore: ProcessStore,
  ) {
    this.box = blessed.box({
      parent: this.container,
      label: "Logs",
      top: offset,
      height: `100%-${offset}`,
      border: "line",
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      mouse: true,
      vi: true,
      scrollbar: {
        ch: " ",
        track: { bg: "grey" },
        style: { bg: "white" },
      },
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
