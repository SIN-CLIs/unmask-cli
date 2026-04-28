/**
 * Tiny zero-dependency structured logger.
 *
 * - In `--json` mode, writes one JSON object per line to stderr so stdout stays
 *   pristine for the final UnmaskResponse payload.
 * - In human mode, writes coloured prefixed lines to stderr.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  level?: LogLevel;
  json?: boolean;
  silent?: boolean;
  context?: Record<string, unknown>;
}

export class Logger {
  private level: LogLevel;
  private json: boolean;
  private silent: boolean;
  private context: Record<string, unknown>;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? 'info';
    this.json = opts.json ?? false;
    this.silent = opts.silent ?? false;
    this.context = opts.context ?? {};
  }

  child(context: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      json: this.json,
      silent: this.silent,
      context: { ...this.context, ...context },
    });
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setJson(json: boolean): void {
    this.json = json;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.write('debug', msg, fields);
  }
  info(msg: string, fields?: Record<string, unknown>): void {
    this.write('info', msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.write('warn', msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.write('error', msg, fields);
  }

  private write(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (this.silent) return;
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;

    if (this.json) {
      const record = {
        ts: new Date().toISOString(),
        level,
        msg,
        ...this.context,
        ...fields,
      };
      process.stderr.write(JSON.stringify(record) + '\n');
      return;
    }

    const prefix = colourPrefix(level);
    const ctx =
      Object.keys(this.context).length > 0 || (fields && Object.keys(fields).length > 0)
        ? ' ' + JSON.stringify({ ...this.context, ...(fields ?? {}) })
        : '';
    process.stderr.write(`${prefix} ${msg}${ctx}\n`);
  }
}

function colourPrefix(level: LogLevel): string {
  const isTty = process.stderr.isTTY;
  const tag = `[${level.toUpperCase()}]`;
  if (!isTty) return tag;
  const colours: Record<LogLevel, string> = {
    debug: '\x1b[90m', // grey
    info: '\x1b[36m', // cyan
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
  };
  return `${colours[level]}${tag}\x1b[0m`;
}

export const logger = new Logger({
  level: (process.env.UNMASK_LOG_LEVEL as LogLevel) || 'info',
});
