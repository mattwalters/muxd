#!/usr/bin/env node
import blessed from "blessed";
import { spawn, ChildProcess, exec, execSync } from "child_process";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import net from "net";
import { z } from "zod";
import yaml from "js-yaml";

// Set a simpler terminal to avoid some escape sequence issues.
process.env.TERM = "xterm";

// --- Configuration Interfaces ---
interface ReadyCheck {
  type: "command" | "url";
  command?: string;
  url?: string;
  interval?: number; // ms, default 1000
  timeout?: number; // ms, default 30000
}

interface ProcessConfig {
  name: string;
  cmd: string;
  args?: string[];
  dependsOn?: string[];
  ready?: ReadyCheck;
}

interface Config {
  services: ProcessConfig[];
  dockerCompose?: { file: string; profile?: string };
}

// --- Determine configuration file path ---
// Look for a "-C" flag and use that file; otherwise default to "muxd.config.json" in the current working directory.
const args = process.argv.slice(2);
let configFilePath: string;
const configFlagIndex = args.indexOf("-C");

if (configFlagIndex !== -1 && args[configFlagIndex + 1]) {
  configFilePath = path.resolve(process.cwd(), args[configFlagIndex + 1]);
} else {
  configFilePath = path.resolve(process.cwd(), "muxd.config.json");
}

if (!fs.existsSync(configFilePath)) {
  console.error("Configuration file not found:", configFilePath);
  process.exit(1);
}

const configContent = fs.readFileSync(configFilePath, "utf8");

// --- Zod Schemas for Config Validation ---
const ReadyCheckSchema = z.object({
  type: z.enum(["command", "url"]),
  command: z.string().optional(),
  url: z.string().optional(),
  interval: z.number().optional(),
  timeout: z.number().optional(),
});

const ProcessConfigSchema = z.object({
  name: z.string(),
  cmd: z.string(),
  args: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
  ready: ReadyCheckSchema.optional(),
});

// New schema for docker-compose support.
const DockerComposeSchema = z.object({
  file: z.string(), // relative or absolute path to docker-compose.yml
  profile: z.string().optional(),
});

const ConfigSchema = z.object({
  services: z.array(ProcessConfigSchema),
  dockerCompose: DockerComposeSchema.optional(),
});

// Validate the configuration with Zod.
const parsedConfig = ConfigSchema.safeParse(JSON.parse(configContent));
if (!parsedConfig.success) {
  console.error("Invalid configuration:", parsedConfig.error.format());
  process.exit(1);
}
const config = parsedConfig.data;

// --- Global state to track per-service mute/solo flags ---
// Each service is initialized with { mute: false, solo: false }.
const serviceFlags: Record<string, { mute: boolean; solo: boolean }> = {};
config.services.forEach((p) => {
  serviceFlags[p.name] = { mute: false, solo: false };
});

