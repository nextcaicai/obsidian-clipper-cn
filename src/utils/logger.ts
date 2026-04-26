declare const DEBUG_MODE: boolean;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ALWAYS_VISIBLE: ReadonlySet<LogLevel> = new Set(['warn', 'error']);

function isDebugBuild(): boolean {
	return typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE;
}

export class Logger {
	private readonly prefix: string;

	constructor(module: string) {
		this.prefix = `[Clipper:${module}]`;
	}

	private shouldLog(level: LogLevel): boolean {
		return ALWAYS_VISIBLE.has(level) || isDebugBuild();
	}

	debug(message: string, data?: unknown): void {
		if (!this.shouldLog('debug')) return;
		data !== undefined
			? console.debug(this.prefix, message, data)
			: console.debug(this.prefix, message);
	}

	info(message: string, data?: unknown): void {
		if (!this.shouldLog('info')) return;
		data !== undefined
			? console.info(this.prefix, message, data)
			: console.info(this.prefix, message);
	}

	warn(message: string, data?: unknown): void {
		data !== undefined
			? console.warn(this.prefix, message, data)
			: console.warn(this.prefix, message);
	}

	error(message: string, data?: unknown): void {
		data !== undefined
			? console.error(this.prefix, message, data)
			: console.error(this.prefix, message);
	}
}

/**
 * Create a logger bound to a specific module.
 *
 * Usage:
 *   const logger = createLogger('Feishu');
 *   logger.info('Resolving document', { token });
 *   logger.warn('No blocks returned', { documentId });
 *   logger.error('API failed', { error, url });
 *
 * Output format: [Clipper:Module] message {data}
 *
 * Levels:
 *   debug / info  — only emitted in DEBUG_MODE builds
 *   warn / error  — always emitted
 */
export function createLogger(module: string): Logger {
	return new Logger(module);
}
