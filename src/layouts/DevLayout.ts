import contrib from "blessed-contrib";
import blessed from "blessed";
import { LogStore } from "../logStore";
import { LogBox } from "../components/LogBox";
import { ProcessStore } from "../processStore";
import { Layout } from "./Layout";

export class DevLayout extends Layout {
  private grid: contrib.grid;
  private logBox: LogBox;
  private following = true;

  constructor(
    private screen: blessed.Widgets.Screen,
    private processStore: ProcessStore,
    private logStore: LogStore,
  ) {
    super();
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    this.logBox = new LogBox(
      this.screen,
      this.grid,
      this.logStore,
      this.processStore,
    );
    this.addWorldMap();
    this.addGauge();
  }

  private addWorldMap() {
    return this.grid.set(0, 8, 6, 4, contrib.map, {
      label: "World Map",
    });
  }

  private addGauge() {
    return this.grid.set(6, 8, 6, 4, contrib.gauge, {
      label: "Progress",
      stroke: "green",
      fill: "white",
    });
  }

  destroy(): void {
    // Clone children array to avoid mutation during iteration
    [...this.screen.children].forEach((child) => child.destroy());
  }
}
