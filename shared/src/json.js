export function readKebabKey(k) {
  if (typeof k === 'string' && !k.includes('/')) {
    return camelToKebab(k);
  }
  return k;
}

export function writeCamelKey(k) {
  if (typeof k === 'string') {
    return kebabToCamel(k);
  }
  return String(k);
}

export function toJs(x, { keyFn = writeCamelKey } = {}) {
  if (x == null) return null;
  if (x instanceof Date) return x;
  if (typeof x === 'number' || typeof x === 'boolean') return x;
  if (typeof x === 'string') return x;

  if (Array.isArray(x)) {
    return x.map((v) => toJs(v, { keyFn }));
  }

  if (typeof x === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(x)) {
      const key = keyFn(k);
      result[key] = toJs(v, { keyFn });
    }
    return result;
  }

  return String(x);
}

export function toClj(o, { keyFn = readKebabKey, valFn = (v) => v, recursive = true } = {}) {
  function convert(x) {
    x = valFn(x);
    if (x == null) return x;
    if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return x;
    if (x instanceof Date) return x;

    if (Array.isArray(x)) {
      if (recursive) {
        return x.map(convert);
      }
      return [...x];
    }

    if (typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
      const result = {};
      for (const key of Object.keys(x)) {
        result[keyFn(key)] = recursive ? convert(x[key]) : x[key];
      }
      return result;
    }

    return x;
  }

  return convert(o);
}

export function encode(data, opts = {}) {
  if (opts.keyFn) {
    return JSON.stringify(toJs(data, { keyFn: opts.keyFn }), null, opts.indent);
  }
  return JSON.stringify(data, null, opts.indent);
}

export function decode(data, opts = {}) {
  const parsed = JSON.parse(data);
  if (opts.keyFn || opts.valFn) {
    return toClj(parsed, {
      keyFn: opts.keyFn || readKebabKey,
      valFn: opts.valFn,
      recursive: opts.recursive !== false,
    });
  }
  return parsed;
}

function kebabToCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToKebab(s) {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}