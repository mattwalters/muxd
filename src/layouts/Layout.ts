import blessed from "blessed";

export abstract class Layout {
  abstract destroy(): void;
  handleKeyPress(
    ch: string,
    key: blessed.Widgets.Events.IKeyEventArg,
  ): boolean | undefined {
    return false;
  }
}
