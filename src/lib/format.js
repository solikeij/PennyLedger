export const CURRENCIES = { USD: "$", PHP: "₱", EUR: "€" };
export const DATE_FORMATS = ["MMM D, YYYY", "DD/MM/YYYY", "MM/DD/YYYY"];

// Format a signed or unsigned amount using the selected currency symbol.
export function money(amount, currency = "PHP", signed = false) {
  const value = Number(amount) || 0;
  return `${value < 0 ? "-" : signed && value > 0 ? "+" : ""}${CURRENCIES[currency] || CURRENCIES.PHP}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Build a local calendar date without UTC timezone shifts.
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Render a date in the selected display format.
export function formatDate(value, format = DATE_FORMATS[0]) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  if (format === "DD/MM/YYYY") return `${day}/${month}/${year}`;
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${names[Number(month) - 1]} ${Number(day)}, ${year}`;
}

// Calculate a savings percentage bounded between zero and one hundred.
export function progress(saved, target) {
  return target > 0
    ? Math.max(0, Math.min(100, Math.round((saved / target) * 100)))
    : 0;
}

// Convert a pay amount and frequency into a monthly planning estimate.
export function monthlyIncome(amount, frequency) {
  const periods = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    monthly: 1,
    annually: 1 / 12,
  };
  if (
    !Number.isFinite(Number(amount)) ||
    Number(amount) < 0 ||
    !(frequency in periods)
  )
    return NaN;
  return (
    Math.round((Number(amount) * periods[frequency] + Number.EPSILON) * 100) /
    100
  );
}

// Encode export rows as CSV and neutralize formulas in user-entered text.
export function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          // Prevent spreadsheet formulas in user-entered text while retaining numbers.
          const safe =
            typeof value === "string" && /^[=+@\-\t\r]/.test(text)
              ? "'" + text
              : text;
          return '"' + safe.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}

// Start a browser download and release its temporary object URL.
export function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
