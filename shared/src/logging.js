const LEVEL_INT = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 50,
};

const LEVEL_NAME = {
  debug: 'DBG',
  trace: 'TRC',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

const LEVEL_COLOR = {
  error: '#c82829',
  warn: '#f5871f',
  info: '#4271ae',
  debug: '#969896',
  trace: '#8e908c',
};

const loggerLevels = new Map();

loggerLevels.set('', LEVEL_INT.info);

let context = null;
let logRecord = null;

const handlers = [];

function levelToInt(level) {
  const n = LEVEL_INT[level];
  if (n == null) throw new Error(`invalid level: ${level}`);
  return n;
}

function enabled(logger, level) {
  const levelInt = levelToInt(level);
  let current = logger;
  while (current != null) {
    const val = loggerLevels.get(current);
    if (val != null) {
      loggerLevels.set(logger, val);
      return levelInt >= val;
    }
    const dotIndex = current.lastIndexOf('.');
    current = dotIndex > 0 ? current.slice(0, dotIndex) : '';
  }
  const defaultLevel = loggerLevels.get('') ?? LEVEL_INT.info;
  loggerLevels.set(logger, defaultLevel);
  return levelInt >= defaultLevel;
}

function buildMessage(props) {
  const parts = [];
  let body = null;
  for (let i = 0; i < props.length; i += 2) {
    const k = props[i];
    const v = props[i + 1];
    if (k === 'body') {
      body = v;
    } else if (typeof k === 'string') {
      parts.push(`${k}=${formatValue(v)}`);
    }
  }
  let message = parts.join(', ');
  if (typeof body === 'string') {
    message = message + '\n' + body;
  }
  return message;
}

function formatValue(v) {
  if (v == null) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function consoleLogHandler(record) {
  if (!enabled(record.logger, record.level)) return;

  const color = LEVEL_COLOR[record.level] || '#969896';
  const name = LEVEL_NAME[record.level] || 'LOG';
  const ts = formatTimestamp(record.timestamp);
  const header = `${name} ${ts} [${record.logger}] `;
  const message = header + record.message;

  const hstyles = `font-weight: 600; color: ${color}`;
  const mstyles = `font-weight: 300; color: ${color}`;

  if (typeof console !== 'undefined' && console.group) {
    console.group(`%c${message}%c`, hstyles, mstyles);
  }

  if (record.props) {
    for (let i = 0; i < record.props.length; i += 2) {
      const k = record.props[i];
      const v = record.props[i + 1];
      if (k && k.startsWith('js/')) {
        console.log(k.slice(3), typeof v === 'object' ? v : v);
      } else if (k === 'error') {
        console.error(v);
      }
    }
  }

  if (record.cause) {
    console.error(record.cause);
  }

  if (typeof console !== 'undefined' && console.groupEnd) {
    console.groupEnd();
  }
}

handlers.push(consoleLogHandler);

function emitLog(props, cause, loggerCtx, logger, level, sync) {
  if (!enabled(logger, level)) return;

  const timestamp = Date.now();
  const mergedContext = Object.assign({}, context, loggerCtx);
  const message = buildMessage(props);

  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp,
    message,
    props,
    context: mergedContext,
    level,
    logger,
    cause: cause || null,
  };

  logRecord = record;

  for (const handler of handlers) {
    try {
      handler(record);
    } catch {
      // handler errors should not propagate
    }
  }
}

export function log(level, logger, ...params) {
  emitLog(params, null, null, logger || 'app', level, false);
}

export function info(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'info', false);
}

export function inf(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'info', false);
}

export function warn(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'warn', false);
}

export function wrn(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'warn', false);
}

export function error(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'error', false);
}

export function err(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'error', false);
}

export function debug(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'debug', false);
}

export function dbg(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'debug', false);
}

export function trace(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'trace', false);
}

export function trc(logger, ...params) {
  emitLog(params, null, null, logger || 'app', 'trace', false);
}

export function setLevel(logger, level) {
  loggerLevels.set(logger, levelToInt(level));
}

export function setup(config) {
  for (const [logger, level] of Object.entries(config)) {
    setLevel(logger, level);
  }
}

export function setContext(ctx) {
  context = ctx;
}

export function getLogRecord() {
  return logRecord;
}

export { levelToInt, enabled };