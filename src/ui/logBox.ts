import blessed from "blessed";
import { LogEntry } from "../log/store";
import { formatLogEntries } from "../log/formatter";
import { ProcessManager } from "../process/manager";

export class LogBox {
  private box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  private processManager: ProcessManager | null = null;

  constructor(screen: blessed.Widgets.Screen) {
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

  // Set process manager reference to get colors
  setProcessManager(processManager: ProcessManager): void {
    this.processManager = processManager;
  }

  // Update the log display
  updateLogs(
    entries: LogEntry[],
    filter?: string,
    muteFilter?: (entry: LogEntry) => boolean,
  ): void {
    if (!this.processManager) {
      throw new Error("ProcessManager not set in LogBox");
    }

    // Apply mute filter if provided
    const filteredEntries = muteFilter ? entries.filter(muteFilter) : entries;

    // Create a getColor function that uses the process manager
    const getColor = (processName: string) => this.processManager!.getColor(processName);

    // Format the log entries
    const content = formatLogEntries(filteredEntries, getColor, filter);

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
}
