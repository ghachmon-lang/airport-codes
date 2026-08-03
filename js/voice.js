/*
 * voice.js — the phone talks, and listens.
 *
 * This is the single biggest reason Line Check transfers to real life: hearing
 * "you're working the flight to Denver tonight" and SAYING "DEN" out loud is a
 * different retrieval path from reading four buttons, and it's the one that
 * fires when a human asks her at a party.
 *
 * Both halves degrade gracefully:
 *   - speechSynthesis is everywhere, but iOS refuses to speak until the page has
 *     spoken once inside a real tap — hence warmUp(), called from the first
 *     button press.
 *   - SpeechRecognition is Chrome/Android only today. Where it's missing the mic
 *     simply never appears and everything is typed instead.
 */

const Voice = (() => {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const Rec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  let warmed = false;
  let voice = null;
  let rec = null; // the live recognition session, if any

  const supportsSpeak = !!synth;
  const supportsListen = !!Rec;

  // Prefer a natural en-US voice; fall back to whatever English exists.
  function bestVoice() {
    if (!synth || voice) return voice;
    const all = synth.getVoices() || [];
    if (!all.length) return null;
    const en = all.filter((v) => /^en(-|_)/i.test(v.lang || ""));
    voice =
      en.find((v) => /samantha|google us english|aria|jenny/i.test(v.name)) ||
      en.find((v) => /en(-|_)US/i.test(v.lang)) ||
      en[0] ||
      all[0];
    return voice;
  }

  if (synth && typeof synth.addEventListener === "function") {
    // voice list arrives asynchronously on most browsers
    synth.addEventListener("voiceschanged", () => {
      voice = null;
      bestVoice();
    });
  }

  /*
   * iOS/Safari only allow speech that originates in a user gesture. Speaking a
   * single space inside the first tap unlocks the queue for the rest of the
   * session.
   */
  function warmUp() {
    if (!synth || warmed) return;
    warmed = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    } catch (e) {
      /* speech is a bonus — never let it break a tap */
    }
  }

  function stopSpeaking() {
    if (!synth) return;
    try {
      synth.cancel();
    } catch (e) {
      /* ignore */
    }
  }

  /*
   * Say something. Resolves when the utterance ends (or immediately when speech
   * isn't available), so callers can chain "speak the prompt, then listen".
   */
  function speak(text, { rate = 0.95, pitch = 1, onEnd } = {}) {
    return new Promise((resolve) => {
      const done = () => {
        if (onEnd) onEnd();
        resolve();
      };
      if (!synth || !text) return done();
      try {
        stopSpeaking();
        const u = new SpeechSynthesisUtterance(String(text));
        const v = bestVoice();
        if (v) u.voice = v;
        u.lang = (v && v.lang) || "en-US";
        u.rate = rate;
        u.pitch = pitch;
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
        // Safety net: some browsers never fire onend for long strings.
        setTimeout(done, Math.min(12000, 1200 + String(text).length * 90));
      } catch (e) {
        done();
      }
    });
  }

  function stopListening() {
    if (!rec) return;
    try {
      rec.abort();
    } catch (e) {
      /* ignore */
    }
    rec = null;
  }

  /*
   * Listen for one answer.
   *   onPartial(text)                 — live transcript while she's talking
   *   onFinal(text, alternatives[])   — what she said (best guess first)
   *   onError(kind)                   — "no-speech" | "not-allowed" | other
   *   onEnd()                         — mic closed, whatever happened
   * Returns a handle with stop().
   */
  function listen({ onPartial, onFinal, onError, onEnd } = {}) {
    if (!Rec) {
      if (onError) onError("unsupported");
      if (onEnd) onEnd();
      return { stop() {} };
    }
    stopListening();
    stopSpeaking(); // never listen to our own voice
    let finished = false;
    const r = new Rec();
    rec = r;
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 4;

    r.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          finished = true;
          const alts = [];
          for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
          if (onFinal) onFinal(alts[0] || "", alts);
        } else {
          interim += res[0].transcript;
        }
      }
      if (interim && onPartial) onPartial(interim);
    };
    r.onerror = (ev) => {
      if (onError) onError((ev && ev.error) || "error");
    };
    r.onend = () => {
      if (rec === r) rec = null;
      if (!finished && onError) onError("no-speech");
      if (onEnd) onEnd();
    };
    try {
      r.start();
    } catch (e) {
      // start() throws if a previous session is still closing
      if (onError) onError("busy");
      if (onEnd) onEnd();
    }
    return { stop: () => { try { r.stop(); } catch (e) { /* ignore */ } } };
  }

  return { supportsSpeak, supportsListen, warmUp, speak, stopSpeaking, listen, stopListening };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Voice };
}
