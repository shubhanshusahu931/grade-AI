// src/components/userProfileModal.js — Public User Profile & Follow Modal
import { PLATFORM_LABELS } from "../config.js";
import { fetchUserProfile, toggleFollow } from "../services/userService.js";
import { showToast } from "./toast.js";
import { state, setUser } from "../state.js";

const PLATFORM_URLS = {
  codeforces: (h) => `https://codeforces.com/profile/${h}`,
  leetcode: (h) => `https://leetcode.com/${h}`,
  codechef: (h) => `https://www.codechef.com/users/${h}`,
  gfg: (h) => `https://auth.geeksforgeeks.org/user/${h}`,
  hackerrank: (h) => `https://www.hackerrank.com/${h}`,
  codetantra_url: (url) => url,
};

let currentModalUserId = null;
let onFollowChangedCallback = null;

export function initUserProfileModal({ onFollowChanged } = {}) {
  onFollowChangedCallback = onFollowChanged;
  const modal = document.getElementById("userProfileModal");
  if (!modal) return;

  const closeBtns = modal.querySelectorAll("[data-close='userProfileModal']");
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", () => closeUserProfileModal());
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeUserProfileModal();
  });

  const followBtn = document.getElementById("userProfileFollowBtn");
  if (followBtn) {
    followBtn.addEventListener("click", async () => {
      if (!currentModalUserId) return;
      followBtn.disabled = true;
      try {
        const res = await toggleFollow(currentModalUserId);
        showToast(res.message, res.is_following ? "success" : "default");
        updateFollowBtnState(res.is_following, res.followers_count);

        // Update state user following count if current user
        if (state.user) {
          const delta = res.is_following ? 1 : -1;
          const nextCount = Math.max(0, (state.user.following_count || 0) + delta);
          setUser({ ...state.user, following_count: nextCount });
        }

        if (onFollowChangedCallback) {
          onFollowChangedCallback(res);
        }
      } catch (err) {
        showToast(err.message || "Action failed", "error");
      } finally {
        followBtn.disabled = false;
      }
    });
  }
}

export function closeUserProfileModal() {
  const modal = document.getElementById("userProfileModal");
  if (modal) modal.hidden = true;
  currentModalUserId = null;
}

