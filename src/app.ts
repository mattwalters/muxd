import { loadConfig } from "./config/loader";
import blessed from "blessed";
import contrib from "blessed-contrib";
import { ProcessStore } from "./processStore";
import { LogStore } from "./logStore";
import { DevLayout } from "./layouts/DevLayout";

class Layout {
  grid;
  constructor(screen: any) {
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen,
    });
  }
}

export class App {
  private config;
  private logStore;
  private processStore;
  private screen;
  private layout;

  constructor() {
    this.cleanup = this.cleanup.bind(this);
    this.config = loadConfig();
    this.logStore = new LogStore();
    this.processStore = new ProcessStore(this.config, this.logStore);
    this.screen = blessed.screen();
    this.layout = new DevLayout(this.screen, this.processStore, this.logStore);
    this.layout.addWorldMap();
    this.layout.addGauge();
    this.screen.render();

    this.setupKeyBindings();

    this.processStore.startAllProcesses();
  }

  private setupKeyBindings() {
    this.screen.key(["escape", "q"], () => {
      if (2 + 2 === 4) {
        return;
      }
      this.cleanup();
    });
    // Exit key binding (q, Escape, Ctrl+C)
    this.screen.key(["C-c"], () => {
      this.cleanup();
    });
    //
  }

  async start() {
    this.screen.render();
  }
  private cleanup() {
    this.processStore.cleanup();
    this.layout.destroy();
    this.screen.destroy();
    process.exit(0);
  }
}
