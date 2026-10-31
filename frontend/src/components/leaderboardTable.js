// src/components/leaderboardTable.js — Renders Podium & Leaderboard Table with Profile Modal Triggers
import { openUserProfileModal } from "./userProfileModal.js";
import { state } from "../state.js";

export function renderLeaderboardTable(entries) {
  const body = document.getElementById("leaderboardBody");
  const podium = document.getElementById("leaderboardPodium");
  const countEl = document.getElementById("leaderboardCount");

  if (!entries || entries.length === 0) {
    if (body) body.innerHTML = `<tr><td colspan="6" class="empty-row">No ranked users recorded yet.</td></tr>`;
    if (podium) podium.innerHTML = "";
    if (countEl) countEl.textContent = "0 candidates";
    return;
  }

  if (countEl) countEl.textContent = `${entries.length} candidates listed`;

  // Render Podium for Top 3
  if (podium) {
    const top3 = entries.slice(0, 3);
    const podiumHtml = [];

    // Order for visual podium: 2nd place (left), 1st place (center), 3rd place (right)
    const positions = [
      { item: top3[1], rank: 2, badge: "🥈", cls: "podium-card--2" },
      { item: top3[0], rank: 1, badge: "🥇", cls: "podium-card--1" },
      { item: top3[2], rank: 3, badge: "🥉", cls: "podium-card--3" },
    ];

    positions.forEach((pos) => {
      if (!pos.item) return;
      const initial = (pos.item.username ? pos.item.username[0] : "C").toUpperCase();
      podiumHtml.push(`
        <div class="podium-card ${pos.cls}" data-user-id="${pos.item.user_id}" title="Click to view ${escapeHtml(pos.item.username)}'s profile">
          <span class="podium-badge">${pos.badge}</span>
          <div class="podium-avatar">${initial}</div>
          <div class="podium-name">${escapeHtml(pos.item.username)}</div>
          <div class="podium-college">${pos.item.college ? escapeHtml(pos.item.college) : "Independent Coder"}</div>
          <div class="podium-score">${pos.item.composite_score.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
          <div class="podium-solved">${pos.item.total_solved.toLocaleString()} solved</div>
          <button class="podium-action-btn">View Profile</button>
        </div>
      `);
    });

    podium.innerHTML = podiumHtml.join("");

    // Bind click events on podium cards
    podium.querySelectorAll(".podium-card[data-user-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const uid = card.getAttribute("data-user-id");
        if (uid) openUserProfileModal(uid);
      });
    });
  }

  // Render Rank Table Rows
  const currentUserId = state.user?.id;

  if (body) {
    body.innerHTML = entries
      .map((e) => {
        const isCurrentUser = currentUserId && e.user_id === currentUserId;
        const initial = (e.username ? e.username[0] : "C").toUpperCase();

        let rankBadge = `#${e.rank}`;
        if (e.rank === 1) rankBadge = "🥇";
        else if (e.rank === 2) rankBadge = "🥈";
        else if (e.rank === 3) rankBadge = "🥉";

        return `
          <tr class="${isCurrentUser ? "user-row--active" : ""} candidate-row" data-user-id="${e.user_id}">
            <td><span class="rank-medal">${rankBadge}</span></td>
            <td>
              <div class="candidate-cell">
                <div class="candidate-avatar">${initial}</div>
                <div>
                  <span class="candidate-name">${escapeHtml(e.username)}</span>
                  ${isCurrentUser ? '<span class="you-tag">YOU</span>' : ""}
                </div>
              </div>
            </td>
            <td><span style="color:var(--text-secondary);">${e.college ? escapeHtml(e.college) : "—"}</span></td>
            <td class="solved-cell">${e.total_solved.toLocaleString()}</td>
            <td class="score-cell">${e.composite_score.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
            <td style="text-align:right;">
              <button class="btn btn--xs btn--outline btn-view-profile" data-user-id="${e.user_id}" title="View profile & connect">
                <span>Connect</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Bind click events on candidate rows and buttons
    body.querySelectorAll(".candidate-row[data-user-id]").forEach((row) => {
      row.addEventListener("click", (evt) => {
        const uid = row.getAttribute("data-user-id");
        if (uid) openUserProfileModal(uid);
      });
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
