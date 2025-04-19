import blessed from "blessed";
import util from "util";
import { ProcessManager } from "../process/manager";
import { ProcessConfig } from "../config/schema";
import { logger } from "./logger";

export class RestartPrompt {
  private screen: blessed.Widgets.Screen;
  private processManager: ProcessManager;
  private container: blessed.Widgets.BoxElement | null = null;
  private filterText: blessed.Widgets.TextElement | null = null;
  private list: blessed.Widgets.ListElement | null = null;
  private services: ProcessConfig[] = [];
  private filteredServices: ProcessConfig[] = [];
  private filter: string = "";

  constructor(screen: blessed.Widgets.Screen, processManager: ProcessManager) {
    this.screen = screen;
    this.processManager = processManager;
  }

  open(services: ProcessConfig[]): void {
    if (this.container) {
      this.close();
    }
    this.services = services;
    this.filteredServices = services;
    this.filter = "";
    const names = services.map((proc) => proc.name);

    this.container = blessed.box({
      parent: this.screen,
      border: "line",
      label: " Restart Process (type to filter, j/k to navigate) ",
      width: "50%",
      height: names.length + 4,
      top: "center",
      left: "center",
      keys: true,
      mouse: true,
      style: { border: { fg: "white" } },
    });

    this.filterText = blessed.text({
      parent: this.container,
      top: 0,
      left: 1,
      content: "Filter: ",
      height: 1,
    });

    this.list = blessed.list({
      parent: this.container,
      top: 1,
      left: 1,
      width: "100%-2",
      height: "100%-1",
      items: names,
      mouse: true,
      style: { selected: { bg: "blue" } },
      scrollable: true,
      alwaysScroll: true,
      keys: false,
      vi: false,
    });

    this.container.focus();
    this.container.on("keypress", (ch: string, key: any) => {
      if (!this.container || !this.list || !this.filterText) {
        return;
      }
      // Navigate list when Shift+K/J is pressed; prevent further handling
      if (key.shift) {
        if (key.name === "k") {
          const before = this.list.selected;
          this.list.move(-1);
          this.screen.render();
          const after = this.list.selected;
          logger.info("before after k", before, after);
          return;
        }
        if (key.name === "j") {
          const before = this.list.selected;
          this.list.move(1);
          const after = this.list.selected;
          logger.info("before after j", before, after);
          this.screen.render();
          return;
        }
      }
      switch (key.name) {
        case "escape":
        case "q":
          this.close();
          return;

        case "enter":
          if (this.filteredServices.length > 0) {
            const idx = this.list.selected;
            const processName = this.filteredServices[idx].name;
            this.processManager.restartProcess(processName);
            this.close();
          }
          return;
        case "backspace":
          this.filter = this.filter.slice(0, -1);
          break;
        default:
          if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
            this.filter += ch;
          } else {
            return;
          }
      }
      this.updateList();
      this.screen.render();
    });

    this.updateList();
    this.screen.render();
  }

  close(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
      this.filterText = null;
      this.list = null;
      this.screen.render();
    }
  }

  private updateList(): void {
    if (!this.list || !this.filterText) {
      return;
    }
    this.filterText.setContent(`Filter: ${this.filter}`);
    this.filteredServices = this.services.filter((proc) =>
      proc.name.toLowerCase().includes(this.filter.toLowerCase()),
    );
    const names = this.filteredServices.map((proc) => proc.name);
    if (names.length === 0) {
      this.list.setItems(["<no matches>"]);
    } else {
      this.list.setItems(names);
    }
    this.list.select(0);
  }
}
