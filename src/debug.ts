import {appendFileSync} from 'fs';
import {resolve} from 'path';

// Path to the debug log file
const LOG_PATH = resolve(process.cwd(), 'debug.log');

/**
 * Writes log messages to a file with a timestamp.
 * @param args - Values to log.
 */
export function logger(...args: any[]): void {
	const timestamp = new Date().toISOString();
	const message = args
		.map(arg => {
			if (typeof arg === 'string') return arg;
			try {
				return JSON.stringify(arg);
			} catch {
				return String(arg);
			}
		})
		.join(' ');
	try {
		appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
	} catch {
		// Ignore write errors to avoid disrupting the app
	}
}
