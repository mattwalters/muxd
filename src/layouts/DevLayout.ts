import contrib from "blessed-contrib";
import blessed from "blessed";
import { LogStore } from "../logStore";
import { LogBox } from "../components/LogBox";
import { ProcessStore } from "../processStore";
import { Layout } from "./Layout";

export class DevLayout extends Layout {
  private grid: contrib.grid;
  private logBox: LogBox;
  private worldMap: any;
  private gauge: any;

  constructor(
    private root: blessed.Widgets.BoxElement,
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
    this.worldMap = this.grid.set(0, 8, 6, 4, contrib.map, {
      label: "World Map",
    });
    this.gauge = this.grid.set(6, 8, 6, 4, contrib.gauge, {
      label: "Progress",
      stroke: "green",
      fill: "white",
    });
  }

  destroy(): void {
    this.logBox.destroy();
    this.worldMap.destroy();
    this.gauge.destroy();
    this.root.destroy();
  }
}
