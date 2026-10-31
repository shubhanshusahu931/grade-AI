// src/views/leaderboardView.js — Leaderboard View with Tabs and Search Filter
import { ApiError } from "../services/api.js";
import { fetchLeaderboard } from "../services/leaderboardService.js";
import { renderLeaderboardTable } from "../components/leaderboardTable.js";
import { showToast } from "../components/toast.js";

export function initLeaderboardView() {
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn[data-scope]"));
  const body = document.getElementById("leaderboardBody");
  const searchInput = document.getElementById("leaderboardSearch");

  let cachedResponse = null;
  let activeScope = "global";

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeScope = btn.dataset.scope;
      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      renderActiveScope();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderActiveScope();
    });
  }

  function renderActiveScope() {
    if (!cachedResponse) return;
    let entries =
      activeScope === "college" ? cachedResponse.college_rank : cachedResponse.global_rank;

    if (activeScope === "college" && !cachedResponse.college_rank) {
      if (body) {
        body.innerHTML = `<tr><td colspan="5" class="empty-row">Specify your College in Settings or Registration to view this ranking.</td></tr>`;
      }
      return;
    }

    if (!entries) entries = [];

    // Apply search filter if query exists
    const query = (searchInput?.value || "").trim().toLowerCase();
    if (query) {
      entries = entries.filter((e) => {
        const usernameMatch = e.username?.toLowerCase().includes(query);
        const collegeMatch = e.college?.toLowerCase().includes(query);
        return usernameMatch || collegeMatch;
      });
    }

    renderLeaderboardTable(entries);
  }

  async function load() {
    if (!cachedResponse && body) {
      body.innerHTML = `<tr><td colspan="5" class="empty-row">Loading rankings...</td></tr>`;
    }
    try {
      cachedResponse = await fetchLeaderboard(50);
      renderActiveScope();
    } catch (err) {
      if (body) body.innerHTML = `<tr><td colspan="5" class="empty-row">Couldn't load leaderboard.</td></tr>`;
      showToast(err instanceof ApiError ? err.message : "Failed to load leaderboard", "error");
    }
  }

  return { load };
}
