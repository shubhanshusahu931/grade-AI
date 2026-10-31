// src/views/adminView.js — Admin Governance & User Management View
import {
  fetchAdminStats,
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  forceSyncAdminUser,
} from "../services/adminService.js";
import {
  fetchRagDocuments,
  uploadRagDocument,
  deleteRagDocument,
} from "../services/ragService.js";
import { showToast } from "../components/toast.js";
import { state } from "../state.js";

let editUserId = null;

export function initAdminView() {
  const usersBody = document.getElementById("adminUsersBody");
  const searchInput = document.getElementById("adminUserSearch");
  const roleFilter = document.getElementById("adminRoleFilter");
  const refreshBtn = document.getElementById("adminRefreshBtn");

  // Stat elements
  const totalUsersEl = document.getElementById("adminTotalUsers");
  const totalSolvedEl = document.getElementById("adminTotalSolved");
  const avgScoreEl = document.getElementById("adminAvgScore");
  const totalFollowsEl = document.getElementById("adminTotalFollows");
  const totalCollegesEl = document.getElementById("adminTotalColleges");

  // Edit Modal elements
  const editModal = document.getElementById("adminEditModal");
  const editForm = document.getElementById("adminEditForm");
  const editName = document.getElementById("adminEditName");
  const editEmail = document.getElementById("adminEditEmail");
  const editCollege = document.getElementById("adminEditCollege");
  const editBio = document.getElementById("adminEditBio");
  const editPhone = document.getElementById("adminEditPhone");
  const editIsAdmin = document.getElementById("adminEditIsAdmin");

  let cachedUsers = [];

  async function loadStats() {
    try {
      const stats = await fetchAdminStats();
      if (totalUsersEl) totalUsersEl.textContent = stats.total_users.toLocaleString();
      if (totalSolvedEl) totalSolvedEl.textContent = stats.total_solved_aggregate.toLocaleString();
      if (avgScoreEl) avgScoreEl.textContent = stats.avg_composite_score.toFixed(1);
      if (totalFollowsEl) totalFollowsEl.textContent = stats.total_follows.toLocaleString();
      if (totalCollegesEl) totalCollegesEl.textContent = stats.total_colleges.toLocaleString();
    } catch {
      // ignore silently if not admin
    }
  }

  async function loadUsers() {
    if (usersBody) {
      usersBody.innerHTML = `<tr><td colspan="7" class="empty-row">Loading user directory...</td></tr>`;
    }
    try {
      const q = searchInput?.value.trim() || "";
      const r = roleFilter?.value || "";
      const res = await fetchAdminUsers({ search: q, role: r });
      cachedUsers = res.users;
      renderUsersTable(cachedUsers);
    } catch (err) {
      if (usersBody) {
        usersBody.innerHTML = `<tr><td colspan="7" class="empty-row" style="color:var(--accent-rose);">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  function renderUsersTable(users) {
    if (!usersBody) return;
    if (!users || users.length === 0) {
      usersBody.innerHTML = `<tr><td colspan="7" class="empty-row">No users matched search criteria.</td></tr>`;
      return;
    }

    usersBody.innerHTML = users
      .map((u) => {
        const isSelf = state.user && state.user.id === u.id;
        const initial = (u.username ? u.username[0] : "U").toUpperCase();
        const roleBadge = u.is_admin
          ? `<span class="badge badge--admin">Admin</span>`
          : `<span class="badge badge--candidate">Candidate</span>`;

        return `
          <tr data-user-id="${u.id}">
            <td>
              <div class="candidate-cell">
                <div class="candidate-avatar">${initial}</div>
                <div>
                  <div class="candidate-name">${escapeHtml(u.username)} ${isSelf ? '<span class="you-tag">YOU</span>' : ""}</div>
                  <div class="admin-email-sub font-mono">${escapeHtml(u.email)}</div>
                </div>
              </div>
            </td>
            <td>${roleBadge}</td>
            <td><span style="color:var(--text-secondary);">${u.college ? escapeHtml(u.college) : "Independent"}</span></td>
            <td class="solved-cell font-mono">${u.total_solved.toLocaleString()}</td>
            <td class="score-cell font-mono">${u.composite_score.toFixed(1)}</td>
            <td>
              <div class="admin-follows-stat font-mono">
                <span title="Followers">👥 ${u.followers_count}</span>
                <span title="Following">🤝 ${u.following_count}</span>
              </div>
            </td>
            <td style="text-align:right;">
              <div class="admin-action-group">
                <button class="btn btn--xs btn--outline admin-btn-sync" data-id="${u.id}" title="Force background re-sync of handles">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  <span>Sync</span>
                </button>
                <button class="btn btn--xs btn--outline admin-btn-edit" data-id="${u.id}" title="Edit user details & role">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  <span>Edit</span>
                </button>
                ${
                  !isSelf
                    ? `
                  <button class="btn btn--xs btn--danger admin-btn-delete" data-id="${u.id}" data-name="${escapeHtml(u.username)}" title="Delete user">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                `
                    : ""
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Bind action buttons
    usersBody.querySelectorAll(".admin-btn-sync").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const uid = btn.getAttribute("data-id");
        btn.disabled = true;
        btn.innerHTML = `<span>Syncing...</span>`;
        try {
          const res = await forceSyncAdminUser(uid);
          showToast(`Synced ${res.total_solved} problems (Score: ${res.composite_score})`, "success");
          loadUsers();
          loadStats();
        } catch (err) {
          showToast(err.message || "Sync failed", "error");
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Sync</span>`;
        }
      });
    });

    usersBody.querySelectorAll(".admin-btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.getAttribute("data-id");
        const u = cachedUsers.find((x) => x.id === uid);
        if (!u) return;
        editUserId = uid;

        if (editName) editName.value = u.username || "";
        if (editEmail) editEmail.value = u.email || "";
        if (editCollege) editCollege.value = u.college || "";
        if (editBio) editBio.value = u.bio || "";
        if (editPhone) editPhone.value = u.phone || "";
        if (editIsAdmin) editIsAdmin.checked = Boolean(u.is_admin);

        if (editModal) editModal.hidden = false;
      });
    });

    usersBody.querySelectorAll(".admin-btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const uid = btn.getAttribute("data-id");
        const uname = btn.getAttribute("data-name") || "this user";
        if (!confirm(`Are you sure you want to permanently delete coder "${uname}"? This cannot be undone.`)) {
          return;
        }

        try {
          await deleteAdminUser(uid);
          showToast(`Deleted ${uname} successfully`, "default");
          loadUsers();
          loadStats();
        } catch (err) {
          showToast(err.message || "Delete failed", "error");
        }
      });
    });
  }

  // Filter & Search listeners
  if (searchInput) {
    let debounce;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => loadUsers(), 250);
    });
  }

  if (roleFilter) {
    roleFilter.addEventListener("change", () => loadUsers());
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadStats();
      loadUsers();
      showToast("Refreshed user directory & system metrics", "default");
    });
  }

  // Edit Form submit
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!editUserId) return;

      const payload = {
        username: editName?.value.trim(),
        email: editEmail?.value.trim(),
        college: editCollege?.value.trim(),
        bio: editBio?.value.trim(),
        phone: editPhone?.value.trim(),
        is_admin: editIsAdmin ? editIsAdmin.checked : undefined,
      };

      try {
        await updateAdminUser(editUserId, payload);
        showToast("User updated successfully", "success");
        if (editModal) editModal.hidden = true;
        loadUsers();
        loadStats();
      } catch (err) {
        showToast(err.message || "Failed to update user", "error");
      }
    });
  }

  // Close edit modal
  if (editModal) {
    editModal.querySelectorAll("[data-close='adminEditModal']").forEach((btn) => {
      btn.addEventListener("click", () => {
        editModal.hidden = true;
        editUserId = null;
      });
    });
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) {
        editModal.hidden = true;
        editUserId = null;
      }
    });
  }

  // ======================= RAG KNOWLEDGE BASE MANAGEMENT =======================
  const docTableBody = document.getElementById("adminDocTableBody");
  const ragDocsCountEl = document.getElementById("adminRagDocsCount");
  const refreshDocsBtn = document.getElementById("adminRefreshDocsBtn");
  const uploadForm = document.getElementById("adminPdfUploadForm");
  const fileInput = document.getElementById("adminPdfFile");
  const dropzone = document.getElementById("adminFileDropzone");
  const dropLabel = document.getElementById("adminFileDropLabel");
  const docTitleInput = document.getElementById("adminDocTitle");
  const docCategoryInput = document.getElementById("adminDocCategory");
  const uploadBtn = document.getElementById("adminPdfUploadBtn");
  const uploadBtnText = document.getElementById("adminPdfUploadBtnText");

  async function loadRagDocuments() {
    if (docTableBody) {
      docTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">Loading knowledge documents...</td></tr>`;
    }
    try {
      const docs = await fetchRagDocuments();
      if (ragDocsCountEl) {
        ragDocsCountEl.textContent = `${docs.length} Document${docs.length === 1 ? "" : "s"} Embedded`;
      }

      if (!docTableBody) return;
      if (docs.length === 0) {
        docTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">No knowledge documents uploaded yet. Upload a company PDF above to empower RAG intelligence!</td></tr>`;
        return;
      }

      docTableBody.innerHTML = docs
        .map((d) => {
          const sizeKb = (d.file_size / 1024).toFixed(1);
          const dateStr = d.created_at ? new Date(d.created_at).toLocaleDateString() : "Just now";
          return `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-avatar-small" style="background:linear-gradient(135deg, #0284c7, #6366f1);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>
                  <div class="user-cell__info">
                    <strong>${escapeHtml(d.title)}</strong>
                    <span class="user-cell__email font-mono">${escapeHtml(d.filename)}</span>
                  </div>
                </div>
              </td>
              <td><span class="tag tag--college">${escapeHtml(d.category || "General")}</span></td>
              <td><span class="font-mono" style="font-size:0.85rem;">${sizeKb} KB</span></td>
              <td><span class="badge badge--glow font-mono" style="font-size:0.75rem;">${d.total_chunks} chunks</span></td>
              <td><span style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(d.uploaded_by || "Admin")}</span></td>
              <td><span style="font-size:0.82rem; color:var(--text-muted);">${dateStr}</span></td>
              <td style="text-align: right;">
                <button class="btn btn--danger-sm delete-doc-btn" data-doc-id="${d.id}" title="Delete document">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </td>
            </tr>
          `;
        })
        .join("");

      // Wire delete buttons
      docTableBody.querySelectorAll(".delete-doc-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const docId = btn.getAttribute("data-doc-id");
          if (!docId) return;
          if (!confirm("Are you sure you want to delete this document and all its embedded vectors?")) return;

          btn.disabled = true;
          try {
            await deleteRagDocument(docId);
            showToast("Document deleted successfully", "default");
            loadRagDocuments();
          } catch (err) {
            showToast(err.message || "Failed to delete document", "error");
            btn.disabled = false;
          }
        });
      });
    } catch {
      if (docTableBody) {
        docTableBody.innerHTML = `<tr><td colspan="7" class="empty-row" style="color:var(--accent-rose);">Failed to load documents.</td></tr>`;
      }
    }
  }

  // Refresh docs button
  if (refreshDocsBtn) {
    refreshDocsBtn.addEventListener("click", () => {
      loadRagDocuments();
      showToast("Knowledge documents refreshed", "default");
    });
  }

  // File dropzone behavior
  if (fileInput && dropLabel) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) {
        dropLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        if (docTitleInput && !docTitleInput.value.trim()) {
          const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          docTitleInput.value = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        }
      } else {
        dropLabel.textContent = "Choose a PDF document or drag & drop here";
      }
    });
  }

  if (dropzone && fileInput) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files?.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });
  }

  // Upload Form Submit
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = fileInput?.files?.[0];
      if (!file) {
        showToast("Please select a document to upload", "error");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      if (docTitleInput?.value.trim()) {
        formData.append("title", docTitleInput.value.trim());
      }
      if (docCategoryInput?.value.trim()) {
        formData.append("category", docCategoryInput.value.trim());
      }

      if (uploadBtn) uploadBtn.disabled = true;
      if (uploadBtnText) uploadBtnText.textContent = "Embedding with Gemini... (may take 5-15s)";

      try {
        const res = await uploadRagDocument(formData);
        showToast(res.message || "Document indexed successfully!", "success");
        uploadForm.reset();
        if (dropLabel) dropLabel.textContent = "Choose a PDF document or drag & drop here";
        loadRagDocuments();
      } catch (err) {
        showToast(err.message || "Upload failed", "error");
      } finally {
        if (uploadBtn) uploadBtn.disabled = false;
        if (uploadBtnText) uploadBtnText.textContent = "Upload & Index into RAG";
      }
    });
  }

  function load() {
    loadStats();
    loadUsers();
    loadRagDocuments();
  }

  return { load };
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

