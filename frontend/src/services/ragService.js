// src/services/ragService.js — Semantic search over knowledge base & PDF management

import { API_BASE_URL } from "../config.js";
import { state, logout } from "../state.js";
import { apiFetch, ApiError } from "./api.js";

/**
 * Query the AI Career Intel RAG pipeline.
 * Searches uploaded PDF documents first; falls back to Gemini API general intelligence.
 * @param {object} params
 * @param {string} params.query
 * @param {string|null} [params.company]
 * @param {number} [params.topK]
 */
export async function searchInterviewIntel({ query, company = null, topK = 4 }) {
  return apiFetch("/rag/search", {
    method: "POST",
    body: { query, company: company || null, top_k: topK },
    auth: true,
  });
}

/**
 * Fetch list of all uploaded RAG knowledge base documents.
 */
export async function fetchRagDocuments() {
  return apiFetch("/rag/documents", {
    method: "GET",
    auth: true,
  });
}

/**
 * Upload and index a PDF document into RAG (Admin only).
 * @param {FormData} formData
 */
export async function uploadRagDocument(formData) {
  const headers = {};
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/rag/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch {
    throw new ApiError("Network error while uploading document", 0);
  }

  if (response.status === 401) {
    logout();
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail || "Document upload failed";
    throw new ApiError(detail, response.status);
  }

  return data;
}

/**
 * Delete a RAG document and all its chunks (Admin only).
 * @param {string} documentId
 */
export async function deleteRagDocument(documentId) {
  return apiFetch(`/rag/documents/${documentId}`, {
    method: "DELETE",
    auth: true,
  });
}