// --- If a dockerCompose file is specified, handle it.
if (config.dockerCompose) {
  console.log("Using docker compose...");
  const composePath = path.resolve(process.cwd(), config.dockerCompose.file);
  if (!fs.existsSync(composePath)) {
    console.error("Docker-compose file not found:", composePath);
    process.exit(1);
  }
  console.log(`Using docker-compose file: ${composePath}`);

  // Bring up docker services in detached mode.
  try {
    console.log("Starting docker compose services...");
    // Using docker compose (v2 syntax) instead of docker-compose.
    let profile = config.dockerCompose.profile ?? "";
    if (profile) {
      profile = ` --profile ${profile}`;
    }
    execSync(`docker compose${profile} -f "${composePath}" up -d`, {
      stdio: "inherit",
    });
  } catch (err: any) {
    console.error("Failed to start docker-compose services:", err.message);
    process.exit(1);
  }

  // Parse the docker-compose YAML to extract service names.
  try {
    const composeContent = fs.readFileSync(composePath, "utf8");
    const composeDoc: any = yaml.load(composeContent);
    if (
      composeDoc &&
      typeof composeDoc === "object" &&
      "services" in composeDoc
    ) {
      const services = Object.keys(composeDoc.services);
      // For each service that is not already defined in services, add a new ProcessConfig.
      services.forEach((serviceName) => {
        if (config.services.find((p) => p.name === serviceName)) return;
        config.services.push({
          name: serviceName,
          // Use docker compose to stream logs for the service.
          cmd: "docker",
          args: ["compose", "-f", composePath, "logs", "-f", serviceName],
        });
        // Initialize flags for the additional service.
        serviceFlags[serviceName] = { mute: false, solo: false };
      });
    } else {
      console.error(
        "docker-compose file does not contain a valid 'services' section.",
      );
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Error parsing docker-compose file:", err.message);
    process.exit(1);
  }
}

// --- Build a mapping for process configurations keyed by process name. ---
const processConfigs: Record<string, ProcessConfig> = {};
config.services.forEach((proc) => {
  processConfigs[proc.name] = proc;
});

// --- Color Mapping (unchanged) ---
const colorMapping: Record<string, string> = {
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#00FF00",
  blue: "#0000FF",
  magenta: "#FF00FF",
  cyan: "#00FFFF",
};

function getColorName(index: number): string {
  const keys = Object.keys(colorMapping);
  return keys[index % keys.length];
}

const assignedProcessColors: Record<string, string> = {};
config.services.forEach((p, i) => {
  const colorName = getColorName(i);
  assignedProcessColors[p.name] = colorMapping[colorName];
});

// --- Global Log & Filter Handling (unchanged except for new filtering) ---
interface LogEntry {
  process: string;
  text: string;
}

let allLogs: LogEntry[] = [];
let currentFilter: string = "";

function updateLogDisplay(): void {
  let entries = allLogs;

  // If any service is marked solo, only display logs from those services.
  const soloServices = Object.keys(serviceFlags).filter(
    (name) => serviceFlags[name].solo,
  );
  if (soloServices.length > 0) {
    entries = entries.filter((entry) => soloServices.includes(entry.process));
  }

  // Filter out logs from muted services.
  entries = entries.filter((entry) => !serviceFlags[entry.process]?.mute);

  if (currentFilter.trim() !== "") {
    try {
      const re = new RegExp(currentFilter, "gi");
      entries = entries.filter((entry) => {
        const plainLine = `[${entry.process}] ${entry.text}`;
        return re.test(plainLine);
      });
    } catch (err) {
      console.error("Invalid filter regex", err);
    }
  }
  const formattedLines = entries.map((entry) => {
    let line = assignedProcessColors[entry.process]
      ? chalk.hex(assignedProcessColors[entry.process])(`[${entry.process}] `) +
        entry.text
      : `[${entry.process}] ` + entry.text;
    if (currentFilter.trim() !== "") {
      try {
        const re = new RegExp(currentFilter, "gi");
        line = line.replace(re, (match) => chalk.bgYellow(match));
      } catch (err) {
        /* ignore */
      }
    }
    return line;
  });
  logBox.setContent(formattedLines.join("\n"));
  logBox.setScrollPerc(100);
  screen.render();
}

function addLogEntry(processName: string, text: string): void {
  const entry: LogEntry = { process: processName, text };
  allLogs.push(entry);
  updateLogDisplay();
  if (isMaster) {
    broadcast({ type: "log", data: entry });
  }
}

// --- Blessed UI Setup (unchanged) ---
const screen = blessed.screen({
  smartCSR: true,
  fastCSR: true,
  title: "Muxd Log Viewer",
});

const logBox = blessed.box({
  top: 0,
  left: 0,
  width: "100%",
  height: "100%-1",
  border: { type: "line" },
  scrollbar: { ch: " " },
  alwaysScroll: true,
  scrollable: true,
  keys: true,
  mouse: true,
  vi: true,
  label: " Logs ",
  content: "",
});

const statusBar = blessed.box({
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  content:
    "Press 'q' to quit. '/' to filter, 's' for solo process modal, 'r' to restart, 'f' for service control.",
  style: { fg: "white", bg: "blue" },
});

screen.append(logBox);
screen.append(statusBar);

// --- Process Readiness State ---
const processStatus: Record<string, boolean> = {};
config.services.forEach((proc) => {
  processStatus[proc.name] = false;
});

// --- Helper: Wait for Dependencies ---
function waitForDependencies(deps: string[]): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const allReady = deps.every((dep) => processStatus[dep] === true);
      if (allReady) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}

// --- Helper: Wait for Ready Check ---
function waitForReadyCheck(check: ReadyCheck): Promise<void> {
  return new Promise((resolve, reject) => {
    const intervalMs = check.interval || 1000;
    const timeoutMs = check.timeout || 30000;
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Ready check timed out"));
        return;
      }
      if (check.type === "command" && check.command) {
        exec(check.command, (error) => {
          if (!error) {
            clearInterval(interval);
            resolve();
          }
        });
      } else if (check.type === "url" && check.url) {
        const lib = check.url.startsWith("https") ? https : http;
        lib
          .get(check.url, (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              clearInterval(interval);
              resolve();
            }
          })
          .on("error", () => {
            /* ignore */
          });
      } else {
        clearInterval(interval);
        reject(new Error("Invalid ready check configuration"));
      }
    }, intervalMs);
  });
}

