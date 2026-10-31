// src/components/ragChat.js — AI Career Intelligence & Semantic Interview Intel
import { ApiError } from "../services/api.js";
import { searchInterviewIntel, fetchRagDocuments } from "../services/ragService.js";
import { showToast } from "./toast.js";

export function initRagChat() {
  const form = document.getElementById("ragForm");
  const queryInput = document.getElementById("ragQuery");
  const companyInput = document.getElementById("ragCompany");
  const loadingEl = document.getElementById("ragLoading");
  const resultContainer = document.getElementById("ragResultContainer");
  const answerEl = document.getElementById("ragAnswer");
  const sourcesEl = document.getElementById("ragSources");
  const copyBtn = document.getElementById("copyAnswerBtn");
  const ragSubmitBtn = document.getElementById("ragSubmitBtn");
  const ragBtnText = document.getElementById("ragBtnText");
  const ragDocsCountBadge = document.getElementById("ragDocsCountBadge");
  const ragSourceTypePill = document.getElementById("ragSourceTypePill");

  // Load document count badge in header
  async function updateDocsStatus() {
    try {
      const docs = await fetchRagDocuments();
      if (ragDocsCountBadge) {
        ragDocsCountBadge.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>Knowledge Base: ${docs.length} Document${docs.length === 1 ? "" : "s"} Indexed</span>
        `;
      }
    } catch {
      // ignore
    }
  }

  updateDocsStatus();

  // Wire suggestion chips
  document.querySelectorAll(".chip-query").forEach((chip) => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.query;
      if (q) {
        queryInput.value = q;
        form.dispatchEvent(new Event("submit"));
      }
    });
  });

  // Copy Answer
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const textToCopy = answerEl?.innerText || "";
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast("Answer copied to clipboard!", "success");
      } catch {
        showToast("Unable to copy to clipboard", "error");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const query = queryInput.value.trim();
    const company = companyInput.value.trim();
    if (!query) return;

    if (resultContainer) resultContainer.hidden = true;
    if (loadingEl) loadingEl.hidden = false;
    if (ragSubmitBtn) ragSubmitBtn.disabled = true;
    if (ragBtnText) ragBtnText.textContent = "Analyzing...";

    try {
      const result = await searchInterviewIntel({ query, company: company || null, topK: 4 });

      // Update source type indicator badge
      if (ragSourceTypePill) {
        if (result.source_type === "knowledge_base") {
          ragSourceTypePill.innerHTML = `
            <span class="rag-pill rag-pill--kb">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>Grounded in Uploaded Documents (${result.sources.length} sources)</span>
            </span>
          `;
        } else {
          ragSourceTypePill.innerHTML = `
            <span class="rag-pill rag-pill--gemini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              <span>Google Gemini AI General Intelligence (No specific doc match)</span>
            </span>
          `;
        }
      }

      if (answerEl) {
        answerEl.innerHTML = formatMarkdown(result.answer);
      }

      if (sourcesEl) {
        if (!result.sources || result.sources.length === 0) {
          sourcesEl.innerHTML = `<div class="empty-state">No direct matching interview experiences in database for this query.</div>`;
        } else {
          sourcesEl.innerHTML = result.sources
            .map((s) => {
              const similarityPct = Math.round(s.similarity * 100);
              const title = s.document_title || s.company;
              const sub = s.category ? `${s.company} • ${s.category}` : s.role;
              return `
                <div class="rag-source-card">
                  <div class="source-card__header">
                    <span class="source-company" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                    <span class="source-sim-badge">${similarityPct}% match</span>
                  </div>
                  <div class="source-role">${escapeHtml(sub)}</div>
                  <div class="source-snippet">${escapeHtml(s.snippet)}</div>
                </div>
              `;
            })
            .join("");
        }
      }

      if (resultContainer) resultContainer.hidden = false;
    } catch (err) {
      if (answerEl) {
        answerEl.innerHTML = `<p style="color:var(--accent-rose);">Error: ${escapeHtml(
          err instanceof ApiError ? err.message : "Failed to search interview intel. Please try again."
        )}</p>`;
      }
      if (resultContainer) resultContainer.hidden = false;
    } finally {
      if (loadingEl) loadingEl.hidden = true;
      if (ragSubmitBtn) ragSubmitBtn.disabled = false;
      if (ragBtnText) ragBtnText.textContent = "Ask AI Assistant";
    }
  });

  return { updateDocsStatus };
}

function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Headers (### Heading)
  html = html.replace(/^### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^## (.*$)/gim, "<h3>$1</h3>");

  // Bold (**bold**)
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");

  // Code inline (`code`)
  html = html.replace(/`([^`]+)`/gim, "<code class='font-mono'>$1</code>");

  // Bullet points (* item or - item)
  html = html.replace(/^\s*[\*\-]\s+(.*$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");

  // Clean empty double ULs
  html = html.replace(/<\/ul>\s*<ul>/gim, "");

  // Paragraph line breaks
  html = html.replace(/\n\n/gim, "<br/><br/>");

  return html;
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
