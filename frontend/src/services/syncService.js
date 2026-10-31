// src/services/syncService.js — trigger a profile sync, optionally with
// handle overrides from the Settings tab.

import { apiFetch } from "./api.js";

/**
 * @param {object|null} overrides - partial HandlesUpdate, e.g. { leetcode: "foo" }
 */
export async function syncProfile(overrides = null) {
  return apiFetch("/sync", {
    method: "POST",
    body: overrides || {},
  });
}

export async function fetchSyncStatus() {
  return apiFetch("/sync/status", {
    method: "GET",
  });
}

export async function fetchUserHandles() {
  return apiFetch("/sync/handles", {
    method: "GET",
  });
}
