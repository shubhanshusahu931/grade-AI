// src/app.js — Application Bootstrap & Route Orchestrator
import { initAuthModal } from "./components/authModal.js";
import { initNavbar } from "./components/navbar.js";
import { initRagChat } from "./components/ragChat.js";
import { isAuthenticated, setUser, setLatestSync } from "./state.js";
import { initDashboardView } from "./views/dashboardView.js";
import { initLeaderboardView } from "./views/leaderboardView.js";
import { initSettingsView } from "./views/settingsView.js";
import { fetchCurrentUser } from "./services/authService.js";
import { syncProfile } from "./services/syncService.js";

const VIEWS = ["dashboard", "leaderboard", "rag", "settings"];

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
  const dashboard = initDashboardView();
  const leaderboard = initLeaderboardView();
  initRagChat();

  const settings = initSettingsView({
    onSaveAndSync: async (overrides) => {
      const result = await syncProfile(overrides);
      setLatestSync(result);
      dashboard.refreshFromState();
    },
  });

  const navbar = initNavbar({
    onNavigate: (view) => {
      showView(view);
      navbar.setActiveView(view);
      if (view === "leaderboard") leaderboard.load();
      if (view === "settings") settings.loadHandles();
      if (view === "dashboard") dashboard.refreshFromState();
    },
  });

  initAuthModal({
    onAuthenticated: async () => {
      showView("dashboard");
      navbar.setActiveView("dashboard");
      await syncUserData(dashboard);
      // Run sync in background if never synced
      dashboard.runSync();
    },
  });

  // Returning user session bootstrap
  if (isAuthenticated()) {
    showView("dashboard");
    navbar.setActiveView("dashboard");
    syncUserData(dashboard);
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
