// src/components/ragChat.js — AI Career Intelligence & Semantic Interview Intel
import { ApiError } from "../services/api.js";
import { searchInterviewIntel } from "../services/ragService.js";
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
      const result = await searchInterviewIntel({ query, company: company || null, topK: 3 });

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
              return `
                <div class="rag-source-card">
                  <div class="source-card__header">
                    <span class="source-company">${escapeHtml(s.company)}</span>
                    <span class="source-sim-badge">${similarityPct}% match</span>
                  </div>
                  <div class="source-role">${escapeHtml(s.role)}</div>
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
}

function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Headers (### Heading)
  html = html.replace(/^### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^## (.*$)/gim, "<h3>$1</h3>");

  // Bold (**bold**)
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");

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
