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
    console.log("setupScreen");

    // Initialize the log store
    this.logStore = new LogStore();
    console.log("logstore");

    // Initialize the process manager
    this.processManager = new ProcessManager(this.config, this.logStore);
    console.log("processManager", this.processManager);

    // Setup key bindings
    setupKeyBindings(this.ui, this.processManager, this.logStore, this.config);

    // Connect log store events to UI
    this.setupLogHandlers();
    this.setupProcessHandlers();

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

  private setupProcessHandlers() {
    this.processManager.on(
      this.processManager.STATUS_CHANGE_EVENT_NAME,
      (processName, isRunning) => {
        this.ui.statusBox.updateStatus(processName, isRunning);
      },
    );
  }

  private setupLogHandlers() {
    // Initialize color map for process names
    this.ui.logBox.initColorMap(this.config.services.map((s) => s.name));

    // Update logs when added or filter changes
    const updateLogs = () => {
      const filter = this.logStore.getFilter();
      const muteFilter = (entry: any) => {
        // If any service is solo, only show those
        const soloServices = Object.keys(
          this.processManager.getServiceFlags,
        ).filter((name) => this.processManager.getServiceFlags(name).solo);

        if (soloServices.length > 0) {
          return soloServices.includes(entry.process);
        }

        // Otherwise filter out muted services
        return !this.processManager.getServiceFlags(entry.process)?.mute;
      };

      this.ui.logBox.updateLogs(this.logStore.getLogs(), filter, muteFilter);
    };

    // Listen for log events
    this.logStore.on("logAdded", updateLogs);
    this.logStore.on("filterChanged", updateLogs);
    this.logStore.on("logsReplaced", updateLogs);

    // Initial log update
    updateLogs();
  }
}
