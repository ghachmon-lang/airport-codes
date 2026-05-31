/*
 * storage.js — persists her learning progress in the browser (localStorage).
 *
 * Progress lives on the device, so she can close the app and come back days later and
 * pick up exactly where she left off. Also provides export/import so she can back up
 * her progress or move it to another phone/computer (a lightweight stand-in for sync).
 */

const STORAGE_KEY = "united-airport-trainer.v1";

const DEFAULT_SETTINGS = {
  newLimit: 12, // how many new cards to introduce per session
  scope: "all", // which study set: "all" | "Hub" | "Domestic" | "International"
};

const DEFAULT_STREAK = { count: 0, best: 0, lastDay: null };

// Read the saved blob, or a fresh default if nothing is stored / it's corrupt.
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      items: parsed.items || {},
      streak: { ...DEFAULT_STREAK, ...(parsed.streak || {}) },
    };
  } catch (err) {
    console.warn("Could not read saved progress, starting fresh.", err);
    return freshState();
  }
}

function freshState() {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, items: {}, streak: { ...DEFAULT_STREAK } };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error("Could not save progress.", err);
    return false;
  }
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return freshState();
}

// --- Export / Import -------------------------------------------------------

// Trigger a download of the current progress as a JSON file.
function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `airport-trainer-progress-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse an imported JSON file's text into a valid state object (throws on bad input).
function parseImported(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || typeof parsed.items !== "object") {
    throw new Error("That doesn't look like an exported progress file.");
  }
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    items: parsed.items,
    streak: { ...DEFAULT_STREAK, ...(parsed.streak || {}) },
  };
}

const STORAGE_API = {
  STORAGE_KEY,
  DEFAULT_SETTINGS,
  loadState,
  saveState,
  resetState,
  exportState,
  parseImported,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = STORAGE_API;
}
