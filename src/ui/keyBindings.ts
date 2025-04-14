import blessed from "blessed";
import { ProcessManager } from "../process/manager";
import { LogStore } from "../log/store";
import { FilterPrompt } from "./filterPrompt";
import { ServiceControlModal } from "./serviceModal";
import { Config } from "../config/schema";
import { UIComponents } from "../types";

export function setupKeyBindings(
  ui: UIComponents,
  processManager: ProcessManager,
  logStore: LogStore,
  config: Config,
) {
  const { screen, logBox } = ui;

  // Create UI components
  const filterPrompt = new FilterPrompt(screen, logStore);
  const serviceModal = new ServiceControlModal(screen, processManager);

  // Exit key binding (q, Escape, Ctrl+C)
  screen.key(["escape", "q", "C-c"], () => {
    cleanup(screen, processManager);
  });

  // Filter key binding (/)
  screen.key("/", () => {
    filterPrompt.open();
  });

  // Service control key binding (f)
  screen.key("f", () => {
    serviceModal.open(config.services);
  });

  // Restart process key binding (r)
  screen.key("r", () => {
    // Create a list of process names
    const choices = config.services.map((p) => p.name);

    // Create and show a list for process selection
    const list = blessed.list({
      parent: screen,
      border: "line",
      label: " Restart Process (Select One) ",
      width: "50%",
      height: choices.length + 2,
      top: "center",
      left: "center",
      items: choices,
      keys: true,
      vi: true,
      mouse: true,
      style: { selected: { bg: "blue" } },
    });

    list.focus();

    // Handle process selection
    list.once("select", (_item, index) => {
      list.destroy();
      const processName = choices[index];
      processManager.restartProcess(processName);
    });

    screen.render();
  });

  // Scrolling key bindings
  screen.key(["up", "k"], () => {
    logBox.scrollUp(1);
  });

  screen.key(["down", "j"], () => {
    logBox.scrollDown(1);
  });

  screen.key(["pageup", "b"], () => {
    logBox.pageUp();
  });

  screen.key(["pagedown", "f"], () => {
    logBox.pageDown();
  });

  screen.key(["home", "g"], () => {
    logBox.scrollToTop();
  });

  screen.key(["end", "G"], () => {
    logBox.scrollToBottom();
  });
}

// Cleanup function to handle exit
export function cleanup(
  screen: blessed.Widgets.Screen,
  processManager: ProcessManager,
) {
  processManager.cleanup();
  screen.destroy();
  process.exit(0);
}
