import path from "path";
import net from "net";
import { LogStore } from "../log/store";
import { startMaster, MasterController } from "./master";
import { startClient } from "./client";

const sockPath = path.join("/tmp", "muxd.sock");

// Define the return type interface with consistent properties
export interface IPCController {
  isMaster: boolean;
  masterController?: MasterController;
  clientController?: {
    socket: net.Socket;
    sendCommand: (command: any) => void;
  };
}

// Initialize IPC as either master or client
export async function initializeIPC(
  logStore: LogStore,
): Promise<IPCController> {
  return new Promise<IPCController>((resolve) => {
    // Try to connect as a client
    const clientSocket = net.createConnection({ path: sockPath }, () => {
      // If we connect, run as client
      const clientController = startClient(clientSocket, logStore);
      resolve({
        isMaster: false,
        clientController,
      });
    });

    clientSocket.on("error", () => {
      // If connection fails, assume no master is running
      const masterController = startMaster(sockPath, logStore);
      resolve({
        isMaster: true,
        masterController,
      });
    });
  });
}

// Clean up IPC resources
export function cleanupIPC(controller: IPCController) {
  if (controller.isMaster && controller.masterController) {
    controller.masterController.server.close();
    try {
      const fs = require("fs");
      fs.unlinkSync(sockPath);
    } catch (err) {
      // Ignore errors
    }
  } else if (!controller.isMaster && controller.clientController) {
    controller.clientController.socket.end();
  }
}
