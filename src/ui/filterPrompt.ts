import blessed from "blessed";
import { LogStore } from "../log/store";

export class FilterPrompt {
  private screen: blessed.Widgets.Screen;
  private logStore: LogStore;
  private amIOpen: boolean = false;

  constructor(screen: blessed.Widgets.Screen, logStore: LogStore) {
    this.screen = screen;
    this.logStore = logStore;
  }

  isOpen() {
    return this.amIOpen;
  }

  // Open the filter prompt with the current filter value
  open(): void {
    this.amIOpen = true;
    const currentFilter = this.logStore.getFilter();

    const prompt = blessed.prompt({
      parent: this.screen,
      border: "line",
      height: "shrink",
      width: "50%",
      top: "center",
      left: "center",
      label: " Filter Logs ",
      tags: true,
      keys: true,
      vi: true,
    });

    prompt.input("Regex filter:", currentFilter, (_err, value) => {
      if (value !== undefined) {
        this.logStore.setFilter(value.trim());
      }
      this.amIOpen = false;
      prompt.destroy();
      this.screen.render();
    });
  }
}
