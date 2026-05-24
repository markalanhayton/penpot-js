// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

/* global performance, console */

import * as mth from "./math.js";
import * as uuid from "./uuid.js";

export function timestamp() {
  return performance.now();
}

const measures = new Map();

export function start(key) {
  if (key === undefined) {
    key = uuid.next();
  }
  measures.set(key, timestamp());
  return key;
}

export function measure(key) {
  return timestamp() - (measures.get(key) || 0);
}

export function scaleTime(measurementMs) {
  if (measurementMs > 60000) return [1 / 60000, "min"];
  if (measurementMs < 0.001) return [1e6, "ns"];
  if (measurementMs < 1) return [1e3, "\u00B5s"];
  if (measurementMs < 1000) return [1, "ms"];
  return [1 / 1000, "sec"];
}

export function formatTime(value) {
  const [scale, unit] = scaleTime(value);
  return `${mth.precision(scale * value, 2)}${unit}`;
}

export function benchmark({ f, name = "unnamed", samples = 10, target = 1, maxIterations = 100000 } = {}) {
  const execAndMeasure = () => {
    const t0 = performance.now();
    const x = f();
    const t1 = performance.now();
    if (x === undefined) {
      throw new Error("missing return value");
    }
    return (t1 - t0) / 1000;
  };

  const calculateIterations = (singleDuration, minimum) => {
    const result = Math.floor((samples * target) / Math.max(singleDuration, minimum));
    return Math.min(result, maxIterations);
  };

  let iterations = calculateIterations(execAndMeasure(), 0.0001);

  console.log("=> benchmarking:", name);
  console.log("--> WARM: ", iterations);

  let warmT = 0;
  for (let i = 0; i < iterations; i++) {
    warmT += execAndMeasure();
  }
  iterations = calculateIterations(warmT / iterations, 0.00001);

  console.log("--> BENCH:", iterations);

  let benchT = 0;
  for (let i = 0; i < iterations; i++) {
    benchT += execAndMeasure();
  }

  const mean = benchT / iterations;
  console.log("--> TOTAL:", formatTime(benchT));
  console.log("--> MEAN: ", formatTime(mean));

  return { iterations, total: benchT, mean };
}