import * as blessed from "blessed";
import { spawn, ChildProcess, exec } from "child_process";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";

// Set a simpler terminal to avoid some escape sequence issues.
process.env.TERM = "xterm";

// --- Interfaces for configuration ---

interface ReadyCheck {
  type: "command" | "url";
  command?: string;
  url?: string;
  interval?: number; // in ms, default 1000
  timeout?: number; // in ms, default 30000
}

interface ProcessConfig {
  name: string;
  cmd: string;
  args?: string[];
  dependsOn?: string[];
  ready?: ReadyCheck;
}

interface Config {
  processes: ProcessConfig[];
}

// --- Load configuration ---
const configPath = path.resolve(__dirname, "config.json");
const configContent = fs.readFileSync(configPath, "utf8");
const config: Config = JSON.parse(configContent);

// Build a mapping for process configurations keyed by process name.
const processConfigs: Record<string, ProcessConfig> = {};
config.processes.forEach((proc) => {
  processConfigs[proc.name] = proc;
});

// --- Color mapping (unchanged) ---
const colorMapping: Record<string, string> = {
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#00FF00",
  blue: "#0000FF",
  magenta: "#FF00FF",
  cyan: "#00FFFF",
};

function getColorName(index: number): string {
  const colorKeys = Object.keys(colorMapping);
  return colorKeys[index % colorKeys.length];
}

const assignedProcessColors: Record<string, string> = {};
config.processes.forEach((p, i) => {
  const colorName = getColorName(i);
  assignedProcessColors[p.name] = colorMapping[colorName];
});

// --- Global log & filter handling (unchanged) ---
interface LogEntry {
  process: string;
  text: string;
}

let allLogs: LogEntry[] = [];
let currentFilter: string = "";
let soloProcess: string | null = null;

function updateLogDisplay(): void {
  let entries = allLogs;
  if (soloProcess) {
    entries = entries.filter((entry) => entry.process === soloProcess);
  }
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
        // Ignore regex errors here.
      }
    }
    return line;
  });
  logBox.setContent(formattedLines.join("\n"));
  screen.render();
}

function addLogEntry(processName: string, text: string): void {
  allLogs.push({ process: processName, text });
  updateLogDisplay();
}

// --- Create Blessed UI (unchanged) ---
const screen = blessed.screen({
  smartCSR: true,
  fastCSR: true,
  title: "Dev Tool Log Viewer",
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
  content: "Press 'q' to quit. '/' to filter, 's' to solo, 'r' to restart.",
  style: { fg: "white", bg: "blue" },
});

screen.append(logBox);
screen.append(statusBar);
screen.render();

// --- Process readiness state ---
const processStatus: Record<string, boolean> = {};
// Initially mark all as not ready.
config.processes.forEach((proc) => {
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
            // Ignore errors and continue polling
          });
      } else {
        clearInterval(interval);
        reject(new Error("Invalid ready check configuration"));
      }
    }, intervalMs);
  });
}

// --- Updated Process Launching ---

// Original launchProcess: attaches stdout/stderr listeners and returns the ChildProcess.
function launchProcess(procConfig: ProcessConfig): ChildProcess {
  const proc = spawn(procConfig.cmd, procConfig.args ?? [], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  proc.stdout.on("data", (data: Buffer) => {
    addLogEntry(procConfig.name, data.toString().trimEnd());
  });
  proc.stderr.on("data", (data: Buffer) => {
    addLogEntry(procConfig.name, "ERROR: " + data.toString().trimEnd());
  });
  proc.on("close", (code) => {
    addLogEntry(procConfig.name, `exited with code ${code}`);
    delete runningProcessesMap[procConfig.name];
  });
  return proc;
}

// Global mapping for running processes.
const runningProcessesMap: Record<string, ChildProcess> = {};

// New function: Start a process respecting dependencies and performing the ready check.
async function startProcess(procConfig: ProcessConfig): Promise<ChildProcess> {
  // If there are dependencies, wait until each is marked ready.
  if (procConfig.dependsOn && procConfig.dependsOn.length > 0) {
    addLogEntry(
      procConfig.name,
      `Waiting for dependencies: ${procConfig.dependsOn.join(", ")}`,
    );
    await waitForDependencies(procConfig.dependsOn);
    addLogEntry(procConfig.name, "Dependencies are ready.");
  }
  // Launch the process.
  const proc = launchProcess(procConfig);
  runningProcessesMap[procConfig.name] = proc;
  // If a ready check is defined, run it.
  if (procConfig.ready) {
    addLogEntry(procConfig.name, "Performing ready check...");
    try {
      await waitForReadyCheck(procConfig.ready);
      addLogEntry(procConfig.name, "Ready check passed.");
    } catch (err: any) {
      addLogEntry(procConfig.name, `Ready check failed: ${err.message}`);
    }
  } else {
    // No ready check: mark as ready immediately.
    addLogEntry(procConfig.name, "No ready check defined; marking as ready.");
  }
  processStatus[procConfig.name] = true;
  return proc;
}

// --- Key Bindings & Cleanup (unchanged) ---
function cleanup() {
  Object.values(runningProcessesMap).forEach((proc) => {
    try {
      if (!proc.killed) {
        proc.kill();
      }
    } catch (err) {}
  });
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
    if (value !== undefined) {
      currentFilter = value.trim();
    }
    prompt.destroy();
    updateLogDisplay();
  });
});

screen.key("s", () => {
  const choices = ["All processes", ...config.processes.map((p) => p.name)];
  const list = blessed.list({
    parent: screen,
    border: "line",
    label: " Solo Process (Select One) ",
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
    soloProcess = index === 0 ? null : choices[index];
    updateLogDisplay();
  });
  screen.render();
});

screen.key("r", () => {
  const choices = config.processes.map((p) => p.name);
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

// Function to restart a process by name.
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

// --- Launch Processes (Using our new startProcess function) ---
(async () => {
  for (const procConfig of config.processes) {
    addLogEntry(procConfig.name, "Starting process...");
    try {
      await startProcess(procConfig);
    } catch (err: any) {
      addLogEntry(procConfig.name, `Failed to start: ${err.message}`);
    }
  }
  addLogEntry(
    "SYSTEM",
    `Started ${config.processes.length} processes. Logs will appear below.`,
  );
})();
