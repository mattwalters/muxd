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
  }

  destroy(): void {
    this.serviceBox.destroy();
    this.logBox.destroy();
    this.root.destroy();
  }
}
