// src/services/userService.js — Public User Profiles & Follow Actions
import { apiFetch } from "./api.js";

export async function fetchUserProfile(userId) {
  return apiFetch(`/users/${userId}/profile`, {
    method: "GET",
    auth: true,
  });
}

export async function toggleFollow(userId) {
  return apiFetch(`/users/${userId}/follow`, {
    method: "POST",
    auth: true,
  });
}

export async function fetchUserFollowers(userId) {
  return apiFetch(`/users/${userId}/followers`, {
    method: "GET",
    auth: true,
  });
}

export async function fetchUserFollowing(userId) {
  return apiFetch(`/users/${userId}/following`, {
    method: "GET",
    auth: true,
  });
}

