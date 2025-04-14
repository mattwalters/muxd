import blessed from "blessed";

export class StatusBar {
  private bar: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
    this.bar = blessed.box({
      bottom: 0,
      left: 0,
      width: "100%",
      height: 1,
      content:
        "Press 'q' to quit. '/' to filter, 'r' to restart, 'f' for service control.",
      style: { fg: "white", bg: "blue" },
    });

    screen.append(this.bar);
  }

  // Update the status bar message
  setContent(message: string): void {
    this.bar.setContent(message);
    this.screen.render();
  }

  // Add text to the status bar
  appendContent(message: string): void {
    this.bar.setContent(this.bar.content + message);
    this.screen.render();
  }
}
