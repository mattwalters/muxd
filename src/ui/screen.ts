import blessed from "blessed";
import { LogBox } from "./logBox";
import { StatusBar } from "./statusBar";
import { StatusBox } from "./statusBox";

// Setup the main blessed screen
export function setupScreen() {
  const screen = blessed.screen({
    smartCSR: true,
    fastCSR: true,
    title: "Muxd Log Viewer",
  });

  // Create the log box
  const logBox = new LogBox(screen);

  const statusBox = new StatusBox(screen);

  // Create the status bar
  const statusBar = new StatusBar(screen);

  // Return the screen and components
  screen.render();
  return {
    screen,
    logBox,
    statusBox,
    statusBar,
  };
}
