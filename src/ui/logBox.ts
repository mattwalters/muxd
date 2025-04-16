import blessed from "blessed";
import { LogEntry } from "../log/store";
import { formatLogEntries, createProcessColorMap } from "../log/formatter";

export class LogBox {
  private box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  private colorMap: Record<string, string> = {};

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

  // Initialize color mapping for processes
  initColorMap(processNames: string[]): void {
    this.colorMap = createProcessColorMap(processNames);
  }

  // Update the log display
  updateLogs(
    entries: LogEntry[],
    filter?: string,
    muteFilter?: (entry: LogEntry) => boolean,
  ): void {
    // Apply mute filter if provided
    const filteredEntries = muteFilter ? entries.filter(muteFilter) : entries;

    // Format the log entries
    const content = formatLogEntries(filteredEntries, this.colorMap, filter);

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
