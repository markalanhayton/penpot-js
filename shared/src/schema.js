// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

/* global performance, console */

export const MAX_SAFE_INT = 2147483647;
export const MIN_SAFE_INT = -2147483648;

const EMAIL_RE = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const registry = new Map();

function registerSchema(type, schema) {
  registry.set(type, schema);
  return schema;
}

export function lookup(type) {
  return registry.get(type);
}

export function validate(type, value) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema) return true;
  if (typeof schema === "function") return schema(value);
  if (typeof schema === "object" && schema !== null) {
    if (schema.pred) return schema.pred(value);
    if (schema.compile) {
      const compiled = typeof schema.compile === "function" ? schema.compile() : schema.compile;
      if (compiled.pred) return compiled.pred(value);
    }
  }
  return true;
}

export function valid(type, value) {
  try {
    return validate(type, value);
  } catch (_) {
    return false;
  }
}

export function check(type, value, { hint = "check error", code = "data-validation" } = {}) {
  if (!validate(type, value)) {
    const errors = explain(type, value);
    throw Object.assign(new Error(hint), {
      type: "assertion",
      code,
      hint,
      explain: errors,
    });
  }
  return value;
}

export function checkFn(type, opts = {}) {
  return (value) => check(type, value, opts);
}

export function explain(type, value) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema) return null;
  if (typeof schema === "function") {
    if (!schema(value)) {
      return [{ value, message: "validation failed" }];
    }
    return null;
  }
  if (typeof schema === "object" && schema !== null) {
    const pred = schema.pred;
    if (pred && !pred(value)) {
      const msg = schema.typeProperties?.["error/message"] || `expected ${schema.typeProperties?.title || type}`;
      return [{ value, message: msg }];
    }
    if (schema.compile && !schema.pred) {
      const compiled = typeof schema.compile === "function" ? schema.compile() : schema.compile;
      if (compiled.pred && !compiled.pred(value)) {
        const msg = compiled.typeProperties?.["error/message"] || `expected ${compiled.typeProperties?.title || type}`;
        return [{ value, message: msg }];
      }
    }
  }
  return null;
}

export function simplifyErrors(errors) {
  if (!errors) return null;
  return errors.map((e) => e.message || String(e));
}

export function validationErrors(value, type) {
  const errors = explain(type, value);
  return errors ? simplifyErrors(errors) : null;
}

export function coerce(typeOrSchema, value, transformer) {
  if (transformer) {
    return transformer(value);
  }
  return decode(typeOrSchema, value);
}

export function coercer(type, opts = {}) {
  return (data) => {
    const decoded = coerce(type, data);
    return check(type, decoded, opts);
  };
}

export function validator(type) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema) return () => true;
  if (typeof schema === "function") return schema;
  if (typeof schema === "object" && schema !== null) {
    if (schema.pred) return schema.pred;
    if (schema.compile) {
      const compiled = typeof schema.compile === "function" ? schema.compile() : schema.compile;
      if (compiled.pred) return compiled.pred;
    }
  }
  return () => true;
}

export function lazyValidator(type) {
  let cached = null;
  return (value) => {
    if (!cached) cached = validator(type);
    return cached(value);
  };
}

export function parseLong(v) {
  if (typeof v !== "string") return v;
  const n = parseInt(v, 10);
  return isNaN(n) ? v : n;
}

export function parseDouble(v) {
  if (typeof v !== "string") return v;
  const n = parseFloat(v);
  return isNaN(n) ? v : n;
}

export function parseBoolean(v) {
  if (typeof v !== "string") return v;
  const lower = v.toLowerCase();
  if (lower === "true" || lower === "t" || lower === "1") return true;
  if (lower === "false" || lower === "f" || lower === "0") return false;
  return v;
}

