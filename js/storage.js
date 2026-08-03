/*
 * storage.js — persists all game progress in the browser (localStorage).
 *
 * v3 schema:
 *   items    : SRS review items (the learning brain — kept from v1)
 *   streak   : { count, best, lastDay }
 *   miles    : lifetime Sky Miles (XP)
 *   day      : { dayIndex, miles } — today's miles, for the daily-goal ring
 *   nodes    : { "<unitId>:<n>": { stars, plays } } — path node completion
 *   badges   : { badgeId: timestampMs }
 *   settings : { dailyGoal, sound, voice, coldOpen }
 *   mode     : "academy" | "linecheck" — which way questions are presented
 *   lc       : Line Check stats { rounds, best, rushBest, spoken, cards, lastColdOpen }
 *
 * Also provides export/import so progress can move between devices.
 */

const STORAGE_KEY = "united-airport-trainer.v1"; // key kept stable; payload is versioned

const DEFAULT_SETTINGS = {
  dailyGoal: 120, // miles per day (~one flight lands comfortably past it)
  sound: true,
  // Line Check voice: "full" = phone speaks AND listens, "prompts" = speaks
  // only, "off" = silent. Saying the answer out loud is the whole point, so
  // full is the default wherever the browser supports it.
  voice: "full",
  coldOpen: true, // occasionally ask one question the instant the app opens
};

// Line Check progress (kept apart from the Academy path stats).
const DEFAULT_LC = { rounds: 0, best: 0, rushBest: 0, spoken: 0, cards: 0, lastColdOpen: 0 };

const DEFAULT_STREAK = { count: 0, best: 0, lastDay: null };

function freshState() {
  return {
    version: 3,
    settings: { ...DEFAULT_SETTINGS },
    items: {},
    streak: { ...DEFAULT_STREAK },
    miles: 0,
    day: { dayIndex: null, miles: 0 },
    nodes: {},
    badges: {},
    freezes: 0, // banked "Weather Delays" (streak shields), max 2
    flawless: 0, // lifetime flawless flights (earns freezes)
    correctTotal: 0, // lifetime correct answers (Century Club badge)
    kisses: 0, // Maple kisses received (cards learned)
    mode: "academy", // active game mode
    lc: { ...DEFAULT_LC },
  };
}

// Normalize any stored payload (v1, v2 or v3) into a full v3 state.
function upgrade(parsed) {
  const s = freshState();
  if (!parsed || typeof parsed !== "object") return s;
  s.items = parsed.items || {};
  s.streak = { ...DEFAULT_STREAK, ...(parsed.streak || {}) };
  s.miles = Number(parsed.miles) || 0;
  s.day = parsed.day && typeof parsed.day === "object" ? { dayIndex: parsed.day.dayIndex ?? null, miles: Number(parsed.day.miles) || 0 } : { dayIndex: null, miles: 0 };
  s.nodes = parsed.nodes || {};
  s.badges = parsed.badges || {};
  s.freezes = Number(parsed.freezes) || 0;
  s.flawless = Number(parsed.flawless) || 0;
  s.correctTotal = Number(parsed.correctTotal) || 0;
  s.kisses = Number(parsed.kisses) || 0;
  s.mode = parsed.mode === "linecheck" ? "linecheck" : "academy";
  s.lc = { ...DEFAULT_LC, ...(parsed.lc && typeof parsed.lc === "object" ? parsed.lc : {}) };
  // v1 settings had { maxActive, scope }; carry over what still applies.
  const old = parsed.settings || {};
  s.settings = {
    ...DEFAULT_SETTINGS,
    ...(typeof old.dailyGoal === "number" ? { dailyGoal: old.dailyGoal } : {}),
    ...(typeof old.sound === "boolean" ? { sound: old.sound } : {}),
    ...(["full", "prompts", "off"].includes(old.voice) ? { voice: old.voice } : {}),
    ...(typeof old.coldOpen === "boolean" ? { coldOpen: old.coldOpen } : {}),
  };
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    return upgrade(JSON.parse(raw));
  } catch (err) {
    console.warn("Could not read saved progress, starting fresh.", err);
    return freshState();
  }
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

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
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

function parseImported(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || typeof parsed.items !== "object") {
    throw new Error("That doesn't look like an exported progress file.");
  }
  return upgrade(parsed);
}

const STORAGE_API = {
  STORAGE_KEY,
  DEFAULT_SETTINGS,
  DEFAULT_LC,
  freshState,
  upgrade,
  loadState,
  saveState,
  resetState,
  exportState,
  parseImported,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = STORAGE_API;
}
