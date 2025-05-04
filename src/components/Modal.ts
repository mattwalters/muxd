import blessed from "blessed";
import { ProcessStore } from "../processStore";

export class Modal {
  protected box: blessed.Widgets.BoxElement;
  open: boolean = false;

  constructor(
    private screen: blessed.Widgets.Screen,
    parent: blessed.Widgets.BoxElement,
  ) {
    this.box = blessed.box({
      parent,
      top: "center",
      left: "center",
      width: "50%",
      height: "30%",
      border: "line",
      padding: 1,
      label:
        "Services | r - restart | x - stop | a - start | m - mute | o - only",
      hidden: true,
      keys: true,
      mouse: true,
      style: {
        bg: "black",
        border: { fg: "white" },
      },
    });
  }

  show() {
    this.box.show();
    this.screen.render();
    this.open = true;
  }

  hide() {
    this.box.hide();
    this.screen.render();
    this.open = false;
  }

  destroy() {
    this.box.destroy();
  }
}

export class ServiceModal extends Modal {
  private list: blessed.Widgets.ListElement;
  constructor(
    screen: blessed.Widgets.Screen,
    parent: blessed.Widgets.BoxElement,
    processStore: ProcessStore,
  ) {
    super(screen, parent);
    this.list = blessed.list({
      parent: this.box,
      keys: true,
      vi: true,
      items: processStore.getProcesses().map((p) => p.name),
      style: {
        selected: { bg: "blue", fg: "white" }, // ← visual cue
      },
    });
  }

  selected() {
    const idx = (this.list as any).selected as number;
    return this.list.getItem(idx).getContent();
  }

  show() {
    this.list.focus();
    super.show();
  }

  destroy() {
    this.list.destroy();
    super.destroy();
  }
}
