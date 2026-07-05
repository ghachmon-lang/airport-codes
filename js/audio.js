/*
 * audio.js — tiny WebAudio sound effects, fully synthesized (no audio files,
 * works offline). All game "juice" sounds live here. Respects a mute setting.
 *
 * Usage: Sfx.correct(combo) / Sfx.wrong() / Sfx.match() / Sfx.fanfare()
 *        / Sfx.unlock() / Sfx.tick() ; Sfx.muted = true|false
 */
const Sfx = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  // Play one tone: frequency, start offset (s), duration (s), type, volume.
  function tone(freq, at, dur, type = "sine", vol = 0.16) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  const api = {
    muted: false,
    // Correct answer: bright two-note blip that climbs with the combo count.
    correct(combo = 0) {
      if (api.muted) return;
      const base = 523.25 * Math.pow(1.0595, Math.min(combo, 12)); // C5 rising per combo
      tone(base, 0, 0.12, "sine", 0.15);
      tone(base * 1.5, 0.07, 0.16, "sine", 0.13);
    },
    // Wrong answer: soft low double-thud (discouraging but not punishing).
    wrong() {
      if (api.muted) return;
      tone(196, 0, 0.16, "triangle", 0.14);
      tone(147, 0.12, 0.22, "triangle", 0.12);
    },
    // A matched pair in the pairs game.
    match() {
      if (api.muted) return;
      tone(659.25, 0, 0.09, "sine", 0.12);
      tone(987.77, 0.05, 0.12, "sine", 0.1);
    },
    // Lesson complete: little fanfare (C–E–G–C arpeggio + sparkle).
    fanfare() {
      if (api.muted) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.22, "sine", 0.15));
      tone(1568, 0.4, 0.3, "sine", 0.09);
      tone(2093, 0.48, 0.35, "sine", 0.07);
    },
    // New unit / badge unlocked.
    unlock() {
      if (api.muted) return;
      tone(392, 0, 0.14, "sine", 0.13);
      tone(587.33, 0.1, 0.14, "sine", 0.13);
      tone(880, 0.2, 0.28, "sine", 0.14);
    },
    // Subtle UI tick (button taps, option select).
    tick() {
      if (api.muted) return;
      tone(880, 0, 0.045, "sine", 0.05);
    },
  };
  return api;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Sfx };
}
