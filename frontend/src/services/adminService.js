// src/services/adminService.js — Superuser Admin governance API calls
import { apiFetch } from "./api.js";

export async function fetchAdminStats() {
  return apiFetch("/admin/stats", {
    method: "GET",
    auth: true,
  });
}

export async function fetchAdminUsers({ search = "", role = "", limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (role) params.append("role", role);
  params.append("limit", limit);
  params.append("offset", offset);

  return apiFetch(`/admin/users?${params.toString()}`, {
    method: "GET",
    auth: true,
  });
}

export async function updateAdminUser(userId, payload) {
  return apiFetch(`/admin/users/${userId}`, {
    method: "PUT",
    auth: true,
    body: payload,
  });
}

export async function deleteAdminUser(userId) {
  return apiFetch(`/admin/users/${userId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function forceSyncAdminUser(userId) {
  return apiFetch(`/admin/users/${userId}/sync`, {
    method: "POST",
    auth: true,
  });
}

