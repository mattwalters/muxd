import blessed from "blessed";
import { LogBox } from "./logBox";
import { StatusBar } from "./statusBar";
import { StatusBox } from "./statusBox";
import { ProcessManager } from "../process/manager";
import { LogStore } from "../log/store";
import { FilterPrompt } from "./filterPrompt";
import { ServiceControlModal } from "./serviceModal";

// Setup the main blessed screen
export function setupScreen(
  processManager: ProcessManager,
  logStore: LogStore,
) {
  const screen = blessed.screen({
    smartCSR: true,
    fastCSR: true,
    title: "Muxd Log Viewer",
  });
  const logBox = new LogBox(screen, processManager);
  const statusBox = new StatusBox(screen);
  const statusBar = new StatusBar(screen);
  const filterPrompt = new FilterPrompt(screen, logStore);
  const serviceModal = new ServiceControlModal(screen, processManager);

  // Return the screen and components
  screen.render();
  return {
    screen,
    logBox,
    statusBox,
    statusBar,
    filterPrompt,
    serviceModal,
  };
}
