import blessed from "blessed";
import { getStateColorFn, ProcessStore } from "../processStore.js";
import chalk from "chalk";

export class ServiceBox {
  private layout: blessed.Widgets.LayoutElement;
  private boxByProcess: Record<string, blessed.Widgets.BoxElement> = {};
  private onProcessUpdated;
  following = true;
  constructor(
    private screen: blessed.Widgets.Screen,
    private container: blessed.Widgets.BoxElement,
    private processStore: ProcessStore,
  ) {
    this.layout = blessed.layout({
      parent: this.container,
      padding: 0,
      layout: "inline",
      width: "100%",
      height: this.height(),
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

  height() {
    return 3;
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
