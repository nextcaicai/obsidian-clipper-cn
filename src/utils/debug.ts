import browser from './browser-polyfill';
export { createLogger } from './logger';
export type { LogLevel } from './logger';

declare const DEBUG_MODE: boolean;

let debugMode: boolean = DEBUG_MODE;

// Initialize debug mode from storage only in debug mode
if (DEBUG_MODE) {
	browser.storage.local.get('debugMode').then((result: { debugMode?: boolean }) => {
		debugMode = result.debugMode ?? false;
		console.log(`Debug mode initialized to: ${debugMode ? 'ON' : 'OFF'}`);
	}).catch((error) => {
		console.error('Error initializing debug mode:', error);
	});
}

export const toggleDebug = (filterName: string) => {
	if (!DEBUG_MODE) return;
	debugMode = !debugMode;
	browser.storage.local.set({ debugMode }).then(() => {
		console.log(`${filterName} debug mode is now ${debugMode ? 'ON' : 'OFF'}`);
	}).catch((error) => {
		console.error('Error saving debug mode:', error);
	});
};

// Legacy helper — still works; new code should use createLogger() instead
export const debugLog = (filterName: string, ...args: any[]) => {
	if (DEBUG_MODE && debugMode) {
		console.log(`[${filterName}]`, ...args);
	}
};

export const isDebugMode = () => DEBUG_MODE && debugMode;

if (DEBUG_MODE) {
	try {
		(window as any).toggleDebug = toggleDebug;
	} catch {
		// service worker context has no window — safe to ignore
	}
}