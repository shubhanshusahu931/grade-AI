// src/services/authService.js — login & register calls

import { apiFetch } from "./api.js";

export async function registerUser({ username, email, password, college }) {
  return apiFetch("/auth/register", {
    method: "POST",
    auth: false,
    body: { username, email, password, college: college || null },
  });
}

export async function loginUser({ email, password }) {
  return apiFetch("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export async function fetchCurrentUser() {
  return apiFetch("/auth/me", {
    method: "GET",
    auth: true,
  });
}

export async function updateProfile(data) {
  return apiFetch("/auth/profile", {
    method: "PUT",
    auth: true,
    body: data,
  });
}

