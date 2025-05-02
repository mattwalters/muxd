import { loadConfig } from "./config/loader";
import blessed from "blessed";
import { ProcessStore } from "./processStore";
import { LogStore } from "./logStore";
import { DevLayout } from "./layouts/DevLayout";
import { Layout } from "./layouts/Layout";
import { MainLayout } from "./layouts/MainLayout";
import { logger } from "./debug";

export class App {
  private config;
  private logStore;
  private processStore;
  private screen;
  private layout: Layout;
  private currentRoot?: blessed.Widgets.BoxElement;

  constructor() {
    this.cleanup = this.cleanup.bind(this);
    this.config = loadConfig();
    this.logStore = new LogStore();
    this.processStore = new ProcessStore(this.config, this.logStore);
    this.screen = blessed.screen();

    this.layout = this.createMainLayout();
    this.screen.render();

    this.setupKeyBindings();

    this.processStore.startAllProcesses();
  }

  createMainLayout() {
    const onSelectEnv = (env: string) => {
      if (env === "dev") {
        this.updateLayout(this.createDevLayout());
      } else {
        this.updateLayout(this.createDevLayout());
      }
    };
    const root = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    });
    this.currentRoot = root;
    return new MainLayout(root, this.screen, onSelectEnv);
  }

  createDevLayout() {
    const root = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    });
    this.currentRoot = root;
    return new DevLayout(root, this.screen, this.processStore, this.logStore);
  }

  updateLayout(layout: Layout) {
    this.layout.destroy();
    this.layout = layout;
    this.screen.render();
    //
  }

  private setupKeyBindings() {
    this.screen.key(["escape", "q"], () => {
      if (this.layout instanceof DevLayout) {
        this.updateLayout(this.createMainLayout());
      } else {
        this.cleanup();
      }
    });
    this.screen.key(["C-c"], () => {
      this.cleanup();
    });
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
