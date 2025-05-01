import { loadConfig } from "./config/loader";
import blessed from "blessed";
import { ProcessStore } from "./processStore";
import { LogStore } from "./logStore";
import { DevLayout } from "./layouts/DevLayout";
import { Layout } from "./layouts/Layout";
import { MainLayout } from "./layouts/MainLayout";

export class App {
  private config;
  private logStore;
  private processStore;
  private screen;
  private layout: Layout;

  constructor() {
    this.cleanup = this.cleanup.bind(this);
    this.config = loadConfig();
    this.logStore = new LogStore();
    this.processStore = new ProcessStore(this.config, this.logStore);
    this.screen = blessed.screen();
    this.layout = new MainLayout(this.screen);
    this.screen.render();

    this.setupKeyBindings();

    this.processStore.startAllProcesses();
  }

  createMainLayout() {
    //
  }

  createDevLayout() {
    return new DevLayout(this.screen, this.processStore, this.logStore);
  }

  updateLayout(layout: Layout) {
    this.layout.destroy();
    this.layout = layout;
    //
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
