// src/components/navbar.js — Navigation controller
import { isAuthenticated, logout, setView, subscribe, state } from "../state.js";
import { showToast } from "./toast.js";

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

  // Clone nav links into mobile drawer
  mobileDrawerNav.innerHTML = authedNav.innerHTML;

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

  logoutBtn.addEventListener("click", () => {
    logout();
    if (mobileDrawer) mobileDrawer.hidden = true;
    showToast("Signed out successfully", "default");
  });

  function render(currentState) {
    const authed = isAuthenticated();
    authedNav.hidden = !authed;
    authedUserPill.hidden = !authed;
    guestNav.hidden = authed;
    guestHero.hidden = authed;
    app.hidden = !authed;

    if (authed && currentState?.user) {
      const u = currentState.user;
      if (navUserName) navUserName.textContent = u.username || "Coder";
      if (navUserCollege) navUserCollege.textContent = u.college || "Independent";
      if (navUserAvatar) {
        navUserAvatar.textContent = (u.username ? u.username[0] : "U").toUpperCase();
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
