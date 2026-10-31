// src/components/authModal.js — Login / Register Modal Controller
import { loginUser, registerUser } from "../services/authService.js";
import { ApiError } from "../services/api.js";
import { setToken } from "../state.js";
import { showToast } from "./toast.js";

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = false;
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = true;
}

function closeAllModals() {
  closeModal("loginModal");
  closeModal("registerModal");
}

export function initAuthModal({ onAuthenticated }) {
  const loginModal = document.getElementById("loginModal");
  const registerModal = document.getElementById("registerModal");

  // Open triggers
  const openLoginBtn = document.getElementById("openLoginBtn");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const heroRegisterBtn = document.getElementById("heroRegisterBtn");
  const heroLoginBtn = document.getElementById("heroLoginBtn");

  if (openLoginBtn) openLoginBtn.addEventListener("click", () => openModal("loginModal"));
  if (openRegisterBtn) openRegisterBtn.addEventListener("click", () => openModal("registerModal"));
  if (heroRegisterBtn) heroRegisterBtn.addEventListener("click", () => openModal("registerModal"));
  if (heroLoginBtn) heroLoginBtn.addEventListener("click", () => openModal("loginModal"));

  // Close triggers
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  [loginModal, registerModal].forEach((overlay) => {
    if (!overlay) return;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  // Switch between Login & Register
  const switchToRegister = document.getElementById("switchToRegister");
  const switchToLogin = document.getElementById("switchToLogin");

  if (switchToRegister) {
    switchToRegister.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal("loginModal");
      openModal("registerModal");
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal("registerModal");
      openModal("loginModal");
    });
  }

  // --- Login Form ---
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      const submitBtn = loginForm.querySelector("button[type=submit]");
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing In...";

      try {
        const { access_token } = await loginUser({ email, password });
        setToken(access_token);
        closeAllModals();
        loginForm.reset();
        showToast("Signed in successfully!", "success");
        await onAuthenticated();
      } catch (err) {
        if (loginError) {
          loginError.textContent = err instanceof ApiError ? err.message : "Invalid credentials";
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }

  // --- Register Form ---
  const registerForm = document.getElementById("registerForm");
  const registerError = document.getElementById("registerError");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (registerError) registerError.textContent = "";

      const username = document.getElementById("regUsername").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;
      const college = document.getElementById("regCollege").value.trim();

      const submitBtn = registerForm.querySelector("button[type=submit]");
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating Account...";

      try {
        const { access_token } = await registerUser({ username, email, password, college });
        setToken(access_token);
        closeAllModals();
        registerForm.reset();
        showToast("Account created — Welcome to Industry Grade AI!", "success");
        await onAuthenticated();
      } catch (err) {
        if (registerError) {
          registerError.textContent = err instanceof ApiError ? err.message : "Registration failed";
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }
}
