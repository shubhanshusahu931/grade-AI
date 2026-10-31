// src/state.js — tiny global state store + localStorage-backed auth token.
//
// Kept deliberately framework-free: a plain object plus a pub/sub list of
// listeners is enough for this SPA's needs and avoids pulling in a reactive
// framework for a vanilla-JS build.

import { TOKEN_STORAGE_KEY } from "./config.js";

const USER_STORAGE_KEY = "industry_grade_ai_cached_user";
const SYNC_STORAGE_KEY = "industry_grade_ai_cached_sync";

function getCached(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

const listeners = new Set();

export const state = {
  token: localStorage.getItem(TOKEN_STORAGE_KEY) || null,
  user: getCached(USER_STORAGE_KEY),
  currentView: "dashboard",
  latestSync: getCached(SYNC_STORAGE_KEY),
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
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(SYNC_STORAGE_KEY);
    state.user = null;
    state.latestSync = null;
  }
  notify();
}

export function setUser(user) {
  state.user = user;
  if (user) {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {}
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
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
  if (syncResponse) {
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncResponse));
    } catch {}
  } else {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  }
  notify();
}

export function logout() {
  setToken(null);
  state.user = null;
  state.latestSync = null;
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(SYNC_STORAGE_KEY);
  notify();
}
