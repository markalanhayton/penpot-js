export class Observable {
  #observers = new Set();

  subscribe(callback) {
    this.#observers.add(callback);
    return () => this.#observers.delete(callback);
  }

  notify(data) {
    for (const observer of this.#observers) {
      try {
        observer(data);
      } catch (err) {
        console.error('Observable observer error:', err);
      }
    }
  }

  get size() {
    return this.#observers.size;
  }

  clear() {
    this.#observers.clear();
  }
}

export function filter(observable, predicate) {
  const filtered = new Observable();
  observable.subscribe((data) => {
    if (predicate(data)) filtered.notify(data);
  });
  return filtered;
}

export function map(observable, fn) {
  const mapped = new Observable();
  observable.subscribe((data) => {
    mapped.notify(fn(data));
  });
  return mapped;
}

export function debounce(observable, ms) {
  const debounced = new Observable();
  let timer;
  observable.subscribe((data) => {
    clearTimeout(timer);
    timer = setTimeout(() => debounced.notify(data), ms);
  });
  return debounced;
}

export function sample(observable, sampler) {
  const sampled = new Observable();
  let latestData;
  let hasData = false;

  observable.subscribe((data) => {
    latestData = data;
    hasData = true;
  });

  sampler.subscribe(() => {
    if (hasData) sampled.notify(latestData);
  });

  return sampled;
}

export class BehaviorSubject extends Observable {
  #value;

  constructor(initialValue) {
    super();
    this.#value = initialValue;
  }

  getValue() {
    return this.#value;
  }

  next(newValue) {
    this.#value = newValue;
    this.notify(newValue);
  }

  subscribe(callback) {
    callback(this.#value);
    return super.subscribe(callback);
  }
}