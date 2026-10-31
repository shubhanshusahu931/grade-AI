// src/services/api.js — single fetch wrapper every service calls through.
// Injects the Bearer token automatically and normalizes error handling.

import { API_BASE_URL } from "../config.js";
import { state, logout } from "../state.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {string} path - path relative to API_BASE_URL, e.g. "/auth/login"
 * @param {object} options - { method, body, auth }
 */
export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth && state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError("Network error — is the backend running?", 0);
  }

  if (response.status === 401) {
    // Token expired/invalid: force logout so the UI returns to the guest view.
    logout();
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : "Request failed";
    throw new ApiError(message, response.status);
  }

  return data;
}
