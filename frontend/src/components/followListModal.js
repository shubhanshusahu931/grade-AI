// src/components/followListModal.js — LeetCode-style Followers / Following Modal
import { fetchUserFollowers, fetchUserFollowing, toggleFollow } from "../services/userService.js";
import { openUserProfileModal } from "./userProfileModal.js";
import { showToast } from "./toast.js";
import { state, setUser } from "../state.js";

let currentTargetUserId = null;
let currentTab = "followers"; // 'followers' | 'following'
let followersList = [];
let followingList = [];
let searchQuery = "";
let onFollowChangeCallback = null;

export function initFollowListModal({ onFollowChange } = {}) {
  onFollowChangeCallback = onFollowChange;

  const modal = document.getElementById("followListModal");
  if (!modal) return;

  // Close triggers
  const closeBtns = modal.querySelectorAll("[data-close='followListModal']");
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", () => closeFollowListModal());
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeFollowListModal();
  });

  // Tab buttons
  const tabFollowers = document.getElementById("followTabFollowers");
  const tabFollowing = document.getElementById("followTabFollowing");

  if (tabFollowers) {
    tabFollowers.addEventListener("click", () => {
      if (currentTab !== "followers") {
        setTab("followers");
      }
    });
  }

  if (tabFollowing) {
    tabFollowing.addEventListener("click", () => {
      if (currentTab !== "following") {
        setTab("following");
      }
    });
  }

  // Search input
  const searchInput = document.getElementById("followSearchInput");
  const clearBtn = document.getElementById("followSearchClear");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = (e.target.value || "").trim().toLowerCase();
      if (clearBtn) clearBtn.hidden = !searchQuery;
      renderCurrentList();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchQuery = "";
        clearBtn.hidden = true;
        searchInput.focus();
        renderCurrentList();
      }
    });
  }
}

export function closeFollowListModal() {
  const modal = document.getElementById("followListModal");
  if (modal) modal.hidden = true;
  currentTargetUserId = null;
  searchQuery = "";
  const searchInput = document.getElementById("followSearchInput");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("followSearchClear");
  if (clearBtn) clearBtn.hidden = true;
}

export async function openFollowListModal(userId, initialTab = "followers", meta = {}) {
  const modal = document.getElementById("followListModal");
  if (!modal) return;

  currentTargetUserId = userId || (state.user ? state.user.id : null);
  if (!currentTargetUserId) {
    showToast("Please log in to view community network", "default");
    return;
  }

  currentTab = initialTab === "following" ? "following" : "followers";
  searchQuery = "";
  const searchInput = document.getElementById("followSearchInput");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("followSearchClear");
  if (clearBtn) clearBtn.hidden = true;

  // Title & Subtitle
  const titleEl = document.getElementById("followModalTitle");
  const subtitleEl = document.getElementById("followModalSubtitle");
  if (titleEl) {
    const isSelf = state.user && state.user.id === currentTargetUserId;
    titleEl.textContent = isSelf
      ? "My Network"
      : meta.username
      ? `${meta.username}'s Network`
      : "Community Network";
  }
  if (subtitleEl) {
    subtitleEl.textContent = "Competitive coders & campus peers";
  }

  updateTabUI();
  modal.hidden = false;

  // Show loading skeleton
  setLoading(true);

  try {
    // Fetch both followers and following concurrently
    const [followersData, followingData] = await Promise.all([
      fetchUserFollowers(currentTargetUserId).catch(() => []),
      fetchUserFollowing(currentTargetUserId).catch(() => []),
    ]);

    followersList = Array.isArray(followersData) ? followersData : [];
    followingList = Array.isArray(followingData) ? followingData : [];

    // Update tab badges
    updateBadges();

    // Render active tab
    renderCurrentList();
  } catch (err) {
    showToast(err.message || "Failed to load network", "error");
  } finally {
    setLoading(false);
  }
}

function setTab(tab) {
  currentTab = tab;
  updateTabUI();
  renderCurrentList();
}

function updateTabUI() {
  const tabFollowers = document.getElementById("followTabFollowers");
  const tabFollowing = document.getElementById("followTabFollowing");

  if (tabFollowers) {
    tabFollowers.classList.toggle("active", currentTab === "followers");
  }
  if (tabFollowing) {
    tabFollowing.classList.toggle("active", currentTab === "following");
  }

  const searchInput = document.getElementById("followSearchInput");
  if (searchInput) {
    searchInput.placeholder =
      currentTab === "followers"
        ? "Search followers by username or college..."
        : "Search following by username or college...";
  }
}

function updateBadges() {
  const followersBadge = document.getElementById("followTabFollowersBadge");
  const followingBadge = document.getElementById("followTabFollowingBadge");

  if (followersBadge) followersBadge.textContent = followersList.length;
  if (followingBadge) followingBadge.textContent = followingList.length;
}

