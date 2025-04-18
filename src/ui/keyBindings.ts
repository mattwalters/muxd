import blessed from "blessed";
import { ProcessManager } from "../process/manager";
import { LogStore } from "../log/store";
import { FilterPrompt } from "./filterPrompt";
import { ServiceControlModal } from "./serviceModal";
import { Config } from "../config/schema";
import { UIComponents } from "../types";

// Cleanup function to handle exit
export function cleanup(
  screen: blessed.Widgets.Screen,
  processManager: ProcessManager,
) {
  processManager.cleanup();
  screen.destroy();
  process.exit(0);
}
