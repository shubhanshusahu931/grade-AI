// src/components/statsCards.js — Renders KPI Stat Cards & Platform Breakdown Cards
import { PLATFORM_LABELS, PLATFORM_META } from "../config.js";
import { state } from "../state.js";

function getScoreTier(score) {
  if (score >= 4000) return { label: "Legendary Grandmaster", color: "#f43f5e" };
  if (score >= 2500) return { label: "International Master", color: "#f59e0b" };
  if (score >= 1500) return { label: "Master Tier", color: "#a855f7" };
  if (score >= 800) return { label: "Candidate Master", color: "#3b82f6" };
  if (score >= 300) return { label: "Specialist", color: "#10b981" };
  if (score > 0) return { label: "Practicing Coder", color: "#38bdf8" };
  return { label: "Novice Tier", color: "#94a3b8" };
}

export function renderStatsCards(syncResponse) {
  const totalEl = document.getElementById("statTotalSolved");
  const scoreEl = document.getElementById("statCompositeScore");
  const tierEl = document.getElementById("statTierBadge");
  const rankEl = document.getElementById("statRankDisplay");
  const rankSubtextEl = document.getElementById("statRankSubtext");
  const syncedEl = document.getElementById("statLastSynced");
  const statusIndicator = document.getElementById("statStatusIndicator");
  const cardsGrid = document.getElementById("platformCardsGrid");

  if (!syncResponse) {
    if (totalEl) totalEl.textContent = "0";
    if (scoreEl) scoreEl.textContent = "0.00";
    if (tierEl) {
      tierEl.textContent = "Novice Tier";
      tierEl.style.color = "#94a3b8";
    }
    if (syncedEl) syncedEl.textContent = "Never";
    if (statusIndicator) {
      statusIndicator.innerHTML = '<span class="status-dot"></span> Ready to sync';
    }
    renderPlatformCards([]);
    return;
  }

  // Solved & Composite Score
  if (totalEl) totalEl.textContent = (syncResponse.total_solved || 0).toLocaleString();
  const score = syncResponse.composite_score || 0.0;
  if (scoreEl) {
    scoreEl.textContent = score.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Tier Badge
  if (tierEl) {
    const tier = getScoreTier(score);
    tierEl.textContent = tier.label;
    tierEl.style.borderColor = tier.color;
    tierEl.style.color = tier.color;
    tierEl.style.background = `${tier.color}18`;
  }

  // Last Synced Date
  if (syncedEl && syncResponse.last_synced_at) {
    const syncedDate = new Date(syncResponse.last_synced_at);
    syncedEl.textContent = syncedDate.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  }

  if (statusIndicator) {
    statusIndicator.innerHTML = '<span class="status-dot" style="background:#10b981;"></span> Synchronized';
  }

  renderPlatformCards(syncResponse.platforms || []);
}

function renderPlatformCards(platforms) {
  const cardsGrid = document.getElementById("platformCardsGrid");
  if (!cardsGrid) return;

  const ALL_PLATFORMS = [
    "codeforces",
    "leetcode",
    "codechef",
    "gfg",
    "hackerrank",
    "codetantra",
    "hackerearth",
    "takeuforward",
    "codingninjas",
  ];
  const platformMap = new Map();
  platforms.forEach((p) => platformMap.set(p.platform, p));

  cardsGrid.innerHTML = ALL_PLATFORMS.map((platformKey) => {
    const meta = PLATFORM_META[platformKey] || {
      name: PLATFORM_LABELS[platformKey] || platformKey,
      color: "#38bdf8",
      badge: platformKey.substring(0, 2).toUpperCase(),
      urlPrefix: null,
    };

    const pData = platformMap.get(platformKey);
    const isConfigured = Boolean(pData);
    const isSuccess = Boolean(pData && pData.success);
    const solved = isSuccess ? pData.solved || 0 : 0;
    const rating = isSuccess && pData.rating ? pData.rating : null;
    const handle = pData?.raw?.handle || pData?.raw?.student_id || (state.user?.email ? state.user.email.split("@")[0] : "—");

    let statusPill = "";
    if (!isConfigured) {
      statusPill = '<span class="platform-status-pill status--unconfigured">Not Synced</span>';
    } else if (isSuccess) {
      statusPill = '<span class="platform-status-pill status--synced">Active</span>';
    } else {
      statusPill = `<span class="platform-status-pill status--failed" title="${escapeHtml(pData.error || "Failed")}">Failed</span>`;
    }

    const ratingDisplay = rating
      ? `<span class="platform-rating-tag font-mono">Rating: ${Math.round(rating)}</span>`
      : "";

    return `
      <div class="platform-card">
        <div class="platform-card__left">
          <div class="platform-avatar" style="background: ${meta.color}22; color: ${meta.color}; border: 1px solid ${meta.color}44;">
            ${meta.badge}
          </div>
          <div class="platform-card__info">
            <h4>${meta.name}</h4>
            <span class="platform-handle">@${escapeHtml(handle)}</span>
          </div>
        </div>
        <div class="platform-card__right">
          <span class="platform-solved-badge">${solved.toLocaleString()} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">solved</span></span>
          ${ratingDisplay}
          ${statusPill}
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
