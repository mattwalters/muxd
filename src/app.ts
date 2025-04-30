import { loadConfig } from "./config/loader";
import blessed from "blessed";
import contrib from "blessed-contrib";
import { ProcessStore } from "./processStore";
import { LogStore } from "./logStore";

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
  private gauge;
  private map;
  private logBox;

  constructor() {
    this.cleanup = this.cleanup.bind(this);
    this.config = loadConfig();
    this.logStore = new LogStore();
    this.processStore = new ProcessStore(this.config, this.logStore);
    this.screen = blessed.screen();
    this.layout = new Layout(this.screen);

    this.logBox = this.layout.grid.set(0, 0, 12, 8, blessed.box, {
      label: "Logs",
    });
    this.logStore.on(this.logStore.LOG_ADDED_EVENT_NAME, () => {
      const interiorHeight = this.logBox.height - 2;
      const logs = this.logStore.getLogs();
      this.logBox.content = logs
        .map((l) => {
          return `[${l.process}] ${l.text}`;
        })
        .join("\n");
    });

    this.map = this.layout.grid.set(0, 8, 6, 4, contrib.map, {
      label: "Worllllld Mpa",
    });
    (this.map as any).addMarker({
      lon: "-79.0000",
      lat: "37.5000",
      color: "red",
      char: "X",
    });

    this.gauge = this.layout.grid.set(6, 8, 6, 4, contrib.gauge, {
      label: "Progress",
      stroke: "green",
      fill: "white",
    });
    this.screen.render();
    this.gauge.setPercent(75);

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
    this.screen.destroy();
    process.exit(0);
  }
}
