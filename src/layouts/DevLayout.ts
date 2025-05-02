import contrib from "blessed-contrib";
import blessed from "blessed";
import { LogStore } from "../logStore";
import { LogBox } from "../components/LogBox";
import { ProcessStore } from "../processStore";
import { Layout } from "./Layout";
import { ServiceBox } from "../components/ServiceBox";
import { logger } from "../logger";
import { Modal, RestartModal } from "../components/Modal";

export class DevLayout extends Layout {
  private container: blessed.Widgets.BoxElement;
  private modal: RestartModal;
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

    this.modal = new RestartModal(this.screen, this.root, this.processStore);
  }

  handleKeyPress(key: string) {
    logger("were key pressing in dev layout");
    if (key === "r") {
      logger("open modal");
      this.modal.show();
      return true;
    }
    if (key === "escape" || key === "q") {
      this.modal.hide();
      return true;
    }

    if (key === "enter" && this.modal.open) {
      const name = this.modal.selected();
      this.processStore.restartProcess(name);
      this.modal.hide();
      return;
    }
  }

  destroy(): void {
    this.modal.destroy();
    this.serviceBox.destroy();
    this.logBox.destroy();
    this.root.destroy();
  }
}
