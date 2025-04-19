import blessed from "blessed";
import { ProcessConfig } from "../config/schema";
import { ProcessState } from "../types";
import { CompleteProcessConfig } from "../process/manager";

export class StatusBox {
  private box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  private serviceToState: Record<string, ProcessState> = {};
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

  updateStatus(serviceName: string, state: ProcessState) {
    this.serviceToState[serviceName] = state;
    this.renderServiceStatuses();
  }

  initializeService(proc: CompleteProcessConfig) {
    this.serviceToState[proc.name] = proc.state;
    this.serviceToColor[proc.name] = proc.color;
    this.renderServiceStatuses();
  }

  private renderServiceStatuses() {
    const serviceNames = Object.keys(this.serviceToState);
    // Determine width for service column (including brackets)
    const maxNameLen = serviceNames.length
      ? Math.max(...serviceNames.map(n => n.length + 2))
      : 0;

    let content = "";
    for (const serviceName of serviceNames) {
      const state = this.serviceToState[serviceName];
      let coloredState;
      if (state === ProcessState.HEALTHY) {
        coloredState = `{green-fg}${state}{/}`;
      } else if (state === ProcessState.FAILED) {
        coloredState = `{red-fg}${state}{/}`;
      } else {
        coloredState = `{yellow-fg}${state}{/}`;
      }

      // Pad service name cell to align states
      const serviceCell = `[${serviceName}]`.padEnd(maxNameLen);
      const serviceColor = `{${this.serviceToColor[serviceName]}-fg}`;
      content += `${serviceColor}${serviceCell}{/} ${coloredState}\n`;
    }

    this.box.setContent(content);
    this.screen.render();
  }
}
