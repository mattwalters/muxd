import blessed from "blessed";
import { ProcessManager } from "../process/manager";
import { ProcessConfig } from "../config/schema";

export class ServiceControlModal {
  private screen: blessed.Widgets.Screen;
  private processManager: ProcessManager;
  private modal: blessed.Widgets.ListElement | null = null;

  constructor(screen: blessed.Widgets.Screen, processManager: ProcessManager) {
    this.screen = screen;
    this.processManager = processManager;
  }

  // Open the service control modal
  open(services: ProcessConfig[]): void {
    // Close any existing modal
    if (this.modal) {
      this.close();
    }

    // Format service items with their current state
    const items = services.map((proc) => this.getServiceItemText(proc));

    // Create the list modal
    this.modal = blessed.list({
      parent: this.screen,
      border: "line",
      label: " Service Control (m: mute, s: solo, r: restart) ",
      width: "50%",
      height: services.length + 4,
      top: "center",
      left: "center",
      items: items,
      keys: true,
      vi: true,
      mouse: true,
      style: { selected: { bg: "blue" } },
    });

    // Focus the modal
    this.modal.focus();

    // Bind key handlers
    this.bindKeys(services);

    // Render the screen
    this.screen.render();
  }

  // Close the modal
  close(): void {
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
      this.screen.render();
    }
  }

  isOpen(): boolean {
    return !!this.modal;
  }

  // Bind key handlers to the modal
  private bindKeys(services: ProcessConfig[]): void {
    if (!this.modal) return;

    // Toggle mute
    this.modal.key("m", () => {
      this.toggleMuteForSelected(services);
    });

    // Toggle solo
    this.modal.key("s", () => {
      this.toggleSoloForSelected(services);
    });

    // Restart service
    this.modal.key("r", () => {
      this.restartSelected(services);
    });

    // Close the modal
    this.modal.key(["escape", "q"], () => {
      this.close();
    });
  }

  // Toggle mute for the selected service
  private toggleMuteForSelected(services: ProcessConfig[]): void {
    if (!this.modal) return;
    const index = (this.modal as any).selected;
    if (index < 0 || index >= services.length) return;

    const proc = services[index];
    this.processManager.toggleMute(proc.name);

    // Update the item text
    this.modal.setItem(index, this.getServiceItemText(proc));
    this.screen.render();
  }

  // Toggle solo for the selected service
  private toggleSoloForSelected(services: ProcessConfig[]): void {
    if (!this.modal) return;
    const index = (this.modal as any).selected;
    if (index < 0 || index >= services.length) return;

    const proc = services[index];
    this.processManager.toggleSolo(proc.name);

    // Update the item text
    this.modal.setItem(index, this.getServiceItemText(proc));
    this.screen.render();
  }

  // Restart the selected service
  private restartSelected(services: ProcessConfig[]): void {
    if (!this.modal) return;
    const index = (this.modal as any).selected;
    if (index < 0 || index >= services.length) return;

    const proc = services[index];
    this.processManager.restartProcess(proc.name);
    this.close();
  }

  // Format the list item text for a service
  private getServiceItemText(proc: ProcessConfig): string {
    const flags = this.processManager.getServiceFlags(proc.name);
    const isRunning = "Running"; // This could be dynamic based on process status

    const flagTexts = [];
    if (flags.mute) {
      flagTexts.push("Muted");
    }
    if (flags.solo) {
      flagTexts.push("Solo");
    }

    const flagText = flagTexts.length ? ` (${flagTexts.join(", ")})` : "";
    return `${proc.name} - ${isRunning}${flagText}`;
  }
}
