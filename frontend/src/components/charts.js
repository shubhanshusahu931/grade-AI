// src/components/charts.js — Chart.js distribution controller
import { PLATFORM_LABELS, PLATFORM_META } from "../config.js";

let chartInstance = null;

export function renderPlatformChart(platforms) {
  const canvas = document.getElementById("platformChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ALL_PLATFORMS = [
    "codeforces",
    "leetcode",
    "codechef",
    "gfg",
    "hackerrank",
    "codetantra",
    "hackerearth",
    "takeuforward",
    "codingninjas",
  ];
  const platformMap = new Map();
  (platforms || []).forEach((p) => platformMap.set(p.platform, p));

  const labels = ALL_PLATFORMS.map((k) => PLATFORM_META[k]?.name || PLATFORM_LABELS[k] || k);
  const solvedValues = ALL_PLATFORMS.map((k) => {
    const p = platformMap.get(k);
    return p && p.success ? p.solved || 0 : 0;
  });

  const backgroundColors = [
    "rgba(59, 130, 246, 0.8)",   // Codeforces Blue
    "rgba(245, 158, 11, 0.8)",   // LeetCode Amber
    "rgba(168, 85, 247, 0.8)",   // CodeChef Purple
    "rgba(16, 185, 129, 0.8)",   // GFG Green
    "rgba(6, 182, 212, 0.8)",    // HackerRank Cyan
    "rgba(236, 72, 153, 0.8)",   // CodeTantra Pink
    "rgba(67, 83, 255, 0.8)",    // HackerEarth Indigo
    "rgba(249, 115, 22, 0.8)",   // TakeUForward Orange
    "rgba(234, 88, 12, 0.8)",    // Coding Ninjas Coral
  ];

  const borderColors = [
    "#3b82f6",
    "#f59e0b",
    "#a855f7",
    "#10b981",
    "#06b6d4",
    "#ec4899",
    "#4353ff",
    "#f97316",
    "#ea580c",
  ];

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = solvedValues;
    chartInstance.update();
    return;
  }

  const ctx = canvas.getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Problems Solved",
          data: solvedValues,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10, 15, 29, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#94a3b8",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: (ctx) => ` Solved: ${ctx.parsed.y} problems`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#94a3b8",
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: 600 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#64748b",
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            precision: 0,
          },
        },
      },
    },
  });
}
