/**
 * @module loggers
 * @description Structured JSON logging — mirrors `app.common.logging` from the
 * Clojure backend.
 *
 * Provides leveled, structured logging with optional JSON output for production
 * and colored console output for development.
 *
 * ### Usage
 *
 * ```js
 * import { logger } from './loggers/index.js';
 * logger.info('Server started', { port: 6060 });
 * logger.warn('Slow query', { duration: 5230, query: 'get-file' });
 * logger.error('Database error', { error: err.message, stack: err.stack });
 * ```
 *
 * ### Log levels
 *
 * | Level | Value | Production |
 * |-------|-------|------------|
 * | trace | 10    | Off by default |
 * | debug | 20    | Off by default |
 * | info  | 30    | On |
 * | warn  | 40    | On |
 * | error | 50    | On |
 * | fatal | 60    | On |
 *
 * ### Environment variables
 *
 * - `PENPOT_LOG_LEVEL`: Minimum log level (default: `info`).
 * - `PENPOT_LOG_FORMAT`: `json` or `text` (default: `text`).
 */

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const LEVEL_LABELS = Object.fromEntries(Object.entries(LOG_LEVELS).map(([k, v]) => [v, k.toUpperCase()]));

const currentLevel = LOG_LEVELS[process.env.PENPOT_LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;
const jsonFormat = (process.env.PENPOT_LOG_FORMAT || 'text') === 'json';

/**
 * Format a structured log entry.
 *
 * @param {string} level - Log level label.
 * @param {string} message - Log message.
 * @param {Record<string, *>} [props] - Additional structured properties.
 * @param {Error} [err] - Optional error to attach.
 * @returns {string} Formatted log line.
 */
function formatEntry(level, message, props, err) {
  const timestamp = new Date().toISOString();

  if (jsonFormat) {
    const entry = {
      timestamp,
      level,
      message,
      ...props,
    };
    if (err) {
      entry.error = err.message;
      entry.stack = err.stack;
    }
    return JSON.stringify(entry);
  }

  const propsStr = props && Object.keys(props).length > 0
    ? ' ' + Object.entries(props).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')
    : '';

  if (err) {
    return `[${timestamp}] ${level} ${message}${propsStr} error=${err.message}`;
  }
  return `[${timestamp}] ${level} ${message}${propsStr}`;
}

/**
 * Structured logger instance.
 *
 * All methods accept a message string and an optional props object.
 * The `error` and `fatal` methods also accept an Error object.
 */
export const logger = {
  /**
   * Log at trace level.
   * @param {string} message
   * @param {Record<string, *>} [props]
   */
  trace(message, props) {
    if (currentLevel <= LOG_LEVELS.trace) {
      console.log(formatEntry('TRACE', message, props));
    }
  },

  /**
   * Log at debug level.
   * @param {string} message
   * @param {Record<string, *>} [props]
   */
  debug(message, props) {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.log(formatEntry('DEBUG', message, props));
    }
  },

  /**
   * Log at info level.
   * @param {string} message
   * @param {Record<string, *>} [props]
   */
  info(message, props) {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(formatEntry('INFO', message, props));
    }
  },

  /**
   * Log at warn level.
   * @param {string} message
   * @param {Record<string, *>} [props]
   */
  warn(message, props) {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatEntry('WARN', message, props));
    }
  },

  /**
   * Log at error level.
   * @param {string} message
   * @param {Record<string, *>} [props]
   * @param {Error} [err]
   */
  error(message, props, err) {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatEntry('ERROR', message, props, err));
    }
  },

  /**
   * Log at fatal level. Also writes to stderr.
   * @param {string} message
   * @param {Record<string, *>} [props]
   * @param {Error} [err]
   */
  fatal(message, props, err) {
    if (currentLevel <= LOG_LEVELS.fatal) {
      console.error(formatEntry('FATAL', message, props, err));
    }
  },
};

/**
 * Create a child logger with a persistent context prefix.
 *
 * @param {string} module - Module name (e.g. 'rpc', 'auth', 'db').
 * @returns {{ trace, debug, info, warn, error, fatal }} Logger with module context.
 */
export function createLogger(module) {
  const context = { module };
  return {
    trace: (msg, props) => logger.trace(`[${module}] ${msg}`, { ...context, ...props }),
    debug: (msg, props) => logger.debug(`[${module}] ${msg}`, { ...context, ...props }),
    info: (msg, props) => logger.info(`[${module}] ${msg}`, { ...context, ...props }),
    warn: (msg, props) => logger.warn(`[${module}] ${msg}`, { ...context, ...props }),
    error: (msg, props, err) => logger.error(`[${module}] ${msg}`, { ...context, ...props }, err),
    fatal: (msg, props, err) => logger.fatal(`[${module}] ${msg}`, { ...context, ...props }, err),
  };
}