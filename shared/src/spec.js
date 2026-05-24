// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

import * as exceptions from "./exceptions.js";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RX = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;
const EMAIL_RX_GLOBAL = /[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}/g;
const RGB_COLOR_STR_RX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export const MAX_SAFE_INT = 2147483647;
export const MIN_SAFE_INT = -2147483648;

export function isUUID(v) {
  return typeof v === "string" && UUID_RX.test(v);
}

export function isBoolean(v) {
  if (typeof v === "boolean") return true;
  if (typeof v === "string") {
    const lower = v.toLowerCase();
    return lower === "true" || lower === "false" || lower === "t" || lower === "f" || lower === "0" || lower === "1";
  }
  return false;
}

export function conformBoolean(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const lower = v.toLowerCase();
    if (lower === "true" || lower === "t" || lower === "1") return true;
    if (lower === "false" || lower === "f" || lower === "0") return false;
  }
  return null;
}

export function isNumber(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

export function conformNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function isInteger(v) {
  return Number.isInteger(v);
}

export function conformInteger(v) {
  if (Number.isInteger(v)) return v;
  if (typeof v === "string") {
    if (/^[-+]?\d+$/.test(v)) return parseInt(v, 10);
  }
  return null;
}

export function isSafeNumber(x) {
  return typeof x === "number" && x >= MIN_SAFE_INT && x <= MAX_SAFE_INT;
}

export function isSafeInt(x) {
  return Number.isInteger(x) && x >= MIN_SAFE_INT && x <= MAX_SAFE_INT;
}

export function isSafeFloat(x) {
  return typeof x === "number" && !Number.isInteger(x) && x >= MIN_SAFE_INT && x <= MAX_SAFE_INT;
}

export function isKeyword(v) {
  return typeof v === "string" && v.startsWith(":");
}

export function conformKeyword(v) {
  if (typeof v === "string") {
    return v.startsWith(":") ? v : `:${v}`;
  }
  return null;
}

export function parseEmail(s) {
  if (typeof s === "string" && EMAIL_RX.test(s)) return s;
  return null;
}

export function isEmail(v) {
  return typeof v === "string" && EMAIL_RX.test(v);
}

export function isRGBColorStr(v) {
  return typeof v === "string" && RGB_COLOR_STR_RX.test(v);
}

export function isBytes(x) {
  if (x === null || x === undefined) return false;
  return x instanceof Uint8Array || x instanceof ArrayBuffer;
}

export function conformSetOfKeywords(v) {
  if (typeof v === "string") {
    return new Set(v.split(/[\s,]+/).filter((s) => s.length > 0).map((s) => (s.startsWith(":") ? s : `:${s}`)));
  }
  if (Array.isArray(v) || v instanceof Set) {
    return new Set(
      [...v].map((s) => {
        if (typeof s === "string") return s.startsWith(":") ? s : `:${s}`;
        if (typeof s === "object" && s !== null && "name" in s) return `:${s.name}`;
        return String(s);
      })
    );
  }
  return null;
}

export function conformSetOfStrings(v) {
  if (typeof v === "string") {
    return new Set(v.split(/[\s,]+/).filter((s) => s.length > 0 && s.trim().length > 0));
  }
  if (Array.isArray(v) || v instanceof Set) {
    return new Set([...v].filter((s) => typeof s === "string" && s.length > 0 && s.trim().length > 0));
  }
  return null;
}

export function conformVectorOfStrings(v) {
  if (typeof v === "string") {
    return v.split(/[\s,]+/).filter((s) => s.length > 0 && s.trim().length > 0);
  }
  if (Array.isArray(v)) {
    return v.filter((s) => typeof s === "string" && s.length > 0 && s.trim().length > 0);
  }
  return null;
}

export function conformSetOfValidEmails(v) {
  if (typeof v === "string") {
    EMAIL_RX_GLOBAL.lastIndex = 0;
    const matches = v.match(EMAIL_RX_GLOBAL);
    return matches ? new Set(matches) : new Set();
  }
  if (Array.isArray(v) || v instanceof Set) {
    return new Set([...v].filter(isEmail));
  }
  return null;
}

export function isNotBlankString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

export function valid(spec, value) {
  try {
    return validate(spec, value);
  } catch {
    return false;
  }
}

function validate(spec, value) {
  switch (spec) {
    case "uuid":
      return isUUID(value);
    case "boolean":
      return isBoolean(value);
    case "number":
      return isNumber(value);
    case "integer":
      return isInteger(value);
    case "safe-number":
      return isSafeNumber(value);
    case "safe-integer":
      return isSafeInt(value);
    case "safe-float":
      return isSafeFloat(value);
    case "keyword":
      return isKeyword(value);
    case "email":
      return isEmail(value);
    case "string":
      return typeof value === "string";
    case "not-empty-string":
      return isNotBlankString(value);
    case "rgb-color-str":
      return isRGBColorStr(value);
    case "bytes":
      return isBytes(value);
    case "fn":
      return typeof value === "function";
    case "some":
      return value != null;
    case "inst":
      return value instanceof Date;
    case "url":
      return typeof value === "string" && /^https?:\/\//.test(value);
    default:
      return true;
  }
}

export function conform(spec, data) {
  const conformer = getConformer(spec);
  if (conformer) {
    const result = conformer(data);
    if (result === null) {
      throw new Error(`Spec validation failed: ${spec}`);
    }
    return result;
  }
  if (valid(spec, data)) return data;
  throw new Error(`Spec validation failed: ${spec}`);
}

function getConformer(spec) {
  switch (spec) {
    case "uuid":
      return (v) => (isUUID(v) ? v : null);
    case "boolean":
      return conformBoolean;
    case "number":
      return conformNumber;
    case "integer":
      return conformInteger;
    case "keyword":
      return conformKeyword;
    case "email":
      return parseEmail;
    case "set-of-keywords":
      return conformSetOfKeywords;
    case "set-of-strings":
      return conformSetOfStrings;
    case "vector-of-strings":
      return conformVectorOfStrings;
    case "set-of-valid-emails":
      return conformSetOfValidEmails;
    default:
      return null;
  }
}

export function assertExpr(expr, hint) {
  if (!expr) {
    throw exceptions.raise({
      type: "assertion",
      code: "expr-validation",
      hint: hint || "expression assertion failed",
    });
  }
}

export function assertSpec(spec, value, hint) {
  if (!valid(spec, value)) {
    throw exceptions.raise({
      type: "assertion",
      code: "spec-validation",
      hint: hint || `spec assert: ${spec}`,
    });
  }
  return value;
}

export function assert(specOrExpr, valueOrMsg, hint) {
  const pcnt = arguments.length;
  if (pcnt === 1) {
    assertExpr(specOrExpr, typeof specOrExpr === "string" ? specOrExpr : undefined);
  } else if (pcnt === 2) {
    if (typeof specOrExpr === "string" && specOrExpr.startsWith(":")) {
      assertSpec(specOrExpr, valueOrMsg, null);
    } else {
      assertExpr(specOrExpr, valueOrMsg);
    }
  } else if (pcnt === 3) {
    assertSpec(specOrExpr, valueOrMsg, hint);
  }
}

export function verify(spec, value) {
  return assertSpec(spec, value, null);
}

export function validationError(cause) {
  if (typeof cause === "object" && cause !== null) {
    if (cause.type === "spec-validation" || cause.code === "spec-validation") return cause;
    if (cause.cause) return validationError(cause.cause);
  }
  return false;
}