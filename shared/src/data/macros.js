// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

export function selectKeys(target, keys) {
  const result = {};
  for (const key of keys) {
    if (key in target) {
      result[key] = target[key];
    }
  }
  return result;
}

export function getIn(target, keys, defaultValue) {
  let current = target;
  for (let i = 0; i < keys.length; i++) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[keys[i]];
  }
  return current === undefined ? defaultValue : current;
}

export function fmt(template, ...args) {
  let result = template;
  for (let i = 0; i < args.length; i++) {
    result = result.replace("%" + (i + 1), String(args[i]));
  }
  const remaining = result.match(/%\d+/g);
  if (!remaining) {
    result = result.replace(/%/g, () => {
      const arg = args.find((a, i) => !result.includes(`%${i + 1}`));
      return arg !== undefined ? String(arg) : "%";
    });
  }
  return result;
}

export function truncate(s, maxLength) {
  return s.slice(0, Math.min(maxLength, s.length));
}

export function withOpen(bindings, body) {
  const resources = [];
  try {
    for (let i = 0; i < bindings.length; i += 2) {
      const resource = bindings[i + 1];
      resources.push(resource);
    }
    return body();
  } finally {
    for (const resource of resources) {
      if (resource && typeof resource.close === "function") {
        resource.close();
      }
    }
  }
}

export function runtimeAssert(hint, fn) {
  try {
    if (!fn()) {
      throw Object.assign(new Error(hint), {
        type: "assertion",
        code: "expr-validation",
        hint,
      });
    }
  } catch (cause) {
    if (cause.type === "assertion" && cause.code === "expr-validation") throw cause;
    const data = {
      type: "assertion",
      code: "expr-validation",
      hint,
    };
    throw Object.assign(new Error(hint), data);
  }
}

export function export_(source, name) {
  if (typeof source === "function") return source;
  return source[name] || source;
}