import fs from "fs";
import net from "net";
import { LogStore } from "../log/store";
import { MessageProtocol } from "./protocol";

// Define the return type for startMaster
export interface MasterController {
  server: net.Server;
  broadcast: (message: any) => void;
}

// Start the IPC master server
export function startMaster(
  sockPath: string,
  logStore: LogStore,
): MasterController {
  // Remove any stale socket
  try {
    fs.unlinkSync(sockPath);
  } catch (err) {
    /* ignore */
  }

  // Track connected clients
  const clients: net.Socket[] = [];

  // Create server instance
  const server = net.createServer((socket) => {
    clients.push(socket);

    // When a client connects, immediately send the full log history
    const historyMessage = MessageProtocol.createHistoryMessage(
      logStore.getLogs(),
    );
    socket.write(JSON.stringify(historyMessage) + "\n");

    // Subscribe to the logAdded event to forward new logs to clients
    const logAddedHandler = (entry: any) => {
      const logMessage = MessageProtocol.createLogMessage(entry);
      socket.write(JSON.stringify(logMessage) + "\n");
    };

    logStore.on("logAdded", logAddedHandler);

    // Handle incoming messages from clients
    socket.on("data", (data) => {
      const messages = data
        .toString()
        .split("\n")
        .filter((m) => m.trim() !== "");

      for (const msg of messages) {
        try {
          const message = JSON.parse(msg);
          // Handle client commands (e.g., restart a process)
          logStore.addSystemLog(
            `Received command from client: ${JSON.stringify(message)}`,
          );

          // Process commands here
          // if (message.type === 'restart' && message.processName) {
          //   processManager.restartProcess(message.processName);
          // }
        } catch (err) {
          logStore.addSystemLog(`Error parsing IPC message: ${err}`);
        }
      }
    });

    // Handle client disconnection
    socket.on("close", () => {
      const index = clients.indexOf(socket);
      if (index !== -1) {
        clients.splice(index, 1);
      }

      // Remove the event listener
      logStore.off("logAdded", logAddedHandler);
    });
  });

  // Start listening on the socket
  server.listen(sockPath, () => {
    logStore.addSystemLog(`IPC server listening on ${sockPath}`);
  });

  // Helper function to broadcast a message to all clients
  const broadcast = (message: any) => {
    const json = JSON.stringify(message);
    clients.forEach((client) => {
      client.write(json + "\n");
    });
  };

  return { server, broadcast };
}
