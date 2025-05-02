export abstract class Layout {
  abstract destroy(): void;
  handleKeyPress(ch: string): boolean | undefined {
    return false;
  }
}