export function parseKeyword(v) {
  if (typeof v === "string") {
    const kebab = v.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`);
    return kebab.startsWith(":") ? kebab : `:${kebab}`;
  }
  return v;
}

export function parseEmail(s) {
  if (typeof s !== "string") return null;
  const match = s.match(EMAIL_RE);
  return match ? match[0] : null;
}

export function emailStringP(s) {
  return typeof s === "string" && EMAIL_RE.test(s);
}

function compileIntSchema({ max, min } = {}) {
  let pred = (v) => Number.isInteger(v);
  if (min !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v >= min;
  }
  if (max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v <= max;
  }
  return pred;
}

function compileDoubleSchema({ max, min } = {}) {
  let pred = (v) => typeof v === "number" && !Number.isNaN(v);
  if (min !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v >= min;
  }
  if (max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v <= max;
  }
  return pred;
}

function compileNumberSchema({ max, min } = {}) {
  let pred = (v) => typeof v === "number";
  if (min !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v >= min;
  }
  if (max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v <= max;
  }
  return pred;
}

function compileTextSchema({ min, max } = {}) {
  return (v) => {
    if (typeof v !== "string") return false;
    if (v.trim().length === 0) return false;
    if (min !== undefined && v.length < min) return false;
    if (max !== undefined && v.length > max) return false;
    return true;
  };
}

registerSchema("uuid", {
  pred: (v) => typeof v === "string" && UUID_RE.test(v),
  typeProperties: {
    title: "uuid",
    description: "UUID formatted string",
    "error/message": "should be an uuid",
    "decode/string": (v) => (typeof v === "string" ? v : String(v)),
    "decode/json": (v) => v,
    "encode/string": (v) => String(v),
    "encode/json": (v) => String(v),
  },
});

registerSchema("email", {
  pred: emailStringP,
  typeProperties: {
    title: "email",
    description: "string with valid email address",
    "error/code": "errors.invalid-email",
    "decode/string": (v) => parseEmail(v) || v,
    "decode/json": (v) => parseEmail(v) || v,
  },
});

registerSchema("int", {
  pred: compileIntSchema(),
  compile: compileIntSchema,
  typeProperties: {
    title: "integer",
    description: "integer",
    "error/message": "expected to be int/long",
    "error/code": "errors.invalid-integer",
    "decode/string": parseLong,
    "decode/json": parseLong,
  },
});

registerSchema("safe-int", {
  pred: compileIntSchema({ max: MAX_SAFE_INT, min: MIN_SAFE_INT }),
  typeProperties: {
    title: "safe-integer",
    "error/message": "expected safe integer",
    "decode/string": parseLong,
    "decode/json": parseLong,
  },
});

registerSchema("safe-double", {
  pred: compileDoubleSchema({ max: MAX_SAFE_INT, min: MIN_SAFE_INT }),
  typeProperties: {
    title: "safe-double",
    "error/message": "expected safe double",
    "decode/string": parseDouble,
    "decode/json": parseDouble,
  },
});

registerSchema("safe-number", {
  pred: compileNumberSchema({ max: MAX_SAFE_INT, min: MIN_SAFE_INT }),
  typeProperties: {
    title: "safe-number",
    "error/message": "expected safe number",
    "decode/string": parseDouble,
    "decode/json": parseDouble,
  },
});

registerSchema("double", {
  pred: compileDoubleSchema(),
  compile: compileDoubleSchema,
  typeProperties: {
    title: "double",
    description: "double number",
    "error/message": "expected to be double",
    "decode/string": parseDouble,
    "decode/json": parseDouble,
  },
});

registerSchema("number", {
  pred: compileNumberSchema(),
  compile: compileNumberSchema,
  typeProperties: {
    title: "number",
    description: "number",
    "error/message": "expected to be number",
    "decode/string": parseDouble,
    "decode/json": parseDouble,
  },
});

registerSchema("boolean", {
  pred: (v) => typeof v === "boolean",
  typeProperties: {
    title: "boolean",
    description: "boolean",
    "error/message": "expected boolean",
    "decode/string": parseBoolean,
    "decode/json": parseBoolean,
  },
});

registerSchema("string", {
  pred: (v) => typeof v === "string",
  typeProperties: {
    title: "string",
    "error/message": "expected string",
  },
});

registerSchema("text", {
  pred: (v) => typeof v === "string" && v.trim().length > 0,
  compile: compileTextSchema,
  typeProperties: {
    title: "string",
    description: "not whitespace string",
  },
});

registerSchema("password", {
  pred: (v) => typeof v === "string" && v.length >= 8 && v.trim().length > 0,
  typeProperties: {
    title: "password",
    "error/code": "errors.password-too-short",
  },
});

registerSchema("keyword", {
  pred: (v) => typeof v === "string" && v.startsWith(":"),
  typeProperties: {
    title: "keyword",
    "error/message": "expected keyword",
    "decode/string": parseKeyword,
    "decode/json": parseKeyword,
  },
});

registerSchema("fn", {
  pred: (v) => typeof v === "function",
  typeProperties: {
    title: "function",
  },
});

registerSchema("any", {
  pred: () => true,
  typeProperties: {
    title: "any",
  },
});

registerSchema("set-of-strings", {
  pred: (v) => v instanceof Set && [...v].every((x) => typeof x === "string"),
  typeProperties: {
    title: "set[string]",
    "error/message": "should be a set of strings",
  },
});

registerSchema("set-of-keywords", {
  pred: (v) => v instanceof Set && [...v].every((x) => typeof x === "string" && x.startsWith(":")),
  typeProperties: {
    title: "set[keyword]",
    "error/message": "should be a set of keywords",
  },
});

registerSchema("set-of-uuid", {
  pred: (v) => v instanceof Set && [...v].every((x) => typeof x === "string" && UUID_RE.test(x)),
  typeProperties: {
    title: "set[uuid]",
    "error/message": "should be a set of UUID instances",
  },
});

registerSchema("coll-of-uuid", {
  pred: (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && UUID_RE.test(x)),
  typeProperties: {
    title: "[uuid]",
    "error/message": "should be a coll of UUID instances",
    "decode/string": (v) => {
      if (typeof v === "string") v = v.split(/[\s,]+/);
      if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.length > 0 && UUID_RE.test(x));
      return v;
    },
    "decode/json": (v) => {
      if (typeof v === "string") v = v.split(/[\s,]+/);
      if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.length > 0 && UUID_RE.test(x));
      return v;
    },
  },
});

registerSchema("set", {
  compile: compileSetSchema,
  typeProperties: {
    title: "set",
    "error/message": "should be a set",
  },
});

registerSchema("vec", {
  compile: compileVecSchema,
  typeProperties: {
    title: "vec",
    "error/message": "should be a vector",
  },
});

registerSchema("one-of", {
  compile: compileOneOfSchema,
  typeProperties: {
    title: "enum",
    "error/message": "should be one of the allowed values",
  },
});

registerSchema("uri", {
  pred: (v) => v instanceof URL,
  typeProperties: {
    title: "uri",
    description: "URI formatted string",
    "error/code": "errors.invalid-uri",
    "decode/string": (v) => {
      if (v instanceof URL) return v;
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      try { return new URL(trimmed); } catch {}
      try { return new URL(trimmed, "http://placeholder"); } catch {}
      return v;
    },
    "decode/json": (v) => {
      if (v instanceof URL) return v;
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      try { return new URL(trimmed); } catch {}
      try { return new URL(trimmed, "http://placeholder"); } catch {}
      return v;
    },
    "encode/string": (v) => (v instanceof URL ? v.toString() : v),
    "encode/json": (v) => (v instanceof URL ? v.toString() : v),
  },
});

registerSchema("contains-any", {
  compile: compileContainsAnySchema,
  typeProperties: {
    title: "contains-any",
    "error/message": "should contain at least one of the specified keys",
  },
});

export function encode(type, value, transformer) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema) return value;
  if (transformer) return transformer(value);
  if (schema.typeProperties) {
    const enc = schema.typeProperties["encode/string"] || schema.typeProperties["encode/json"];
    if (enc) return enc(value);
  }
  return value;
}

export function decode(type, value, transformer) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema) return value;
  if (transformer) return transformer(value);
  if (schema.typeProperties) {
    const dec = schema.typeProperties["decode/string"] || schema.typeProperties["decode/json"];
    if (dec) return dec(value);
  }
  return value;
}

export function encoder(type) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema?.typeProperties) return (v) => v;
  const enc = schema.typeProperties["encode/string"] || schema.typeProperties["encode/json"];
  return enc ? (v) => enc(v) : (v) => v;
}

export function decoder(type) {
  const schema = typeof type === "string" ? registry.get(type) : type;
  if (!schema?.typeProperties) return (v) => v;
  const dec = schema.typeProperties["decode/string"] || schema.typeProperties["decode/json"];
  return dec ? (v) => dec(v) : (v) => v;
}

export function lazyDecoder(type) {
  let cached = null;
  return (v) => {
    if (!cached) cached = decoder(type);
    return cached(v);
  };
}

const xfFilterWordStrings = (arr) =>
  arr.filter((x) => typeof x === "string" && x.length > 0 && x.trim().length > 0);

function compileSetSchema({ min, max, kind } = {}) {
  const childPred = kind
    ? typeof kind === "function"
      ? kind
      : validator(kind)
    : () => true;

  let pred = (v) => v instanceof Set && [...v].every(childPred);
  if (min !== undefined && max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v.size >= min && v.size <= max;
  } else if (min !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v.size >= min;
  } else if (max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v.size <= max;
  }

  const decode = (v) => {
    if (typeof v === "string") {
      const parts = v.split(/[\s,]+/);
      return new Set(xfFilterWordStrings(parts));
    }
    if (v instanceof Set) return v;
    if (Array.isArray(v) || (typeof v === "object" && v !== null && Symbol.iterator in v)) {
      return new Set(v);
    }
    return v;
  };

  return {
    pred,
    typeProperties: {
      title: "set",
      description: "Set of values",
      "error/message": "should be a set of strings",
      "decode/string": decode,
      "decode/json": decode,
      "encode/string": (o) => (o instanceof Set ? [...o].join(", ") : o),
      "encode/json": (o) => (o instanceof Set ? [...o] : o),
    },
  };
}

function compileVecSchema({ min, max, kind } = {}) {
  const childPred = kind
    ? typeof kind === "function"
      ? kind
      : validator(kind)
    : () => true;

  let pred = (v) => Array.isArray(v) && v.every(childPred);
  if (min !== undefined && max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v.length >= min && v.length <= max;
  } else if (min !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v.length >= min;
  } else if (max !== undefined) {
    const prev = pred;
    pred = (v) => prev(v) && v.length <= max;
  }

  const decode = (v) => {
    if (typeof v === "string") {
      const parts = v.split(/[\s,]+/);
      return xfFilterWordStrings(parts);
    }
    if (Array.isArray(v)) return v;
    if (typeof v === "object" && v !== null && Symbol.iterator in v) {
      return [...v];
    }
    return v;
  };

  return {
    pred,
    typeProperties: {
      title: "vec",
      description: "Vector of values",
      "error/message": "should be a vector of strings",
      "decode/string": decode,
      "decode/json": decode,
      "encode/string": (o) => (Array.isArray(o) ? o.join(", ") : o),
      "encode/json": (o) => o,
    },
  };
}

function compileOneOfSchema({ format } = {}) {
  return (options) => {
    const optsSet = new Set(options);
    const decode = format !== "string" && format !== "identity"
      ? (v) => (typeof v === "string" && v.startsWith(":") ? v : `:${v}`)
      : (v) => v;
    return {
      pred: (v) => optsSet.has(v),
      typeProperties: {
        title: "enum",
        "decode/string": decode,
        "decode/json": decode,
      },
    };
  };
}

function compileContainsAnySchema({ strict } = {}) {
  return (choices) => {
    const pred = strict
      ? (obj) => choices.some((prop) => obj?.[prop] != null)
      : (obj) => choices.some((prop) => Object.hasOwn(obj ?? {}, prop));
    return { pred };
  };
}

export const validSafeNumber = lazyValidator("safe-number");
export const validSafeInt = lazyValidator("safe-int");
export const validText = validator("text");

export const checkSafeInt = checkFn("safe-int");
export const checkSetOfStrings = checkFn("set-of-strings");
export const checkEmail = checkFn("email");
export const checkUuid = checkFn("uuid", { hint: "expected valid uuid instance" });
export const checkString = checkFn("string", { hint: "expected string" });
export const checkCollOfUuid = checkFn("coll-of-uuid");
export const checkSetOfUuid = checkFn("set-of-uuid");
export const checkSetOfEmails = checkFn("set");

export { registerSchema as register };