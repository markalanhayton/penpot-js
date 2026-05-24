export class PenpotError extends Error {
  constructor(message, data = {}, cause = null) {
    super(message);
    this.name = 'PenpotError';
    this.data = data;
    this.cause = cause;

    if (data.type) this.type = data.type;
    if (data.code) this.code = data.code;
    if (data.hint) this.hint = data.hint;
  }
}

export function error(type, data = {}) {
  const hint = data.hint || type;
  const message = typeof hint === 'string' ? hint : String(hint);
  return new PenpotError(message, { type, ...data }, data.cause || null);
}

export function raise(type, data = {}) {
  throw error(type, data);
}

export function isError(v) {
  return v instanceof PenpotError;
}

export function isException(v) {
  return v instanceof Error;
}

export function ignoring(...fns) {
  try {
    for (const fn of fns) fn();
  } catch {
    // intentionally ignored
  }
}

export async function ignoringAsync(...fns) {
  try {
    for (const fn of fns) await fn();
  } catch {
    // intentionally ignored
  }
}

export function tryExpr(expr, { reraiseWith, onException } = {}) {
  try {
    return expr();
  } catch (ex) {
    if (reraiseWith) {
      throw error(reraiseWith.type, { ...reraiseWith, cause: ex });
    }
    if (onException) {
      return onException(ex);
    }
    throw ex;
  }
}

export function instanceOf(errorClass, cause) {
  let current = cause;
  while (current) {
    if (current instanceof errorClass) return current;
    current = current.cause || null;
  }
  return null;
}

export function getHint(cause) {
  if (cause instanceof PenpotError) {
    const hint = cause.data?.hint || cause.hint;
    if (hint) return firstLine(hint);
  }
  if (cause instanceof Error && cause.message) {
    return firstLine(cause.message);
  }
  return null;
}

export function firstLine(s) {
  if (typeof s !== 'string') return s;
  const idx = s.indexOf('\n');
  return idx > 0 ? s.substring(0, idx) : s;
}

export function formatThrowable(cause) {
  const lines = ['===================='];

  if (cause instanceof PenpotError) {
    if (cause.hint || cause.message) {
      const hintText = cause.hint || cause.message;
      if (hintText.includes('\n')) {
        lines.push('Hint:');
        lines.push('--------------------');
        lines.push(hintText);
        lines.push('');
      }
    }

    if (cause.data) {
      lines.push('Data:');
      lines.push('--------------------');
      lines.push(JSON.stringify(cause.data, null, 2));
      lines.push('');
    }
  }

  if (cause instanceof Error && cause.stack) {
    lines.push('Trace:');
    lines.push('--------------------');
    lines.push(cause.stack);
  }

  lines.push('====================');
  return lines.join('\n');
}

export function printThrowable(cause, { prefix } = {}) {
  const title = prefix
    ? `${prefix}: ${getHint(cause) || 'Error'}`
    : getHint(cause) || 'Error';

  if (typeof console !== 'undefined' && console.group) {
    console.group(title);
    try {
      console.log(formatThrowable(cause));
      let current = cause.cause;
      while (current) {
        console.log('\nCaused by:');
        console.log(formatThrowable(current));
        current = current.cause;
      }
    } finally {
      console.groupEnd();
    }
  } else {
    console.log(formatThrowable(cause));
  }
}