function launchProcess(procConfig: ProcessConfig): ChildProcess {
  const proc = spawn(procConfig.cmd, procConfig.args ?? [], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  proc.stdout.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim() !== "") {
        addLogEntry(procConfig.name, line.trimEnd());
      }
    });
  });

  proc.stderr.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim() !== "") {
        addLogEntry(procConfig.name, "ERROR: " + line.trimEnd());
      }
    });
  });

  proc.on("close", (code) => {
    addLogEntry(procConfig.name, `exited with code ${code}`);
    delete runningProcessesMap[procConfig.name];
    // Optionally mark the process as not running.
    processStatus[procConfig.name] = false;
  });

  return proc;
}

const runningProcessesMap: Record<string, ChildProcess> = {};

async function startProcess(procConfig: ProcessConfig): Promise<ChildProcess> {
  if (procConfig.dependsOn && procConfig.dependsOn.length > 0) {
    addLogEntry(
      procConfig.name,
      `Waiting for dependencies: ${procConfig.dependsOn.join(", ")}`,
    );
    await waitForDependencies(procConfig.dependsOn);
    addLogEntry(procConfig.name, "Dependencies are ready.");
  }
  const proc = launchProcess(procConfig);
  runningProcessesMap[procConfig.name] = proc;
  // Mark process as running (true) immediately.
  processStatus[procConfig.name] = true;
  if (procConfig.ready) {
    addLogEntry(procConfig.name, "Performing ready check...");
    try {
      await waitForReadyCheck(procConfig.ready);
      addLogEntry(procConfig.name, "Ready check passed.");
    } catch (err: any) {
      addLogEntry(procConfig.name, `Ready check failed: ${err.message}`);
    }
  } else {
    addLogEntry(procConfig.name, "No ready check defined; marking as ready.");
  }
  return proc;
}

// --- Functions for Service Control Modal ---
// Helper to return formatted text for the service list with state.
function getServiceItemText(proc: ProcessConfig): string {
  const isRunning = runningProcessesMap[proc.name] ? "Running" : "Stopped";
  const flags = [];
  if (serviceFlags[proc.name].mute) {
    flags.push("Muted");
  }
  if (serviceFlags[proc.name].solo) {
    flags.push("Solo");
  }
  const flagText = flags.length ? ` (${flags.join(", ")})` : "";
  return `${proc.name} - ${isRunning}${flagText}`;
}

// Toggle mute flag for the service at the selected list index.
function toggleMuteForSelected(list: blessed.Widgets.ListElement) {
  console.log("list", list);
  const index = (list as any).selected;
  if (index < 0 || index >= config.services.length) return;
  const proc = config.services[index];
  serviceFlags[proc.name].mute = !serviceFlags[proc.name].mute;
  addLogEntry(
    "SYSTEM",
    `${proc.name} is now ${serviceFlags[proc.name].mute ? "muted" : "unmuted"}.`,
  );
  list.setItem(index, getServiceItemText(proc));
  updateLogDisplay();
  screen.render();
}

// Toggle solo flag for the service at the selected list index.
function toggleSoloForSelected(list: blessed.Widgets.ListElement) {
  console.log("list", list);
  const index = (list as any).selected;
  if (index < 0 || index >= config.services.length) return;
  const proc = config.services[index];
  serviceFlags[proc.name].solo = !serviceFlags[proc.name].solo;
  addLogEntry(
    "SYSTEM",
    `${proc.name} is now ${serviceFlags[proc.name].solo ? "solo" : "unsolo"}.`,
  );
  list.setItem(index, getServiceItemText(proc));
  updateLogDisplay();
  screen.render();
}

// Opens a modal list showing all services with their current state.
// Within the modal, use j/k to navigate and press "m" to toggle mute or "s" to toggle solo.
function openServiceControlModal() {
  const items = config.services.map((proc) => getServiceItemText(proc));
  const list = blessed.list({
    parent: screen,
    border: "line",
    label: " Service Control (m: mute, s: solo) ",
    width: "50%",
    height: config.services.length + 4,
    top: "center",
    left: "center",
    items: items,
    keys: true,
    vi: true,
    mouse: true,
    style: { selected: { bg: "blue" } },
  });
  list.focus();
  // Bind mute and solo actions within the modal.
  list.key("m", () => {
    toggleMuteForSelected(list);
  });
  list.key("s", () => {
    toggleSoloForSelected(list);
  });
  // Allow closing the modal.
  list.key(["escape", "q"], () => {
    list.destroy();
    screen.render();
  });
  screen.render();
}

// Bind key "f" to open the new service control modal.
screen.key("f", openServiceControlModal);

