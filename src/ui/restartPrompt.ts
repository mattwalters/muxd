import blessed from "blessed";
import { ProcessManager } from "../process/manager";
import { ProcessConfig } from "../config/schema";

export class RestartPrompt {
  private screen: blessed.Widgets.Screen;
  private processManager: ProcessManager;
  private modal: blessed.Widgets.ListElement | null = null;

  constructor(screen: blessed.Widgets.Screen, processManager: ProcessManager) {
    this.screen = screen;
    this.processManager = processManager;
  }

  open(services: ProcessConfig[]): void {
    if (this.modal) {
      this.close();
    }

    const items = services.map((proc) => proc.name);
    this.modal = blessed.list({
      parent: this.screen,
      border: "line",
      label: " Restart Process (Select One) ",
      width: "50%",
      height: items.length + 2,
      top: "center",
      left: "center",
      items,
      keys: true,
      vi: true,
      mouse: true,
      style: { selected: { bg: "blue" } },
    });

    this.modal.focus();
    this.modal.once("select", (_item, index) => {
      const processName = services[index].name;
      this.processManager.restartProcess(processName);
      this.close();
    });
    this.modal.key(["escape", "q"], () => {
      this.close();
    });

    this.screen.render();
  }

  close(): void {
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
      this.screen.render();
    }
  }
}