export async function openUserProfileModal(userId) {
  const modal = document.getElementById("userProfileModal");
  if (!modal) return;

  currentModalUserId = userId;
  modal.hidden = false;

  const loadingEl = document.getElementById("userProfileLoading");
  const contentEl = document.getElementById("userProfileContent");
  if (loadingEl) loadingEl.hidden = false;
  if (contentEl) contentEl.hidden = true;

  try {
    const user = await fetchUserProfile(userId);
    renderUserProfile(user);
    if (loadingEl) loadingEl.hidden = true;
    if (contentEl) contentEl.hidden = false;
  } catch (err) {
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="empty-state" style="color:var(--accent-rose);">${err.message || "Failed to load user profile"}</div>`;
    }
  }
}

function updateFollowBtnState(isFollowing, followersCount) {
  const followBtn = document.getElementById("userProfileFollowBtn");
  const followersCountEl = document.getElementById("userProfileFollowersCount");

  if (followersCountEl && typeof followersCount === "number") {
    followersCountEl.textContent = followersCount;
  }

  if (!followBtn) return;

  if (isFollowing) {
    followBtn.className = "btn btn--following";
    followBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Following</span>
    `;
  } else {
    followBtn.className = "btn btn--primary";
    followBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      <span>Follow</span>
    `;
  }
}

function renderUserProfile(u) {
  const avatarEl = document.getElementById("userProfileAvatar");
  const nameEl = document.getElementById("userProfileName");
  const collegeEl = document.getElementById("userProfileCollege");
  const bioEl = document.getElementById("userProfileBio");
  const followBtn = document.getElementById("userProfileFollowBtn");
  const followersCountEl = document.getElementById("userProfileFollowersCount");
  const followingCountEl = document.getElementById("userProfileFollowingCount");
  const solvedEl = document.getElementById("userProfileSolved");
  const scoreEl = document.getElementById("userProfileScore");
  const socialsContainer = document.getElementById("userProfileSocials");
  const handlesContainer = document.getElementById("userProfileHandles");

  // Avatar
  if (avatarEl) {
    if (u.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeHtml(u.avatar_url)}" alt="${escapeHtml(u.username)}" class="avatar-img" />`;
    } else {
      const initial = (u.username ? u.username[0] : "U").toUpperCase();
      avatarEl.textContent = initial;
    }
  }

  // Basic Info
  if (nameEl) nameEl.textContent = u.username || "Candidate";
  if (collegeEl) collegeEl.textContent = u.college || "Independent Candidate";
  if (bioEl) {
    bioEl.textContent = u.bio || "No bio added yet.";
    bioEl.classList.toggle("bio--empty", !u.bio);
  }

  // Follow Stats
  if (followersCountEl) followersCountEl.textContent = u.followers_count ?? 0;
  if (followingCountEl) followingCountEl.textContent = u.following_count ?? 0;

  // Follow button setup
  const isMe = state.user && state.user.id === u.id;
  if (followBtn) {
    if (isMe) {
      followBtn.className = "btn btn--outline btn--sm";
      followBtn.innerHTML = `<span>(You)</span>`;
      followBtn.disabled = true;
    } else {
      followBtn.disabled = false;
      updateFollowBtnState(u.is_following, u.followers_count);
    }
  }

  // Overall Stats
  if (solvedEl) solvedEl.textContent = (u.total_solved || 0).toLocaleString();
  if (scoreEl) {
    scoreEl.textContent = (u.composite_score || 0).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  // Social Links
  if (socialsContainer) {
    const socialItems = [];

    // Email
    if (u.email) {
      socialItems.push(`
        <a href="mailto:${escapeHtml(u.email)}" class="social-link social--email" title="Email: ${escapeHtml(u.email)}" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <span>Email</span>
        </a>
      `);
    }

    // Phone / WhatsApp
    if (u.phone) {
      const cleanPhone = u.phone.replace(/[^0-9+]/g, "");
      const waUrl = `https://wa.me/${cleanPhone.replace("+", "")}`;
      socialItems.push(`
        <a href="tel:${escapeHtml(cleanPhone)}" class="social-link social--phone" title="Call: ${escapeHtml(u.phone)}" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>${escapeHtml(u.phone)}</span>
        </a>
      `);
      socialItems.push(`
        <a href="${waUrl}" class="social-link social--wa" title="WhatsApp Chat" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.414z"/></svg>
          <span>WhatsApp</span>
        </a>
      `);
    }

    // GitHub
    if (u.github) {
      const ghUrl = u.github.startsWith("http") ? u.github : `https://github.com/${u.github}`;
      socialItems.push(`
        <a href="${escapeHtml(ghUrl)}" class="social-link social--github" title="GitHub Profile" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          <span>GitHub</span>
        </a>
      `);
    }

    // LinkedIn
    if (u.linkedin) {
      const liUrl = u.linkedin.startsWith("http") ? u.linkedin : `https://linkedin.com/in/${u.linkedin}`;
      socialItems.push(`
        <a href="${escapeHtml(liUrl)}" class="social-link social--linkedin" title="LinkedIn Profile" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
          <span>LinkedIn</span>
        </a>
      `);
    }

    // Instagram
    if (u.instagram) {
      const igClean = u.instagram.replace("@", "");
      const igUrl = igClean.startsWith("http") ? igClean : `https://instagram.com/${igClean}`;
      socialItems.push(`
        <a href="${escapeHtml(igUrl)}" class="social-link social--instagram" title="Instagram Profile" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          <span>Instagram</span>
        </a>
      `);
    }

    if (socialItems.length > 0) {
      socialsContainer.innerHTML = socialItems.join("");
    } else {
      socialsContainer.innerHTML = `<span class="empty-note">No social links added yet.</span>`;
    }
  }

  // Judge Handles list
  if (handlesContainer) {
    const handleChips = [];
    const handles = u.handles || {};
    for (const [key, val] of Object.entries(handles)) {
      if (!val) continue;
      const label = PLATFORM_LABELS[key] || key;
      const urlFn = PLATFORM_URLS[key];
      const targetUrl = urlFn ? urlFn(val) : null;
      if (targetUrl) {
        handleChips.push(`
          <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener" class="judge-chip chip--link">
            <span class="judge-chip__platform">${escapeHtml(label)}</span>
            <span class="judge-chip__handle font-mono">${escapeHtml(val)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        `);
      } else {
        handleChips.push(`
          <div class="judge-chip">
            <span class="judge-chip__platform">${escapeHtml(label)}</span>
            <span class="judge-chip__handle font-mono">${escapeHtml(val)}</span>
          </div>
        `);
      }
    }

    if (handleChips.length > 0) {
      handlesContainer.innerHTML = handleChips.join("");
    } else {
      handlesContainer.innerHTML = `<span class="empty-note">No public judge handles registered.</span>`;
    }
  }
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

