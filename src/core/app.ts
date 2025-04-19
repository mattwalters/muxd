import { loadConfig } from "../config/loader";
import blessed from "blessed";
import { setupScreen } from "../ui/screen";
import { ProcessManager } from "../process/manager";
import { LogStore } from "../log/store";
import { initializeIPC, IPCController, cleanupIPC } from "../ipc";
import { UIComponents } from "../types";

export class App {
  private config;
  private ui: UIComponents;
  private logStore;
  private processManager;
  private ipcController?: IPCController;

  constructor() {
    this.cleanup = this.cleanup.bind(this);
    this.config = loadConfig();
    this.logStore = new LogStore();
    this.processManager = new ProcessManager(this.config, this.logStore);
    this.ui = setupScreen(this.processManager, this.logStore);

    this.setupKeyBindings();
    this.setupProcessSubscriptions();
    this.setupLogSubscriptions();
    this.registerCleanupHandlers();
  }

  async start() {
    // Initialize IPC (master or client mode)
    this.ipcController = await initializeIPC(this.logStore);
    this.registerCleanupHandlers();

    if (this.ipcController.isMaster) {
      // Start all services in master mode
      await this.processManager.startAllProcesses();
      this.logStore.addSystemLog(
        `Started ${this.config.services.length} services. Logs will appear below.`,
      );
    }
  }

  private registerCleanupHandlers() {
    process.on("SIGINT", this.cleanup);
    process.on("SIGTERM", this.cleanup);
  }

  private setupProcessSubscriptions() {
    this.processManager.on(
      this.processManager.STATUS_CHANGE_EVENT_NAME,
      (processName: string, isRunning: boolean) => {
        this.ui.statusBox.updateStatus(processName, isRunning);
      },
    );
    this.processManager.forEachService((proc) => {
      this.ui.statusBox.initializeService(proc);
    });
  }

  private setupLogSubscriptions() {
    // Pass the process manager to the log box for color mapping
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
  private setupKeyBindings() {
    const { screen, logBox, filterPrompt, serviceModal, restartPrompt } =
      this.ui;

    // Exit key binding (q, Escape, Ctrl+C)
    screen.key(["escape", "q", "C-c"], () => {
      this.cleanup();
    });

    // Filter key binding (/)
    screen.key("/", () => {
      filterPrompt.open();
    });

    // Service control key binding (f)
    screen.key("f", () => {
      serviceModal.open(this.config.services);
    });

    // Restart process key binding (r)
    screen.key("r", () => {
      restartPrompt.open(this.config.services);
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
  private cleanup() {
    console.log("cleaning up");
    this.processManager.cleanup();
    if (this.ipcController) {
      cleanupIPC(this.ipcController);
    }
    this.ui.screen.destroy();
    process.exit(0);
  }
}
