// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

const VERSION_RE =
  /^(([A-Za-z]+)-?)?((\d+)\.(\d+)\.(\d+))(-?((RC|DEV)(\d+)?)?)?(-?(\d+))?(-?g(\w+))?$/;

export function parse(data) {
  if (typeof data !== "string") {
    return null;
  }

  if (data.startsWith("%") || data === "develop") {
    return {
      full: "develop",
      branch: "develop",
      base: "0.0.0",
      main: "0.0",
      major: "0",
      minor: "0",
      patch: "0",
      modifier: null,
      commit: null,
      commitHash: null,
    };
  }

  const result = VERSION_RE.exec(data);
  if (!result) {
    return null;
  }

  const major = result[4];
  const minor = result[5];
  const patch = result[6];
  const base = result[3];
  const main = `${major}.${minor}`;
  const branch = result[2] || null;

  return {
    full: data,
    base,
    main,
    major,
    minor,
    patch,
    branch,
    modifier: result[8] || null,
    commit: result[12] || null,
    commitHash: result[14] || null,
  };
}