// src/views/dashboardView.js — Dashboard View with Real-time Sync & Platform Grid
import { PLATFORM_LABELS } from "../config.js";
import { ApiError } from "../services/api.js";
import { syncProfile, fetchSyncStatus } from "../services/syncService.js";
import { setLatestSync, setView, state } from "../state.js";
import { renderPlatformChart } from "../components/charts.js";
import { renderStatsCards } from "../components/statsCards.js";
import { showToast } from "../components/toast.js";

export function initDashboardView({ onNavigate } = {}) {
  const syncBtn = document.getElementById("syncBtn");
  const syncBtnText = document.getElementById("syncBtnText");
  const syncDetails = document.getElementById("syncDetails");
  const greetingName = document.getElementById("dashGreetingName");
  const userBioEl = document.getElementById("dashUserBio");
  const followersCountEl = document.getElementById("dashFollowersCount");
  const followingCountEl = document.getElementById("dashFollowingCount");
  const socialsBarEl = document.getElementById("dashSocialsBar");
  const editProfileBtn = document.getElementById("dashEditProfileBtn");

  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
      setView("settings");
      if (onNavigate) onNavigate("settings");
    });
  }

  function refreshGreeting() {
    if (!state.user) return;
    const u = state.user;

    if (greetingName) {
      greetingName.textContent = u.username || "Developer";
    }

    if (userBioEl) {
      if (u.bio) {
        userBioEl.textContent = u.bio;
        userBioEl.style.display = "block";
      } else {
        userBioEl.style.display = "none";
      }
    }

    if (followersCountEl) {
      followersCountEl.textContent = u.followers_count ?? 0;
    }

    if (followingCountEl) {
      followingCountEl.textContent = u.following_count ?? 0;
    }

    if (socialsBarEl) {
      const links = [];
      if (u.github) {
        const gh = u.github.startsWith("http") ? u.github : `https://github.com/${u.github}`;
        links.push(`<a href="${escapeHtml(gh)}" target="_blank" rel="noopener" class="dash-social-pill" title="GitHub">GitHub</a>`);
      }
      if (u.linkedin) {
        const li = u.linkedin.startsWith("http") ? u.linkedin : `https://linkedin.com/in/${u.linkedin}`;
        links.push(`<a href="${escapeHtml(li)}" target="_blank" rel="noopener" class="dash-social-pill" title="LinkedIn">LinkedIn</a>`);
      }
      if (u.instagram) {
        const ig = u.instagram.replace("@", "");
        const url = ig.startsWith("http") ? ig : `https://instagram.com/${ig}`;
        links.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="dash-social-pill" title="Instagram">Instagram</a>`);
      }
      if (u.phone) {
        links.push(`<a href="tel:${escapeHtml(u.phone)}" class="dash-social-pill" title="Contact No">${escapeHtml(u.phone)}</a>`);
      }

      socialsBarEl.innerHTML = links.join("");
      socialsBarEl.style.display = links.length > 0 ? "flex" : "none";
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

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
