import { loadConfig } from "../config/loader";
import { setupScreen } from "../ui/screen";
import { setupKeyBindings } from "../ui/keyBindings";
import { ProcessManager } from "../process/manager";
import { LogStore } from "../log/store";
import { initializeIPC, IPCController } from "../ipc";
import { registerCleanupHandlers } from "./cleanup";
import { UIComponents } from "../types"; // Import the UIComponents interface

export class App {
  private config;
  private ui: UIComponents;
  private logStore;
  private processManager;
  private ipcController: IPCController | null = null;

  constructor() {
    // Load configuration
    this.config = loadConfig();
    console.log("this.config", this.config);

    // Initialize the UI and store all UI components
    this.ui = setupScreen();
    console.log("lol");

    // Initialize the log store
    this.logStore = new LogStore();

    // Initialize the process manager
    this.processManager = new ProcessManager(this.config, this.logStore);

    // Setup key bindings
    setupKeyBindings(this.ui, this.processManager, this.logStore, this.config);

    // Register cleanup handlers (we'll update this after IPC is initialized)
    this.registerBasicCleanupHandlers();
  }

  async start() {
    // Initialize IPC (master or client mode)
    this.ipcController = await initializeIPC(this.logStore);
    console.log("ipcController", this.ipcController);

    // Update cleanup handlers with IPC controller
    this.registerFullCleanupHandlers();

    if (this.ipcController.isMaster) {
      // Start all services in master mode
      await this.processManager.startAllProcesses();
      this.logStore.addSystemLog(
        `Started ${this.config.services.length} services. Logs will appear below.`,
      );
    }
  }

  private registerBasicCleanupHandlers() {
    registerCleanupHandlers(this.ui.screen, this.processManager);
  }

  private registerFullCleanupHandlers() {
    if (this.ipcController) {
      registerCleanupHandlers(
        this.ui.screen,
        this.processManager,
        this.ipcController,
      );
    }
  }
}
