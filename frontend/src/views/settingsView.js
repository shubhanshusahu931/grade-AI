// src/views/settingsView.js — Settings View & Platform Handles Manager
import { ApiError } from "../services/api.js";
import { fetchUserHandles } from "../services/syncService.js";
import { showToast } from "../components/toast.js";
import { state } from "../state.js";

const FIELD_IDS = {
  codeforces: "h_codeforces",
  leetcode: "h_leetcode",
  codechef: "h_codechef",
  gfg: "h_gfg",
  hackerrank: "h_hackerrank",
  codetantra_url: "h_codetantra_url",
  codetantra_id: "h_codetantra_id",
};

export function initSettingsView({ onSaveAndSync }) {
  const form = document.getElementById("handlesForm");
  const avatarEl = document.getElementById("settingsAvatar");
  const nameEl = document.getElementById("settingsUserName");
  const emailEl = document.getElementById("settingsUserEmail");
  const collegeEl = document.getElementById("settingsUserCollege");
  const prefixEl = document.getElementById("settingsPrefixBadge");

  function refreshUserProfile() {
    if (!state.user) return;
    const u = state.user;
    if (avatarEl) avatarEl.textContent = (u.username ? u.username[0] : "U").toUpperCase();
    if (nameEl) nameEl.textContent = u.username || "Developer";
    if (emailEl) emailEl.textContent = u.email || "";
    if (collegeEl) collegeEl.textContent = u.college || "Independent Candidate";
    if (prefixEl && u.email) {
      prefixEl.textContent = u.email.split("@")[0];
    }
  }

  async function loadHandles() {
    refreshUserProfile();
    try {
      const handles = await fetchUserHandles();
      if (!handles) return;
      for (const [field, elementId] of Object.entries(FIELD_IDS)) {
        const input = document.getElementById(elementId);
        if (input && handles[field]) {
          input.value = handles[field];
        }
      }
    } catch {
      // ignore silently
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const overrides = {};
    for (const [field, elementId] of Object.entries(FIELD_IDS)) {
      const input = document.getElementById(elementId);
      if (input) {
        const value = input.value.trim();
        if (value) overrides[field] = value;
      }
    }

    const submitBtn = form.querySelector("button[type=submit]");
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

  return { loadHandles, refreshUserProfile };
}