// --- Key Bindings & Cleanup ---
function cleanup() {
  Object.values(runningProcessesMap).forEach((proc) => {
    try {
      if (!proc.killed) proc.kill();
    } catch (err) {}
  });
  if (isMaster) {
    ipcServer?.close();
    try {
      fs.unlinkSync(sockPath);
    } catch (err) {}
  }
  screen.destroy();
  process.exit(0);
}

screen.key(["escape", "q", "C-c"], cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

screen.key("/", () => {
  const prompt = blessed.prompt({
    parent: screen,
    border: "line",
    height: "shrink",
    width: "50%",
    top: "center",
    left: "center",
    label: " Filter Logs ",
    tags: true,
    keys: true,
    vi: true,
  });
  prompt.input("Regex filter:", currentFilter, (err, value) => {
    if (value !== undefined) currentFilter = value.trim();
    prompt.destroy();
    updateLogDisplay();
  });
});

screen.key("r", () => {
  const choices = config.services.map((p) => p.name);
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
  list.once("select", (item, index) => {
    list.destroy();
    const processName = choices[index];
    restartProcess(processName);
  });
  screen.render();
});

function restartProcess(processName: string): void {
  const procConfig = processConfigs[processName];
  if (!procConfig) {
    addLogEntry("SYSTEM", `Configuration for ${processName} not found.`);
    return;
  }
  addLogEntry("SYSTEM", `Restarting process ${processName}...`);
  const currentProc = runningProcessesMap[processName];
  if (currentProc) {
    try {
      currentProc.kill();
    } catch (err) {
      console.error("Error killing process", processName, err);
    }
  }
  startProcess(procConfig).catch((err) => {
    addLogEntry("SYSTEM", `Failed to restart ${processName}: ${err.message}`);
  });
}

// --- IPC (Master/Client) Implementation using a Unix Domain Socket ---
const sockPath = path.join("/tmp", "muxd.sock");
let isMaster = false;
let ipcServer: net.Server | null = null;
const ipcClients: net.Socket[] = [];

// Broadcast a JSON message to all connected IPC clients.
function broadcast(message: any) {
  const json = JSON.stringify(message);
  ipcClients.forEach((client) => {
    client.write(json + "\n");
  });
}

// --- Master Server Mode ---
function startMaster() {
  isMaster = true;
  // Remove any stale socket.
  try {
    fs.unlinkSync(sockPath);
  } catch (err) {
    /* ignore */
  }
  ipcServer = net.createServer((socket) => {
    ipcClients.push(socket);
    // When a client connects, immediately send the full log history.
    const historyMessage = JSON.stringify({ type: "history", data: allLogs });
    socket.write(historyMessage + "\n");
    socket.on("data", (data) => {
      try {
        const message = JSON.parse(data.toString());
        // Process client commands (if any). For now, we just log them.
        addLogEntry(
          "SYSTEM",
          `Received command from client: ${JSON.stringify(message)}`,
        );
      } catch (err) {
        addLogEntry("SYSTEM", `Error parsing IPC message: ${err}`);
      }
    });
    socket.on("close", () => {
      const index = ipcClients.indexOf(socket);
      if (index !== -1) ipcClients.splice(index, 1);
    });
  });
  ipcServer.listen(sockPath, () => {
    addLogEntry("SYSTEM", `IPC server listening on ${sockPath}`);
  });

  // In master mode, launch services as before.
  (async () => {
    for (const procConfig of config.services) {
      addLogEntry(procConfig.name, "Starting process...");
      try {
        await startProcess(procConfig);
      } catch (err: any) {
        addLogEntry(procConfig.name, `Failed to start: ${err.message}`);
      }
    }
    addLogEntry(
      "SYSTEM",
      `Started ${config.services.length} services. Logs will appear below.`,
    );
  })();
}

// --- Client Mode ---
function startClient(client: net.Socket) {
  isMaster = false;
  addLogEntry("SYSTEM", `Connected to muxd master via ${sockPath}`);
  client.on("data", (data) => {
    // Assume each JSON message is separated by a newline.
    const messages = data
      .toString()
      .split("\n")
      .filter((m) => m.trim() !== "");
    for (const msg of messages) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === "history" && Array.isArray(parsed.data)) {
          // Replace our log history with the full history from the master.
          allLogs = parsed.data;
          updateLogDisplay();
        } else if (parsed.type === "log" && parsed.data) {
          allLogs.push(parsed.data);
          updateLogDisplay();
        }
      } catch (err) {
        console.error("Error parsing IPC message from master:", err);
      }
    }
  });
}

// --- IPC Startup Logic ---
// Try to connect as a client.
const clientSocket = net.createConnection({ path: sockPath }, () => {
  // If we connect, run as client.
  startClient(clientSocket);
});
clientSocket.on("error", (err) => {
  // If connection fails, assume no master is running.
  startMaster();
});
