import contrib from "blessed-contrib";
import blessed from "blessed";
import { LogStore } from "../logStore";
import { LogBox } from "../components/LogBox";
import { ProcessStore } from "../processStore";
import { Layout } from "./Layout";
import { ServiceBox } from "../components/ServiceBox";
import { logger } from "../logger";

export class DevLayout extends Layout {
  private container: blessed.Widgets.BoxElement;
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
  }

  destroy(): void {
    this.serviceBox.destroy();
    this.logBox.destroy();
    this.root.destroy();
  }
}
