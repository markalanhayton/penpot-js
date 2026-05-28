'use strict';
/**
 * @module store
 * @description Potok-like state store with event dispatch, selectors, and effects.
 * Port of app.main.store (ClojureScript Potok) to pure ES JS.
 *
 * Usage:
 *   import { store, dispatch, select } from './store.js';
 *   store.registerEvent('set-profile', (state, profile) => ({ ...state, profile }));
 *   store.registerEffect('load-profile', async (payload, dispatch) => {
 *     const profile = await cmd('get-profile');
 *     dispatch('set-profile', profile);
 *   });
 *   dispatch('load-profile');
 */

class Signal {
  #value;
  #listeners = new Set();

  constructor(initial) { this.#value = initial; }

  get value() { return this.#value; }

  set(v) {
    const prev = this.#value;
    this.#value = v;
    if (v !== prev) {
      for (const fn of this.#listeners) fn(v, prev);
    }
  }

  update(fn) { this.set(fn(this.#value)); }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose() { this.#listeners.clear(); }
}

export class Store {
  #state;
  #signals = new Map();
  #eventHandlers = new Map();
  #effectHandlers = new Map();
  #subscribers = new Set();
  #dispatching = false;
  #queue = [];

  constructor(initial = {}) {
    this.#state = Object.freeze({ ...initial });
  }

  get(key) { return this.#state[key]; }

  set(key, value) {
    this.#state = Object.freeze({ ...this.#state, [key]: value });
    const signal = this.#signals.get(key);
    if (signal) signal.set(value);
    for (const fn of this.#subscribers) fn(this.#state);
  }

  update(updater) {
    this.#state = Object.freeze({ ...this.#state, ...updater(this.#state) });
    for (const [key, signal] of this.#signals) {
      if (key in this.#state) signal.set(this.#state[key]);
    }
    for (const fn of this.#subscribers) fn(this.#state);
  }

  snapshot() { return { ...this.#state }; }

  reset(state = {}) {
    this.#state = Object.freeze({ ...state });
    for (const [key, signal] of this.#signals) signal.set(this.#state[key]);
    for (const fn of this.#subscribers) fn(this.#state);
  }

  signal(key) {
    if (!this.#signals.has(key)) this.#signals.set(key, new Signal(this.#state[key]));
    return this.#signals.get(key);
  }

  subscribe(listener) {
    this.#subscribers.add(listener);
    return () => this.#subscribers.delete(listener);
  }

  registerEvent(type, handler) {
    this.#eventHandlers.set(type, handler);
  }

  registerEffect(type, handler) {
    this.#effectHandlers.set(type, handler);
  }

  dispatch(type, payload) {
    if (this.#dispatching) {
      this.#queue.push([type, payload]);
      return;
    }

    this.#dispatching = true;
    try {
      this.#applyEvent(type, payload);
      while (this.#queue.length > 0) {
        const [nextType, nextPayload] = this.#queue.shift();
        this.#applyEvent(nextType, nextPayload);
      }
    } finally {
      this.#dispatching = false;
    }
  }

  #applyEvent(type, payload) {
    const handler = this.#eventHandlers.get(type);
    if (handler) {
      const newState = handler(this.#state, payload);
      if (newState !== undefined && newState !== this.#state) {
        this.#state = Object.freeze({ ...newState });
        for (const [key, signal] of this.#signals) {
          if (key in this.#state) signal.set(this.#state[key]);
        }
        for (const fn of this.#subscribers) fn(this.#state);
      }
      return;
    }

    const effect = this.#effectHandlers.get(type);
    if (effect) {
      effect(payload, (t, p) => this.dispatch(t, p));
      return;
    }

    console.warn(`[store] Unknown event type: ${type}`);
  }
}

export const appStore = new Store({
  profile: null,
  teams: [],
  currentTeamId: null,
  currentProjectId: null,
  currentFileId: null,
  currentFile: null,
  route: 'login',
  routeParams: {},
  features: [],
  pendingRequests: 0,
  tool: 'select',
  zoom: 1,
  viewport: { x: 0, y: 0, width: 0, height: 0 },
  selectedIds: [],
  clipboard: null,
  wsConnected: false,
  onlineUsers: [],
  cursorPositions: [],
});

export function dispatch(type, payload) {
  return appStore.dispatch(type, payload);
}

export function select(key) {
  return appStore.get(key);
}

export function subscribe(listener) {
  return appStore.subscribe(listener);
}