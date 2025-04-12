import * as blessed from "blessed";
import { spawn, ChildProcess } from "child_process";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

// Use a simpler terminal type to avoid xterm-256color issues.
process.env.TERM = "xterm";

// Define the config interfaces.
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

// Global storage for all log lines.
let allLogs: string[] = [];
// Current filter string (as a regular expression) – empty means no filtering.
let currentFilter: string = "";

// Update the log display based on the current filter.
function updateLogDisplay(): void {
  let lines = allLogs;
  if (currentFilter.trim() !== "") {
    try {
      // Create a regular expression using the filter string.
      const re = new RegExp(currentFilter, "gi");
      // Filter lines to only those that match.
      lines = allLogs.filter((line) => re.test(line));
      // Replace matching parts with highlighted version.
      lines = lines.map((line) =>
        line.replace(re, (match) => chalk.bgYellow(match)),
      );
    } catch (err) {
      // If the regex is invalid, ignore filtering.
      // You could also choose to notify the user.
      console.error("Invalid filter regex", err);
    }
  }
  // Set the log box content to the filtered lines.
  logBox.setContent(lines.join("\n"));
  screen.render();
}

// Create a Blessed screen with proper terminal handling.
const screen = blessed.screen({
  smartCSR: true,
  fastCSR: true,
  title: "Dev Tool Log Viewer",
});

// Create a log box widget that covers most of the screen.
// We use a basic box (not blessed.log) so that we can update its content.
const logBox = blessed.box({
  top: 0,
  left: 0,
  width: "100%",
  height: "100%-1", // Leave space at the bottom for a status bar.
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

// Create a status bar widget at the bottom.
const statusBar = blessed.box({
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  content: "Press 'q' to quit. Press '/' to filter logs.",
  style: {
    fg: "white",
    bg: "blue",
  },
});

// Append the widgets to the screen.
screen.append(logBox);
screen.append(statusBar);

// Render the initial screen.
screen.render();

// Keep track of spawned processes.
const runningProcesses: ChildProcess[] = [];

// Function to kill all processes and exit cleanly.
function cleanup() {
  for (const proc of runningProcesses) {
    try {
      if (!proc.killed) {
        proc.kill();
      }
    } catch (err) {
      // Ignore errors when killing processes.
    }
  }
  screen.destroy();
  process.exit(0);
}

// Bind keys to quit the application.
screen.key(["escape", "q", "C-c"], cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Bind the "/" key to show a prompt for filter input.
screen.key("/", () => {
  // Create a prompt widget.
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
  prompt.input("Filter (regex):", "", (err, value) => {
    if (value == null) {
      // If no value entered, do nothing.
      prompt.destroy();
      screen.render();
      return;
    }
    // Update the global filter.
    currentFilter = value.trim();
    updateLogDisplay();
    prompt.destroy();
    screen.render();
  });
});

// Helper function to add a log line (both to our store and the UI).
function addLogLine(line: string): void {
  allLogs.push(line);
  updateLogDisplay();
}

// Launch each process using the configuration from config.json.
config.processes.forEach((procConfig, index) => {
  const colorName = getColorName(index);
  const hexColor = colorMapping[colorName];

  addLogLine(chalk.hex(hexColor)(`[${procConfig.name}] Starting process...`));

  const proc = spawn(procConfig.cmd, procConfig.args ?? [], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  runningProcesses.push(proc);

  // Handle stdout.
  proc.stdout.on("data", (data: Buffer) => {
    const line =
      chalk.hex(hexColor)(`[${procConfig.name}] `) + data.toString().trimEnd();
    addLogLine(line);
  });

  // Handle stderr.
  proc.stderr.on("data", (data: Buffer) => {
    const line =
      chalk.hex(hexColor)(`[${procConfig.name} ERROR] `) +
      data.toString().trimEnd();
    addLogLine(line);
  });

  // Process exit event.
  proc.on("close", (code) => {
    const line = chalk.hex(hexColor)(
      `[${procConfig.name}] exited with code ${code}`,
    );
    addLogLine(line);
    const i = runningProcesses.indexOf(proc);
    if (i !== -1) {
      runningProcesses.splice(i, 1);
    }
  });
});

// Log initial status.
addLogLine(
  chalk.white(
    `Started ${config.processes.length} processes. Logs will appear below.`,
  ),
);
