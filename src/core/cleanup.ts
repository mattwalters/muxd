import blessed from "blessed";
import { ProcessManager } from "../process/manager";
import { cleanupIPC, IPCController } from "../ipc";

// Register cleanup handlers for graceful shutdown
export function registerCleanupHandlers(
  screen: blessed.Widgets.Screen,
  processManager: ProcessManager,
  ipcController?: IPCController,
) {
  const cleanupFunction = () => {
    // Kill all processes
    processManager.cleanup();

    // Clean up IPC resources if available
    if (ipcController) {
      cleanupIPC(ipcController);
    }

    // Destroy the screen
    screen.destroy();

    // Exit the process
    process.exit(0);
  };

  // Register for keyboard interrupt
  screen.key(["escape", "q", "C-c"], cleanupFunction);

  // Register for process signals
  process.on("SIGINT", cleanupFunction);
  process.on("SIGTERM", cleanupFunction);

  return cleanupFunction;
}
