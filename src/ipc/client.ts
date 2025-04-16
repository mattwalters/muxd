import net from "net";
import { LogStore } from "../log/store";
import { MessageProtocol } from "./protocol";

export interface ClientController {
  socket: net.Socket;
  sendCommand: (command: any) => void;
}

// Start the IPC client
export function startClient(
  clientSocket: net.Socket,
  logStore: LogStore,
): ClientController {
  logStore.addSystemLog(`Connected to muxd master`);

  // Handle incoming messages from the master
  clientSocket.on("data", (data) => {
    console.log("client is receiving data");
    // Assume each JSON message is separated by a newline
    const messages = data
      .toString()
      .split("\n")
      .filter((m) => m.trim() !== "");

    for (const msg of messages) {
      try {
        const parsed = JSON.parse(msg);

        if (parsed.type === "history" && Array.isArray(parsed.data)) {
          // Replace our log history with the full history from the master
          logStore.setLogs(parsed.data);
        } else if (parsed.type === "log" && parsed.data) {
          // Add a single log entry
          logStore.addLog(parsed.data.process, parsed.data.text);
        }
      } catch (err) {
        console.error("Error parsing IPC message from master:", err);
      }
    }
  });

  // Helper function to send a command to the master
  const sendCommand = (command: any) => {
    clientSocket.write(JSON.stringify(command) + "\n");
  };

  return {
    socket: clientSocket,
    sendCommand,
  };
}
