// src/app.js — Application Bootstrap & Route Orchestrator
import { initAuthModal } from "./components/authModal.js";
import { initNavbar } from "./components/navbar.js";
import { initRagChat } from "./components/ragChat.js";
import { initUserProfileModal } from "./components/userProfileModal.js";
import { initFollowListModal } from "./components/followListModal.js";
import { isAuthenticated, setUser, setLatestSync } from "./state.js";
import { initAdminView } from "./views/adminView.js";
import { initDashboardView } from "./views/dashboardView.js";
import { initLeaderboardView } from "./views/leaderboardView.js";
import { initSettingsView } from "./views/settingsView.js";
import { fetchCurrentUser } from "./services/authService.js";
import { syncProfile } from "./services/syncService.js";

const VIEWS = ["dashboard", "leaderboard", "rag", "settings", "admin"];

function showView(view) {
  VIEWS.forEach((v) => {
    const section = document.getElementById(`view-${v}`);
    if (section) section.hidden = v !== view;
  });
}

async function syncUserData(dashboard) {
  try {
    const user = await fetchCurrentUser();
    setUser(user);
    if (dashboard) {
      await dashboard.loadCachedStats();
    }
  } catch {
    // If token invalid, auth error handler in api.js clears token
  }
}

function bootstrap() {
  let navbar;

  const navigateTo = (view) => {
    showView(view);
    if (navbar) navbar.setActiveView(view);
    if (view === "leaderboard") leaderboard.load();
    if (view === "settings") {
      settings.loadHandles();
      settings.refreshUserProfile();
    }
    if (view === "dashboard") dashboard.refreshFromState();
    if (view === "admin") admin.load();
  };

  const dashboard = initDashboardView({ onNavigate: navigateTo });
  const leaderboard = initLeaderboardView();
  const admin = initAdminView();
  initRagChat();

  const settings = initSettingsView({
    onSaveAndSync: async (overrides) => {
      const result = await syncProfile(overrides);
      setLatestSync(result);
      dashboard.refreshFromState();
    },
  });

  initUserProfileModal({
    onFollowChanged: () => {
      dashboard.refreshGreeting();
      settings.refreshUserProfile();
    },
  });

  initFollowListModal({
    onFollowChange: () => {
      dashboard.refreshGreeting();
      settings.refreshUserProfile();
    },
  });

  navbar = initNavbar({
    onNavigate: navigateTo,
  });

  initAuthModal({
    onAuthenticated: async () => {
      navigateTo("dashboard");
      await syncUserData(dashboard);
      // Run sync in background if never synced
      dashboard.runSync();
    },
  });

  // Returning user session bootstrap
  if (isAuthenticated()) {
    navigateTo("dashboard");
    syncUserData(dashboard);
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
