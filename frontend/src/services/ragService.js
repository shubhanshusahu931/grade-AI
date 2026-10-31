// src/services/ragService.js — semantic search over interview posts

import { apiFetch } from "./api.js";

/**
 * @param {object} params
 * @param {string} params.query
 * @param {string|null} [params.company]
 * @param {number} [params.topK]
 */
export async function searchInterviewIntel({ query, company = null, topK = 3 }) {
  return apiFetch("/rag/search", {
    method: "POST",
    body: { query, company: company || null, top_k: topK },
  });
}
