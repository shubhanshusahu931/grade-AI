// src/services/leaderboardService.js — fetch global + college rankings

import { apiFetch } from "./api.js";

export async function fetchLeaderboard(limit = 50) {
  return apiFetch(`/leaderboard?limit=${limit}`);
}
