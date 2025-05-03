import blessed from "blessed";
import chalk from "chalk";
import { LogStore, LogEntry } from "../logStore";
import { ProcessStore } from "../processStore";
import { logger } from "../logger";

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

    // Handle manual scrolling and toggling follow mode
    this.box.on("keypress", (ch, key) => {
      // 'f' to resume follow mode and scroll to bottom
      if (key.name === "f") {
        this.following = true;
        this.box.setScrollPerc(100);
        this.screen.render();
        return;
      }
      // 'j' or 'k' enter manual mode and optionally page-scroll
      if (key.name === "j" || key.name === "k") {
        this.following = false;
        // Shift+J/K for page scroll
        const page = this.box.height as number;
        if (key.shift) {
          if (key.name === "j") {
            this.box.scroll(page || 1);
          } else {
            this.box.scroll(-(page || 1));
          }
          this.screen.render();
        }
      }
    });
    this.onLogAdded = () => {
      let lines = this.logStore.getLogs();
      const solos = this.processStore
        .getProcesses()
        .filter((p) => p.solo && !p.mute);
      const mutes = this.processStore.getProcesses().filter((p) => !p.mute);
      if (solos.length > 0) {
        const soloNames = solos.map((s) => s.name);
        lines = lines.filter((l) => soloNames.includes(l.process));
      } else if (mutes.length > 0) {
        const nonMutedNames = mutes.map((s) => s.name);
        lines = lines.filter((l) => nonMutedNames.includes(l.process));
      }
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
    this.processStore.on(
      this.processStore.PROCESS_UPDATED_EVENT_NAME,
      this.onLogAdded,
    );
  }

  handleKeyPress(key: string, event: blessed.Widgets.Events.IKeyEventArg) {
    logger("key", key);
    if (key === "f") {
      this.following = true;
      setImmediate(() => {
        this.box.setScrollPerc(100);
        this.screen.render();
      });
      return true;
    }
    if (event.name === "j") {
      this.following = false;
      const height =
        typeof this.box.height === "string"
          ? parseInt(this.box.height)
          : this.box.height;
      const amount = event.shift ? height : 1;
      this.box.scroll(amount);
      return true;
    }
    if (event.name === "k") {
      this.following = false;
      const height =
        typeof this.box.height === "string"
          ? parseInt(this.box.height)
          : this.box.height;
      const amount = event.shift ? -height : -1;
      this.box.scroll(amount);
      return true;
    }
  }

  destroy() {
    this.logStore.off(this.logStore.LOG_ADDED_EVENT_NAME, this.onLogAdded);
    this.processStore.off(
      this.processStore.PROCESS_UPDATED_EVENT_NAME,
      this.onLogAdded,
    );
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
