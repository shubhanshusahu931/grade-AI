// src/views/dashboardView.js — Dashboard View with Real-time Sync & Platform Grid
import { PLATFORM_LABELS } from "../config.js";
import { ApiError } from "../services/api.js";
import { syncProfile, fetchSyncStatus } from "../services/syncService.js";
import { setLatestSync, state } from "../state.js";
import { renderPlatformChart } from "../components/charts.js";
import { renderStatsCards } from "../components/statsCards.js";
import { showToast } from "../components/toast.js";

export function initDashboardView() {
  const syncBtn = document.getElementById("syncBtn");
  const syncBtnText = document.getElementById("syncBtnText");
  const syncDetails = document.getElementById("syncDetails");
  const greetingName = document.getElementById("dashGreetingName");

  function refreshGreeting() {
    if (greetingName && state.user) {
      greetingName.textContent = state.user.username || "Developer";
    }
  }

  function renderSyncDetails(platforms) {
    if (!syncDetails) return;
    if (!platforms || platforms.length === 0) {
      syncDetails.innerHTML = `<div class="empty-state">No sync history available. Click "Sync All Platforms" to start.</div>`;
      return;
    }

    syncDetails.innerHTML = platforms
      .map((p) => {
        const label = PLATFORM_LABELS[p.platform] || p.platform;
        if (p.success) {
          const ratingPart = p.rating ? ` · Rating: ${Math.round(p.rating)}` : "";
          return `
            <div class="sync-log-row sync-log-row--success font-mono">
              <span style="font-weight:700; color:var(--text-primary);">${label}</span>
              <span>${p.solved} Solved${ratingPart}</span>
            </div>
          `;
        }
        return `
          <div class="sync-log-row sync-log-row--fail font-mono">
            <span style="font-weight:700; color:var(--text-primary);">${label}</span>
            <span style="color:var(--accent-rose); font-size:0.8rem;">${p.error || "unavailable"}</span>
          </div>
        `;
      })
      .join("");
  }

  async function runSync(overrides = null) {
    const syncIcon = syncBtn?.querySelector(".sync-icon");
    if (syncBtn) syncBtn.disabled = true;
    if (syncIcon) syncIcon.classList.add("rotating");
    if (syncBtnText) syncBtnText.textContent = "Syncing Judges...";

    try {
      const result = await syncProfile(overrides);
      setLatestSync(result);
      renderStatsCards(result);
      renderPlatformChart(result.platforms);
      renderSyncDetails(result.platforms);
      showToast("All platform stats successfully synchronized!", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Sync failed. Check platform status.", "error");
    } finally {
      if (syncBtn) syncBtn.disabled = false;
      if (syncIcon) syncIcon.classList.remove("rotating");
      if (syncBtnText) syncBtnText.textContent = "Sync All Platforms";
    }
  }

  async function loadCachedStats() {
    refreshGreeting();
    try {
      const result = await fetchSyncStatus();
      if (result && result.last_synced_at) {
        setLatestSync(result);
        renderStatsCards(result);
        renderPlatformChart(result.platforms);
        renderSyncDetails(result.platforms);
      } else {
        renderStatsCards(null);
      }
    } catch {
      renderStatsCards(null);
    }
  }

  function refreshFromState() {
    refreshGreeting();
    renderStatsCards(state.latestSync);
    if (state.latestSync) {
      renderPlatformChart(state.latestSync.platforms);
      renderSyncDetails(state.latestSync.platforms);
    }
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", () => runSync());
  }

  return { runSync, refreshFromState, loadCachedStats, refreshGreeting };
}
