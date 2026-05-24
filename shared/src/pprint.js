// This Source Code Form is subject to the terms of the Mozilla Private
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

/* global console */

export const DEFAULT_LEVEL = 8;
export const DEFAULT_LENGTH = 25;
export const DEFAULT_WIDTH = 120;

export function pprint(expr, { width = DEFAULT_WIDTH, level = DEFAULT_LEVEL, length = DEFAULT_LENGTH } = {}) {
  const opts = { maxDepth: level, maxLength: length };
  console.log(formatValue(expr, opts));
}

export function pprintStr(expr, opts = {}) {
  return formatValue(expr, {
    maxDepth: opts.level ?? DEFAULT_LEVEL,
    maxLength: opts.length ?? DEFAULT_LENGTH,
  });
}

function formatValue(value, opts, depth = 0) {
  if (depth > opts.maxDepth) {
    return "...";
  }

  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const type = typeof value;

  if (type === "string") {
    return JSON.stringify(value);
  }

  if (type === "number" || type === "boolean" || type === "bigint") {
    return String(value);
  }

  if (type === "symbol") {
    return value.toString();
  }

  if (type === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (value instanceof Error) {
    return `${value.constructor.name}: ${value.message}`;
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries());
    if (entries.length === 0) return "{}";
    if (entries.length > opts.maxLength) {
      const shown = entries.slice(0, opts.maxLength).map(([k, v]) => `${formatValue(k, opts, depth + 1)} ${formatValue(v, opts, depth + 1)}`);
      return `{${shown.join(", ")} ...}`;
    }
    const items = entries.map(([k, v]) => `${formatValue(k, opts, depth + 1)} ${formatValue(v, opts, depth + 1)}`);
    return `{${items.join(", ")}}`;
  }

  if (value instanceof Set) {
    const items = Array.from(value);
    if (items.length === 0) return "#{}";
    if (items.length > opts.maxLength) {
      return `#{${items.slice(0, opts.maxLength).map((i) => formatValue(i, opts, depth + 1)).join(" ")} ...}`;
    }
    return `#{${items.map((i) => formatValue(i, opts, depth + 1)).join(" ")}}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.length > opts.maxLength) {
      const shown = value.slice(0, opts.maxLength).map((v) => formatValue(v, opts, depth + 1));
      return `[${shown.join(", ")} ...]`;
    }
    const items = value.map((v) => formatValue(v, opts, depth + 1));
    return `[${items.join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    if (entries.length > opts.maxLength) {
      const shown = entries.slice(0, opts.maxLength).map(([k, v]) => `:${k} ${formatValue(v, opts, depth + 1)}`);
      return `{${shown.join(", ")} ...}`;
    }
    const items = entries.map(([k, v]) => `:${k} ${formatValue(v, opts, depth + 1)}`);
    return `{${items.join(", ")}}`;
  }

  return String(value);
}