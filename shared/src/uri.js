// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

/* global URL, URLSearchParams */

export function uri(o) {
  if (o instanceof URL) return o;
  if (o === null || o === undefined) return o;
  if (typeof o === "object") {
    const url = new URL("", "http://placeholder");
    if (o.scheme) url.protocol = o.scheme;
    if (o.host) url.hostname = o.host;
    if (o.port) url.port = String(o.port);
    if (o.path) url.pathname = o.path;
    if (o.query) url.search = o.query;
    if (o.fragment) url.hash = o.fragment;
    return url;
  }
  if (typeof o === "string") {
    const trimmed = o.trim();
    try {
      return new URL(trimmed);
    } catch {
      try {
        return new URL(trimmed, "http://placeholder");
      } catch {
        return new URL("http://placeholder/" + encodeURIComponent(trimmed));
      }
    }
  }
  return new URL(String(o));
}

export function parse(s) {
  try {
    return new URL(s);
  } catch {
    try {
      return new URL(s, "http://placeholder");
    } catch {
      return null;
    }
  }
}

export function queryEncode(s) {
  return encodeURIComponent(s);
}

export function percentEncode(s) {
  return encodeURIComponent(s);
}

export function isURI(o) {
  return o instanceof URL;
}

export function queryStringToMap(s) {
  const params = new URLSearchParams(s);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

export function defaultEncodeValue(v) {
  if (typeof v === "string" && v.startsWith(":")) return v.slice(1);
  return v;
}

export function getDomain(urlObj) {
  if (!(urlObj instanceof URL)) urlObj = uri(urlObj);
  if (urlObj.port) {
    return `${urlObj.hostname}:${urlObj.port}`;
  }
  return urlObj.hostname;
}

export function mapToQueryString(params, { valueFn = defaultEncodeValue, keyFn = (k) => k } = {}) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => [keyFn(k), valueFn(v)]);
  return new URLSearchParams(entries).toString();
}

export function ensurePathSlash(u) {
  const urlObj = u instanceof URL ? u : uri(u);
  if (!urlObj.pathname.endsWith("/")) {
    urlObj.pathname += "/";
  }
  return urlObj;
}