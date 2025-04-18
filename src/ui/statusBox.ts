import blessed from "blessed";
import { ProcessConfig } from "../config/schema";

export class StatusBox {
  private box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  private serviceToState: Record<string, boolean> = {};
  private serviceToColor: Record<string, string> = {};
  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
    this.box = blessed.box({
      top: 0,
      right: 0,
      width: "25%",
      height: "100%-1",
      border: { type: "line" },
      padding: 1,
      scrollbar: { ch: " " },
      alwaysScroll: true,
      scrollable: true,
      keys: true,
      mouse: true,
      vi: true,
      label: " Services ",
      content: "",
      tags: true,
    });
    this.screen.append(this.box);
  }

  updateStatus(serviceName: string, status: boolean) {
    this.serviceToState[serviceName] = status;
    this.renderServiceStatuses();
  }

  initializeService(proc: ProcessConfig) {
    this.serviceToState[proc.name] = false;
    this.serviceToColor[proc.name] = proc.color!;
    this.renderServiceStatuses();
  }

  private renderServiceStatuses() {
    let content = "";
    for (const serviceName of Object.keys(this.serviceToState)) {
      const isRunning = this.serviceToState[serviceName];
      const statusText = isRunning ? "HEALTHY" : "STOPPED";
      const statusColor = isRunning ? "{green-fg}" : "{red-fg}";

      const serviceColor = `{${this.serviceToColor[serviceName]}-fg}`;
      content += `${serviceColor}[${serviceName}]{/} ${statusColor}${statusText}{/}\n`;
    }

    this.box.setContent(content);
    this.screen.render();
  }
}
