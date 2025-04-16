import blessed from "blessed";

export class StatusBox {
  private box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
    this.box = blessed.box({
      top: 0,
      right: 0,
      width: "25%",
      height: "100%-1",
      border: { type: "line" },
      scrollbar: { ch: " " },
      alwaysScroll: true,
      scrollable: true,
      keys: true,
      mouse: true,
      vi: true,
      label: " Service Status ",
      content: "",
    });
    this.screen.append(this.box);
  }

  updateStatus(serviceName: string, status: string) {
    console.log("serviceName", serviceName);
    console.log("status", status);
  }
}
