// src/components/toast.js — small transient notification banner used
// across views/components (sync success, errors, etc.)

let hideTimer = null;

export function showToast(message, variant = "default") {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = message;
  el.className = "toast" + (variant === "error" ? " toast--error" : variant === "success" ? " toast--success" : "");
  el.hidden = false;

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.hidden = true;
  }, 3500);
}
