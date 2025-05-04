import contrib from "blessed-contrib";
import blessed from "blessed";
import { Layout } from "./Layout.js";
import { logger } from "../logger.js";

export class MainLayout extends Layout {
  private grid: contrib.grid;
  private envList!: blessed.Widgets.ListElement;

  constructor(
    private root: blessed.Widgets.BoxElement,
    private screen: blessed.Widgets.Screen,
    private onSelect: (env: string) => void,
  ) {
    super();
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.addWorldMap();
    this.addEnvironmentSelector();

    // ensure focus is on our list so arrows work
    this.envList.focus();

    this.screen.render();
  }

  private addWorldMap() {
    this.grid.set(0, 0, 12, 12, contrib.map, {});
  }

  private addEnvironmentSelector() {
    // create the list itself, not a box + child
    this.envList = this.grid.set(4, 4, 4, 4, blessed.list, {
      label: "Select Environment (use j, k, or arrows)",
      border: "line",
      padding: { left: 1, right: 1 },
      keys: true, // allow ↑/↓ navigation
      mouse: true, // allow clicking
      items: ["Dev", "Staging", "Prod"],
      style: {
        selected: {
          bg: "blue", // background of highlighted item
          fg: "white", // text color of highlighted
        },
        item: {
          hover: {
            bg: "gray", // optional: hover color
          },
        },
      },
    });

    this.envList.key(["j"], () => {
      this.envList.move(1);
      this.screen.render();
    });
    this.envList.key(["k"], () => {
      this.envList.move(-1);
      this.screen.render();
    });

    // when user hits Enter on an item
    this.envList.on("select", (item) => {
      const env = item.getContent();
      this.onSelect(env);
      logger("env: ", env);
      // do something with the chosen environment...
      // e.g. this.emit("env-changed", env);
      // then re-render if needed:
      this.screen.render();
    });
  }

  destroy(): void {
    this.envList.destroy();
    this.root.destroy();
  }
}
