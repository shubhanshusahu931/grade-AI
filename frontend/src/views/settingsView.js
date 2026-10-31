// src/views/settingsView.js — Settings View (Edit Profile, Social Links & Platform Handles)
import { ApiError } from "../services/api.js";
import { updateProfile } from "../services/authService.js";
import { fetchUserHandles } from "../services/syncService.js";
import { openUserProfileModal } from "../components/userProfileModal.js";
import { showToast } from "../components/toast.js";
import { state, setUser } from "../state.js";

const HANDLE_FIELD_IDS = {
  codeforces: "h_codeforces",
  leetcode: "h_leetcode",
  codechef: "h_codechef",
  gfg: "h_gfg",
  hackerrank: "h_hackerrank",
  codetantra_url: "h_codetantra_url",
  codetantra_id: "h_codetantra_id",
};

export function initSettingsView({ onSaveAndSync }) {
  const handlesForm = document.getElementById("handlesForm");
  const profileForm = document.getElementById("profileForm");

  const avatarEl = document.getElementById("settingsAvatar");
  const nameEl = document.getElementById("settingsUserName");
  const emailEl = document.getElementById("settingsUserEmail");
  const collegeEl = document.getElementById("settingsUserCollege");
  const bioEl = document.getElementById("settingsUserBio");
  const followersEl = document.getElementById("settingsFollowersCount");
  const followingEl = document.getElementById("settingsFollowingCount");
  const socialBadgesEl = document.getElementById("settingsSocialBadges");
  const previewProfileBtn = document.getElementById("previewProfileBtn");
  const prefixEl = document.getElementById("settingsPrefixBadge");

  // Input elements for profile
  const pUsername = document.getElementById("p_username");
  const pCollege = document.getElementById("p_college");
  const pBio = document.getElementById("p_bio");
  const pPhone = document.getElementById("p_phone");
  const pGithub = document.getElementById("p_github");
  const pLinkedin = document.getElementById("p_linkedin");
  const pInstagram = document.getElementById("p_instagram");
  const pAvatarUrl = document.getElementById("p_avatar_url");

  function refreshUserProfile() {
    if (!state.user) return;
    const u = state.user;

    // Avatar
    if (avatarEl) {
      if (u.avatar_url) {
        avatarEl.innerHTML = `<img src="${escapeHtml(u.avatar_url)}" alt="${escapeHtml(u.username)}" class="avatar-img" />`;
      } else {
        avatarEl.textContent = (u.username ? u.username[0] : "U").toUpperCase();
      }
    }

    if (nameEl) nameEl.textContent = u.username || "Developer";
    if (emailEl) emailEl.textContent = u.email || "";
    if (collegeEl) collegeEl.textContent = u.college || "Independent Candidate";
    if (bioEl) {
      bioEl.textContent = u.bio ? `"${u.bio}"` : "No bio added yet.";
      bioEl.style.display = u.bio ? "block" : "none";
    }

    if (followersEl) followersEl.textContent = u.followers_count ?? 0;
    if (followingEl) followingEl.textContent = u.following_count ?? 0;

    if (prefixEl && u.email) {
      prefixEl.textContent = u.email.split("@")[0];
    }

    // Populate profile form inputs
    if (pUsername) pUsername.value = u.username || "";
    if (pCollege) pCollege.value = u.college || "";
    if (pBio) pBio.value = u.bio || "";
    if (pPhone) pPhone.value = u.phone || "";
    if (pGithub) pGithub.value = u.github || "";
    if (pLinkedin) pLinkedin.value = u.linkedin || "";
    if (pInstagram) pInstagram.value = u.instagram || "";
    if (pAvatarUrl) pAvatarUrl.value = u.avatar_url || "";

    // Render active social badges preview in user card
    if (socialBadgesEl) {
      const badges = [];
      if (u.github) {
        badges.push(`<span class="badge-social badge--gh" title="GitHub: ${escapeHtml(u.github)}">GH</span>`);
      }
      if (u.linkedin) {
        badges.push(`<span class="badge-social badge--li" title="LinkedIn: ${escapeHtml(u.linkedin)}">LI</span>`);
      }
      if (u.instagram) {
        badges.push(`<span class="badge-social badge--ig" title="Instagram: ${escapeHtml(u.instagram)}">IG</span>`);
      }
      if (u.phone) {
        badges.push(`<span class="badge-social badge--ph" title="Phone: ${escapeHtml(u.phone)}">TEL</span>`);
      }
      socialBadgesEl.innerHTML = badges.length > 0 ? badges.join("") : `<span class="empty-hint">No socials added</span>`;
    }
  }

  // Preview button
  if (previewProfileBtn) {
    previewProfileBtn.addEventListener("click", () => {
      if (state.user?.id) {
        openUserProfileModal(state.user.id);
      }
    });
  }

  // Profile Form submit
  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        username: pUsername?.value.trim() || undefined,
        college: pCollege?.value.trim() || "",
        bio: pBio?.value.trim() || "",
        phone: pPhone?.value.trim() || "",
        github: pGithub?.value.trim() || "",
        linkedin: pLinkedin?.value.trim() || "",
        instagram: pInstagram?.value.trim() || "",
        avatar_url: pAvatarUrl?.value.trim() || "",
      };

      const submitBtn = profileForm.querySelector("button[type=submit]");
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>Saving Profile...</span>";

      try {
        const updatedUser = await updateProfile(payload);
        setUser(updatedUser);
        refreshUserProfile();
        showToast("Profile & social links saved successfully!", "success");
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Failed to update profile", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Handles Form submit
  if (handlesForm) {
    handlesForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const overrides = {};
      for (const [field, elementId] of Object.entries(HANDLE_FIELD_IDS)) {
        const input = document.getElementById(elementId);
        if (input) {
          const value = input.value.trim();
          if (value) overrides[field] = value;
        }
      }

      const submitBtn = handlesForm.querySelector("button[type=submit]");
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>Saving & Syncing...</span>";

      try {
        await onSaveAndSync(overrides);
        showToast("Platform handles saved and synced successfully!", "success");
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "Failed to save handles", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  async function loadHandles() {
    refreshUserProfile();
    try {
      const handles = await fetchUserHandles();
      if (!handles) return;
      for (const [field, elementId] of Object.entries(HANDLE_FIELD_IDS)) {
        const input = document.getElementById(elementId);
        if (input && handles[field]) {
          input.value = handles[field];
        }
      }
    } catch {
      // ignore silently
    }
  }

  return { loadHandles, refreshUserProfile };
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
