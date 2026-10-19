// Formatting and export helpers for the warehouse pages and reports.

export function money(value, currency) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value; // pre-formatted mixed-currency totals
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency || ""} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
  }
}

/** { USD: 1200, EUR: 50 } -> "$1,200.00 + €50.00" */
export function moneyMap(map) {
  const entries = Object.entries(map || {});
  if (!entries.length) return "—";
  return entries.map(([c, v]) => money(v, c)).join(" + ");
}

export function dateOnly(d) {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleDateString();
}

export function dateTime(d) {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleString();
}

/** yyyy-mm-dd for <input type="date"> in local time. */
export function isoDay(d = new Date()) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function formatCell(value, type, row) {
  if (value === null || value === undefined || value === "") return type === "money" ? "—" : "";
  switch (type) {
    case "number":
      return Number(value).toLocaleString();
    case "money":
      return money(value, row?.currency || row?.currencyCode);
    case "percent":
      return `${value}%`;
    case "date":
      return dateOnly(value);
    case "datetime":
      return dateTime(value);
    default:
      return String(value);
  }
}

/** Raw value for spreadsheets: numbers stay numbers, dates become yyyy-mm-dd. */
function exportValue(value, type) {
  if (value === null || value === undefined) return "";
  if (type === "date") return isoDay(value);
  if (type === "datetime") {
    const x = new Date(value);
    return Number.isNaN(x.getTime()) ? "" : `${isoDay(x)} ${x.toTimeString().slice(0, 5)}`;
  }
  return value;
}

/**
 * Download rows as a CSV that Excel opens directly (UTF-8 BOM, quoted).
 * columns: [{ key, label, type }]
 */
export function downloadCsv(fileName, columns, rows, totals, meta = []) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  meta.forEach((m) => lines.push(esc(m)));
  if (meta.length) lines.push("");
  lines.push(columns.map((c) => esc(c.label)).join(","));
  rows.forEach((r) => lines.push(columns.map((c) => esc(exportValue(r[c.key], c.type))).join(",")));
  if (totals && Object.values(totals).some((v) => v !== null && v !== undefined)) {
    lines.push(columns.map((c, i) => esc(i === 0 ? "Total" : totals[c.key] ?? "")).join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PO_STATUS = {
  OPEN: { label: "Open", color: "info" },
  PARTIALLY_RECEIVED: { label: "Partly received", color: "warning" },
  RECEIVED: { label: "Received", color: "success" },
  CANCELLED: { label: "Cancelled", color: "default" },
};

export const REASON_LABELS = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  LOST: "Lost / missing",
  THEFT: "Theft",
  CONTAMINATED: "Contaminated / pests",
  RECALLED: "Recalled",
  COUNT_VARIANCE: "Stock count shortage",
  OTHER: "Other",
};