function setLoading(isLoading) {
  const loadingEl = document.getElementById("followListLoading");
  const listEl = document.getElementById("followUsersList");
  const emptyEl = document.getElementById("followEmptyState");

  if (loadingEl) loadingEl.hidden = !isLoading;
  if (isLoading) {
    if (listEl) listEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = true;
  }
}

function renderCurrentList() {
  const listEl = document.getElementById("followUsersList");
  const emptyEl = document.getElementById("followEmptyState");
  const emptyTitle = document.getElementById("followEmptyTitle");
  const emptyDesc = document.getElementById("followEmptyDesc");

  if (!listEl) return;

  const rawList = currentTab === "followers" ? followersList : followingList;

  // Filter with search query
  let items = rawList;
  if (searchQuery) {
    items = rawList.filter((u) => {
      const name = (u.username || "").toLowerCase();
      const college = (u.college || "").toLowerCase();
      return name.includes(searchQuery) || college.includes(searchQuery);
    });
  }

  if (items.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.hidden = false;
      if (searchQuery) {
        if (emptyTitle) emptyTitle.textContent = "No matches found";
        if (emptyDesc) emptyDesc.textContent = `No coders matching "${searchQuery}".`;
      } else {
        if (emptyTitle) {
          emptyTitle.textContent =
            currentTab === "followers" ? "No followers yet" : "Not following anyone";
        }
        if (emptyDesc) {
          emptyDesc.textContent =
            currentTab === "followers"
              ? "When other programmers follow this coder, they will show up here."
              : "Discover top programmers from the leaderboard and connect with them!";
        }
      }
    }
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  const currentUserId = state.user?.id;

  listEl.innerHTML = items
    .map((user) => {
      const isSelf = currentUserId && currentUserId === user.user_id;
      const initial = (user.username || "U").charAt(0).toUpperCase();
      const solved = user.total_solved || 0;
      const score = Math.round(user.composite_score || 0);

      const followBtnHtml = isSelf
        ? `<span class="follow-user-self-tag">You</span>`
        : `
          <button class="btn btn--sm ${user.is_following ? "btn--following" : "btn--primary"} follow-action-btn" data-user-id="${user.user_id}">
            ${user.is_following ? "<span>Following</span>" : "<span>+ Follow</span>"}
          </button>
        `;

      return `
        <div class="follow-user-card" data-user-id="${user.user_id}">
          <div class="follow-user-card__left" data-action="open-profile" data-user-id="${user.user_id}">
            <div class="follow-user-avatar">${initial}</div>
            <div class="follow-user-info">
              <div class="follow-user-name-row">
                <span class="follow-user-name">${escapeHtml(user.username)}</span>
              </div>
              <div class="follow-user-meta">
                ${user.college ? `<span class="follow-user-college">${escapeHtml(user.college)}</span><span class="meta-dot">•</span>` : ""}
                <span class="follow-user-solved font-mono">${solved} solved</span>
                ${score > 0 ? `<span class="meta-dot">•</span><span class="follow-user-score font-mono">${score} pts</span>` : ""}
              </div>
            </div>
          </div>
          <div class="follow-user-card__right">
            ${followBtnHtml}
          </div>
        </div>
      `;
    })
    .join("");

  // Attach event handlers
  // 1. Open profile when clicking card left
  listEl.querySelectorAll("[data-action='open-profile']").forEach((el) => {
    el.addEventListener("click", () => {
      const uid = el.getAttribute("data-user-id");
      if (uid) {
        closeFollowListModal();
        openUserProfileModal(uid);
      }
    });
  });

  // 2. Follow / Following buttons
  listEl.querySelectorAll(".follow-action-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const uid = btn.getAttribute("data-user-id");
      if (!uid) return;

      btn.disabled = true;
      try {
        const res = await toggleFollow(uid);
        showToast(res.message, res.is_following ? "success" : "default");

        // Update local object in lists
        const updateInList = (list) => {
          const item = list.find((u) => u.user_id === uid);
          if (item) item.is_following = res.is_following;
        };
        updateInList(followersList);
        updateInList(followingList);

        // Update current user state following_count
        if (state.user) {
          const delta = res.is_following ? 1 : -1;
          const nextCount = Math.max(0, (state.user.following_count || 0) + delta);
          setUser({ ...state.user, following_count: nextCount });
        }

        // Re-render button state
        if (res.is_following) {
          btn.className = "btn btn--sm btn--following follow-action-btn";
          btn.innerHTML = "<span>Following</span>";
        } else {
          btn.className = "btn btn--sm btn--primary follow-action-btn";
          btn.innerHTML = "<span>+ Follow</span>";
        }

        // Notify parent / external view
        if (onFollowChangeCallback) {
          onFollowChangeCallback(res);
        }
      } catch (err) {
        showToast(err.message || "Failed to update follow status", "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

