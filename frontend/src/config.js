// src/config.js — API base URL & shared constants

export const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? (window.location.port === "8000" ? "/api/v1" : "http://localhost:8000/api/v1")
    : "/api/v1";

export const TOKEN_STORAGE_KEY = "industry_grade_ai_access_token";

export const PLATFORM_LABELS = {
  codeforces: "Codeforces",
  leetcode: "LeetCode",
  codechef: "CodeChef",
  gfg: "GeeksforGeeks",
  hackerrank: "HackerRank",
  codetantra: "CodeTantra",
  hackerearth: "HackerEarth",
  takeuforward: "TakeUForward",
  codingninjas: "Coding Ninjas",
};

export const PLATFORM_META = {
  codeforces: {
    name: "Codeforces",
    color: "#3b82f6",
    badge: "CF",
    icon: "codeforces",
    urlPrefix: "https://codeforces.com/profile/",
  },
  leetcode: {
    name: "LeetCode",
    color: "#f59e0b",
    badge: "LC",
    icon: "leetcode",
    urlPrefix: "https://leetcode.com/u/",
  },
  codechef: {
    name: "CodeChef",
    color: "#a855f7",
    badge: "CC",
    icon: "codechef",
    urlPrefix: "https://www.codechef.com/users/",
  },
  gfg: {
    name: "GeeksforGeeks",
    color: "#10b981",
    badge: "GFG",
    icon: "gfg",
    urlPrefix: "https://www.geeksforgeeks.org/user/",
  },
  hackerrank: {
    name: "HackerRank",
    color: "#06b6d4",
    badge: "HR",
    icon: "hackerrank",
    urlPrefix: "https://www.hackerrank.com/profile/",
  },
  codetantra: {
    name: "CodeTantra",
    color: "#ec4899",
    badge: "CT",
    icon: "codetantra",
    urlPrefix: null,
  },
  hackerearth: {
    name: "HackerEarth",
    color: "#2c3454",
    badge: "HE",
    icon: "hackerearth",
    urlPrefix: "https://www.hackerearth.com/@",
  },
  takeuforward: {
    name: "TakeUForward",
    color: "#f97316",
    badge: "TUF",
    icon: "takeuforward",
    urlPrefix: "https://takeuforward.org/profile/",
  },
  codingninjas: {
    name: "Coding Ninjas",
    color: "#ea580c",
    badge: "CN",
    icon: "codingninjas",
    urlPrefix: "https://www.naukri.com/code360/profile/",
  },
};
