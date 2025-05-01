import contrib from "blessed-contrib";
import blessed from "blessed";
import { Layout } from "./Layout";

export class MainLayout extends Layout {
  private grid: contrib.grid;

  constructor(private screen: blessed.Widgets.Screen) {
    super();
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    this.addWorldMap();
    this.addList();
  }

  private addWorldMap() {
    return this.grid.set(0, 0, 12, 12, contrib.map, {});
  }

  private addList() {
    const box = this.grid.set(0, 0, 12, 12, blessed.box, {
      border: "line",
      width: "50%",
      top: "center",
      left: "center",
    });
    const list = blessed.list({ parent: box });
  }

  destroy(): void {
    // Clone children array to avoid mutation during iteration
    [...this.screen.children].forEach((child) => child.destroy());
  }
}
