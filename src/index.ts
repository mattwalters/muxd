#!/usr/bin/env node
import { App } from "./core/app";

// Set a simpler terminal to avoid some escape sequence issues
process.env.TERM = "xterm";

console.log("asdasdasdasd");
// Create and start the application
const app = new App();
app.start();
