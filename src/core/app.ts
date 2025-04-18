import { loadConfig } from "../config/loader";
import blessed from "blessed";
import { setupScreen } from "../ui/screen";
import { Config } from "../config/schema";
import { ProcessManager } from "../process/manager";
import { LogStore } from "../log/store";
import { initializeIPC, IPCController } from "../ipc";
import { registerCleanupHandlers } from "./cleanup";
import { UIComponents } from "../types";

export class App {
  private config;
  private ui: UIComponents;
  private logStore;
  private processManager;
  private ipcController: IPCController | null = null;

  constructor() {
    this.config = loadConfig();
    this.logStore = new LogStore();
    this.processManager = new ProcessManager(this.config, this.logStore);
    this.ui = setupScreen(this.processManager, this.logStore);

    this.setupKeyBindings(this.ui, this.processManager, this.config);

    this.setupProcessSubscriptions();
    this.setupLogSubscriptions();

    // Register cleanup handlers (we'll update this after IPC is initialized)
    this.registerBasicCleanupHandlers();
  }

  async start() {
    // Initialize IPC (master or client mode)
    this.ipcController = await initializeIPC(this.logStore);

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
  private setupKeyBindings(
    ui: UIComponents,
    processManager: ProcessManager,
    config: Config,
  ) {
    const { screen, logBox, filterPrompt, serviceModal } = ui;

    // Exit key binding (q, Escape, Ctrl+C)
    screen.key(["escape", "q", "C-c"], () => {
      this.cleanup(screen, processManager);
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
  private cleanup(
    screen: blessed.Widgets.Screen,
    processManager: ProcessManager,
  ) {
    processManager.cleanup();
    screen.destroy();
    process.exit(0);
  }
}
