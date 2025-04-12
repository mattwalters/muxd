import * as blessed from "blessed";
import { spawn, ChildProcess } from "child_process";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

// Use a simpler terminal type to avoid some escape sequence issues.
process.env.TERM = "xterm";

// Define the configuration interfaces.
interface ProcessConfig {
  name: string;
  cmd: string;
  args?: string[];
}

interface Config {
  processes: ProcessConfig[];
}

// Load configuration from config.json.
const configPath = path.resolve(__dirname, "config.json");
const configContent = fs.readFileSync(configPath, "utf8");
const config: Config = JSON.parse(configContent);

// Build a mapping for process configurations keyed by process name.
const processConfigs: Record<string, ProcessConfig> = {};
config.processes.forEach((proc) => {
  processConfigs[proc.name] = proc;
});

// Explicit map between color names and hex codes.
const colorMapping: Record<string, string> = {
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#00FF00",
  blue: "#0000FF",
  magenta: "#FF00FF",
  cyan: "#00FFFF",
};

// Helper function to choose a color name for each process.
function getColorName(index: number): string {
  const colorKeys = Object.keys(colorMapping);
  return colorKeys[index % colorKeys.length];
}

// We'll keep a mapping from process name to its assigned hex color.
const assignedProcessColors: Record<string, string> = {};
config.processes.forEach((p, i) => {
  const colorName = getColorName(i);
  assignedProcessColors[p.name] = colorMapping[colorName];
});

// Define a log entry interface.
interface LogEntry {
  process: string;
  text: string;
}

// Global storage for all log entries.
let allLogs: LogEntry[] = [];

// Global state for filtering.
let currentFilter: string = ""; // regex filter (if any)
let soloProcess: string | null = null; // if set, only show logs from this process

// Update the log display based on the current filter and solo settings.
function updateLogDisplay(): void {
  let entries = allLogs;

  // If solo mode is active, filter by process.
  if (soloProcess) {
    entries = entries.filter((entry) => entry.process === soloProcess);
  }

  // If there's a regex filter active, filter the entries accordingly.
  if (currentFilter.trim() !== "") {
    try {
      const re = new RegExp(currentFilter, "gi");
      entries = entries.filter((entry) => {
        // Test against the plain line.
        const plainLine = `[${entry.process}] ${entry.text}`;
        return re.test(plainLine);
      });
    } catch (err) {
      console.error("Invalid filter regex", err);
    }
  }

  // Format each entry.
  const formattedLines = entries.map((entry) => {
    let line = "";
    // If we have an assigned color for this process, prefix with it.
    if (assignedProcessColors[entry.process]) {
      line =
        chalk.hex(assignedProcessColors[entry.process])(`[${entry.process}] `) +
        entry.text;
    } else {
      line = `[${entry.process}] ` + entry.text;
    }
    // If a regex filter is active, highlight matching parts.
    if (currentFilter.trim() !== "") {
      try {
        const re = new RegExp(currentFilter, "gi");
        line = line.replace(re, (match) => chalk.bgYellow(match));
      } catch (err) {
        // Ignore invalid regex errors.
      }
    }
    return line;
  });
  // Update the log box content.
  logBox.setContent(formattedLines.join("\n"));
  screen.render();
}

// Helper to add a log entry.
function addLogEntry(processName: string, text: string): void {
  allLogs.push({ process: processName, text });
  updateLogDisplay();
}

// Create a Blessed screen.
const screen = blessed.screen({
  smartCSR: true,
  fastCSR: true,
  title: "Dev Tool Log Viewer",
});

// Create a log box widget.
const logBox = blessed.box({
  top: 0,
  left: 0,
  width: "100%",
  height: "100%-1",
  border: { type: "line" },
  scrollbar: {
    ch: " ",
  },
  alwaysScroll: true,
  scrollable: true,
  keys: true,
  mouse: true,
  vi: true,
  label: " Logs ",
  content: "",
});

// Create a status bar widget.
const statusBar = blessed.box({
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  content:
    "Press 'q' to quit. Press '/' to filter. Press 's' to solo a process. Press 'r' to restart a process.",
  style: {
    fg: "white",
    bg: "blue",
  },
});

// Append widgets to the screen.
screen.append(logBox);
screen.append(statusBar);
screen.render();

// Keep track of running processes in a mapping.
const runningProcessesMap: Record<string, ChildProcess> = {};

// Cleanup function: kill all processes and exit.
function cleanup() {
  Object.values(runningProcessesMap).forEach((proc) => {
    try {
      if (!proc.killed) {
        proc.kill();
      }
    } catch (err) {
      // ignore errors
    }
  });
  screen.destroy();
  process.exit(0);
}
screen.key(["escape", "q", "C-c"], cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Bind "/" key to set a regex filter.
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

// Bind "s" key to solo a process.
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
    style: {
      selected: {
        bg: "blue",
      },
    },
  });
  list.focus();
  list.once("select", (item, index) => {
    list.destroy();
    if (index === 0) {
      soloProcess = null;
    } else {
      soloProcess = choices[index];
    }
    updateLogDisplay();
  });
  screen.render();
});

// Bind "r" key to restart a process.
screen.key("r", () => {
  // List processes available for restart.
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
    style: {
      selected: {
        bg: "blue",
      },
    },
  });
  list.focus();
  list.once("select", (item, index) => {
    list.destroy();
    const processName = choices[index];
    restartProcess(processName);
  });
  screen.render();
});

// Function to launch a process given its configuration.
function launchProcess(procConfig: ProcessConfig): ChildProcess {
  const proc = spawn(procConfig.cmd, procConfig.args ?? [], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  // Attach listeners.
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

// Function to restart a process by name.
function restartProcess(processName: string): void {
  const procConfig = processConfigs[processName];
  if (!procConfig) {
    addLogEntry(
      "SYSTEM",
      `Process configuration for ${processName} not found.`,
    );
    return;
  }
  addLogEntry("SYSTEM", `Restarting process ${processName}...`);
  // Kill the current process if it's running.
  const currentProc = runningProcessesMap[processName];
  if (currentProc) {
    try {
      currentProc.kill();
    } catch (err) {
      console.error("Error killing process", processName, err);
    }
  }
  // Launch a new process instance.
  const newProc = launchProcess(procConfig);
  runningProcessesMap[processName] = newProc;
}

// Launch each process initially.
config.processes.forEach((procConfig) => {
  addLogEntry(procConfig.name, "Starting process...");
  const proc = launchProcess(procConfig);
  runningProcessesMap[procConfig.name] = proc;
});

// Log initial status.
addLogEntry(
  "SYSTEM",
  `Started ${config.processes.length} processes. Logs will appear below.`,
);
