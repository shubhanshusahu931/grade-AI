// src/components/navbar.js — Navigation & Theme controller
import { isAuthenticated, logout, setView, subscribe, state } from "../state.js";
import { showToast } from "./toast.js";

const THEME_KEY = "industry_grade_ai_theme";

export function initNavbar({ onNavigate }) {
  const authedNav = document.getElementById("authedNav");
  const guestNav = document.getElementById("guestNav");
  const authedUserPill = document.getElementById("authedUserPill");
  const guestHero = document.getElementById("guestHero");
  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileDrawer = document.getElementById("mobileDrawer");
  const mobileDrawerNav = document.getElementById("mobileDrawerNav");
  const brandHomeBtn = document.getElementById("brandHomeBtn");

  const navUserName = document.getElementById("navUserName");
  const navUserCollege = document.getElementById("navUserCollege");
  const navUserAvatar = document.getElementById("navUserAvatar");

  // --- THEME TOGGLE CONTROLLER ---
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeIcons(theme);
  }

  function updateThemeIcons(theme) {
    const isLight = theme === "light";
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.setAttribute("title", isLight ? "Switch to Dark Mode" : "Switch to Light Mode");
      btn.innerHTML = isLight
        ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
        : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
  }

  const initialTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(initialTheme);

  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });

  // Clone nav links into mobile drawer
  if (mobileDrawerNav && authedNav) {
    mobileDrawerNav.innerHTML = authedNav.innerHTML;
  }

  function getAllNavButtons() {
    return Array.from(document.querySelectorAll(".nav-btn[data-view]"));
  }

  function bindNavButtons() {
    getAllNavButtons().forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        setView(view);
        onNavigate(view);
        if (mobileDrawer) mobileDrawer.hidden = true;
      });
    });
  }

  bindNavButtons();

  // Mobile menu toggle
  if (mobileMenuBtn && mobileDrawer) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileDrawer.hidden = !mobileDrawer.hidden;
    });
  }

  // Click brand logo to go to dashboard or top
  if (brandHomeBtn) {
    brandHomeBtn.addEventListener("click", () => {
      if (isAuthenticated()) {
        setView("dashboard");
        onNavigate("dashboard");
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
      if (mobileDrawer) mobileDrawer.hidden = true;
      showToast("Signed out successfully", "default");
    });
  }

  function render(currentState) {
    const authed = isAuthenticated();
    if (authedNav) authedNav.hidden = !authed;
    if (authedUserPill) authedUserPill.hidden = !authed;
    if (guestNav) guestNav.hidden = authed;
    if (guestHero) guestHero.hidden = authed;
    if (app) app.hidden = !authed;

    const isAdmin = Boolean(currentState?.user?.is_admin);
    document.querySelectorAll(".nav-btn[data-view='admin']").forEach((btn) => {
      btn.hidden = !isAdmin;
    });

    if (authed && currentState?.user) {
      const u = currentState.user;
      if (navUserName) navUserName.textContent = u.username || "Coder";
      if (navUserCollege) navUserCollege.textContent = u.college || "Independent";
      if (navUserAvatar) {
        if (u.avatar_url) {
          navUserAvatar.innerHTML = `<img src="${u.avatar_url}" alt="${u.username}" class="nav-avatar-img" />`;
        } else {
          navUserAvatar.textContent = (u.username ? u.username[0] : "U").toUpperCase();
        }
      }
    }
  }

  function setActiveView(view) {
    getAllNavButtons().forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }

  subscribe(render);
  render(state);

  return { setActiveView };
}
