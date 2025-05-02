import blessed from "blessed";
import { getStateColorFn, ProcessStore } from "../processStore";
import chalk from "chalk";

export class ServiceBox {
  private layout: blessed.Widgets.LayoutElement;
  private boxByProcess: Record<string, blessed.Widgets.BoxElement> = {};
  private onProcessUpdated;
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
      label: "Services",
    });

    this.processStore.getProcesses().forEach((process) => {
      const state = getStateColorFn(process.state)(` ${process.state} `);
      const name = chalk.hex(process.color)(`[${process.name}]`);
      this.boxByProcess[process.name] = blessed.box({
        parent: this.layout,
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        border: {
          type: "line",
        },
        content: `${name} ${state}`,
      });
    });

    this.onProcessUpdated = () => {
      this.processStore.getProcesses().forEach((process) => {
        const box = this.boxByProcess[process.name];
        const state = getStateColorFn(process.state)(` ${process.state} `);
        const name = chalk.hex(process.color)(`[${process.name}]`);
        const content = `${name} ${state}`;
        box.setContent(content);
      });
    };

    this.processStore.on(
      this.processStore.PROCESS_UPDATED_EVENT_NAME,
      this.onProcessUpdated,
    );
    this.screen.render();
  }

  destroy() {
    this.processStore.off(
      this.processStore.PROCESS_UPDATED_EVENT_NAME,
      this.onProcessUpdated,
    );
    this.layout.destroy();
    const boxes = Object.values(this.boxByProcess);
    boxes.forEach((box) => {
      box.destroy();
    });
  }
}
