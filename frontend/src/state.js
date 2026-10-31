// src/state.js — tiny global state store + localStorage-backed auth token.
//
// Kept deliberately framework-free: a plain object plus a pub/sub list of
// listeners is enough for this SPA's needs and avoids pulling in a reactive
// framework for a vanilla-JS build.

import { TOKEN_STORAGE_KEY } from "./config.js";

const listeners = new Set();

export const state = {
  token: localStorage.getItem(TOKEN_STORAGE_KEY) || null,
  user: null,
  currentView: "dashboard",
  latestSync: null, // last SyncResponse
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

export function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    state.user = null;
  }
  notify();
}

export function setUser(user) {
  state.user = user;
  notify();
}

export function isAuthenticated() {
  return Boolean(state.token);
}

export function setView(view) {
  state.currentView = view;
  notify();
}

export function setLatestSync(syncResponse) {
  state.latestSync = syncResponse;
  notify();
}

export function logout() {
  setToken(null);
  state.user = null;
  state.latestSync = null;
  notify();
}
