import contrib from "blessed-contrib";
import blessed from "blessed";
import { LogStore } from "../logStore";
import { LogBox } from "../components/LogBox";
import { ProcessStore } from "../processStore";
import { Layout } from "./Layout";
import { ServiceBox } from "../components/ServiceBox";

export class DevLayout extends Layout {
  private grid: contrib.grid;
  private logBox: LogBox;
  private serviceBox: ServiceBox;
  private sparkline: any;
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

    this.serviceBox = new ServiceBox(this.screen, this.grid, this.processStore);
    //this.worldMap = this.grid.set(6, 8, 6, 4, contrib.map, {
    //  label: "World Map",
    //});
    //this.sparkline = this.grid.set(4, 8, 2, 4, contrib.sparkline, {
    //  label: "World fooo",
    //  tags: true,
    //});

    //this.sparkline.setData(
    //  ["Sparkline1 asdasd asdasd HEALHTH", "HEALTHY"],
    //  [
    //    [10, 20, 30, 20],
    //    [40, 10, 40, 50],
    //  ],
    //);
  }

  destroy(): void {
    this.logBox.destroy();
    this.worldMap.destroy();
    this.gauge.destroy();
    this.root.destroy();
  }
}
