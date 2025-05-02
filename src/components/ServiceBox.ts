import blessed from "blessed";
import contrib from "blessed-contrib";
import { getColoredState, ProcessStore } from "../processStore";
import chalk from "chalk";

export class ServiceBox {
  private layout: blessed.Widgets.LayoutElement;
  private nodes: blessed.Widgets.BoxElement[];
  following = true;
  constructor(
    private screen: blessed.Widgets.Screen,
    private grid: any,
    private processStore: ProcessStore,
  ) {
    this.layout = this.grid.set(0, 0, 1, 12, blessed.layout, {
      padding: 0,
      layout: "inline",
      width: "100%",
      height: "100%",
    });

    this.nodes = this.processStore.getProcesses().map((process) => {
      const state = getColoredState(` ${process.state} `);
      const name = chalk.hex(process.color)(`[${process.name}]`);
      return blessed.box({
        parent: this.layout,
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        border: {
          type: "line",
        },
        content: `${name} ${state}`,
      });
    });

    this.screen.render();
  }

  destroy() {
    this.layout.destroy();
    this.nodes.forEach((n) => n.destroy());
  }
}
