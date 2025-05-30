import blessed from "blessed";
import { LogStore } from "../logStore.js";
import { LogBox } from "../components/LogBox.js";
import { ProcessStore } from "../processStore.js";
import { Layout } from "./Layout.js";
import { ServiceBox } from "../components/ServiceBox.js";
import { logger } from "../logger.js";
import { ServiceModal } from "../components/Modal.js";

export class DevLayout extends Layout {
  private container: blessed.Widgets.BoxElement;
  private modal: ServiceModal;
  private logBox: LogBox;
  private serviceBox: ServiceBox;

  constructor(
    private root: blessed.Widgets.BoxElement,
    private screen: blessed.Widgets.Screen,
    private processStore: ProcessStore,
    private logStore: LogStore,
  ) {
    super();
    this.container = blessed.box({
      parent: this.root,
    });

    this.serviceBox = new ServiceBox(
      this.screen,
      this.container,
      this.processStore,
    );

    logger("number", this.serviceBox.height());
    this.logBox = new LogBox(
      this.screen,
      this.container,
      this.serviceBox.height() as number,
      this.logStore,
      this.processStore,
    );

    this.modal = new ServiceModal(this.screen, this.root, this.processStore);
  }

  handleKeyPress(key: string, event: blessed.Widgets.Events.IKeyEventArg) {
    if (this.logBox.handleKeyPress(key, event)) {
      return true;
    }
    if (!this.modal.open && key === "s") {
      this.modal.show();
      return true;
    }
    if (this.modal.open) {
      if (event.name === "escape" || key === "q") {
        this.modal.hide();
        return true;
      }
      if (key === "x") {
        const name = this.modal.selected();
        const config = this.processStore
          .getProcesses()
          .find((p) => p.name === name)!;
        this.processStore.stopProcess(config);
        this.modal.hide();
        return true;
      }
      if (key === "a") {
        const name = this.modal.selected();
        const config = this.processStore
          .getProcesses()
          .find((p) => p.name === name)!;
        this.processStore.startProcess(config);
        this.modal.hide();
        return true;
      }
      if (key === "r") {
        const name = this.modal.selected();
        this.processStore.restartProcess(name);
        this.modal.hide();
        return true;
      }

      if (key === "m") {
        const name = this.modal.selected();
        this.processStore.toggleMute(name);
        this.modal.hide();
        return true;
      }

      if (key === "o") {
        const name = this.modal.selected();
        this.processStore.toggleSolo(name);
        this.modal.hide();
        return true;
      }
    }
  }

  destroy(): void {
    this.modal.destroy();
    this.serviceBox.destroy();
    this.logBox.destroy();
    this.root.destroy();
  }
}
