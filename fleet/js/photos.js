/*
 * photos.js — real photos when we have them, silhouettes when we don't.
 *
 * Real photos live in photos/ and are described by photos/manifest.json:
 *   [{ "type": "b737-800", "file": "b737-800_1.jpg",
 *      "credit": "Jane Doe", "license": "CC BY-SA 4.0",
 *      "source": "https://commons.wikimedia.org/wiki/File:..." }, ...]
 * (tools/fetch-photos.mjs builds that file automatically.)
 *
 * Types with no photos fall back to a parametric SVG silhouette drawn from
 * data.js `sil` proportions — clearly stylized so nobody mistakes it for
 * the real thing, but distinct enough that the game is playable today.
 */

const Photos = (() => {
  let byType = {}; // typeId -> [manifest entries]
  let cursor = {}; // typeId -> next photo index (rotate so reps vary)
  let all = [];

  async function load(url = "photos/manifest.json") {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      all = await res.json();
    } catch (_) {
      all = []; // no manifest yet → placeholders everywhere
    }
    byType = {};
    for (const p of all) (byType[p.type] = byType[p.type] || []).push(p);
    return all;
  }

  const hasPhotos = (typeId) => (byType[typeId] || []).length > 0;
  const anyPhotos = () => all.length > 0;
  const credits = () => all.slice();

  /* Next photo for a type, rotating through the set so reps don't burn a
   * single image into memory ("I recognize *that photo*" ≠ "I recognize
   * the plane"). */
  function next(typeId) {
    const list = byType[typeId] || [];
    if (!list.length) return null;
    const i = (cursor[typeId] = ((cursor[typeId] ?? -1) + 1) % list.length);
    return list[i];
  }

  /* ---------- placeholder silhouette (side profile, nose right) -------- */
  function silhouette(type) {
    const s = type.sil;
    const W = 460, H = 190;
    const groundY = 158;
    const gear = s.tallGear ? 26 : 16;
    const cy = groundY - gear - s.h / 2; // fuselage centerline
    const noseX = 30 + s.len; // fuselage spans [30, noseX]
    const top = cy - s.h / 2, bot = cy + s.h / 2;

    // Fuselage: tail cone sweeps up, belly flat-ish, rounded nose.
    const fuselage = `M ${30 + s.finSweep} ${top + 4}
      C ${30 + s.finSweep + 30} ${top}, ${noseX - s.nose - 40} ${top}, ${noseX - s.nose} ${top}
      Q ${noseX} ${top + s.h * 0.28}, ${noseX} ${cy}
      Q ${noseX} ${bot - s.h * 0.2}, ${noseX - s.nose} ${bot}
      L ${30 + s.finSweep + 44} ${bot}
      C ${30 + s.finSweep + 16} ${bot}, ${30 + s.finSweep + 2} ${bot - 8}, ${30 + s.finSweep} ${top + 4} Z`;

    // Vertical stabilizer (gold, like the Academy palette).
    const fin = `M ${30 + s.finSweep + 6} ${top + 6} L ${30 + 14} ${top - s.finH}
      L ${30 + 44} ${top - s.finH} L ${30 + s.finSweep + 46} ${top + 6} Z`;

    // Wing (simple swept blade toward viewer) + wingtip flourish.
    const wingRootX = 30 + s.len * 0.46;
    const wingTipX = wingRootX - s.len * 0.16;
    const wing = `M ${wingRootX} ${cy + 2} L ${wingTipX} ${cy + 34}
      L ${wingTipX + 26} ${cy + 36} L ${wingRootX + s.len * 0.14} ${cy + 4} Z`;
    let tip = "";
    if (s.tip === "winglet" || s.tip === "sharklet" || s.tip === "split")
      tip = `<path d="M ${wingTipX} ${cy + 34} l 6 -18 l 7 2 l -5 17 Z" fill="#0a3161"/>`;
    if (s.tip === "split")
      tip += `<path d="M ${wingTipX} ${cy + 34} l 2 10 l 7 -1 l -3 -10 Z" fill="#0a3161"/>`;
    if (s.tip === "raked")
      tip = `<path d="M ${wingTipX} ${cy + 34} l -14 6 l 22 -1 Z" fill="#0a3161"/>`;

    // Engine under the wing. 737s get the famous flattened bottom.
    const engX = wingRootX - s.len * 0.05;
    const engY = cy + 26;
    const engBottom = s.engFlat
      ? `M ${engX - s.engR} ${engY} a ${s.engR} ${s.engR} 0 0 1 ${s.engR * 2} 0
         q 0 ${s.engR * 0.55} -${s.engR} ${s.engR * 0.55} q -${s.engR} 0 -${s.engR} -${s.engR * 0.55} Z`
      : `M ${engX} ${engY} m -${s.engR} 0 a ${s.engR} ${s.engR} 0 1 0 ${s.engR * 2} 0
         a ${s.engR} ${s.engR} 0 1 0 -${s.engR * 2} 0`;
    const chev = s.chevrons
      ? `<path d="M ${engX - s.engR} ${engY + s.engR * 0.5} l 4 4 l 4 -4 l 4 4 l 4 -4" stroke="#0a3161" stroke-width="2" fill="none"/>`
      : "";

    // Landing gear struts + wheels (tall for the 757).
    const gearLeg = (x) =>
      `<line x1="${x}" y1="${bot}" x2="${x}" y2="${groundY - 7}" stroke="#5b6678" stroke-width="4"/>
       <circle cx="${x}" cy="${groundY - 6}" r="7" fill="#1a2230"/>`;

    // Cabin window strip + cockpit.
    const winY = cy - s.h * 0.12;
    const windows = `<rect x="${30 + s.finSweep + 52}" y="${winY - 2}" width="${s.len - s.finSweep - s.nose - 66}" height="4.5" rx="2" fill="#0a3161" opacity="0.55"/>`;
    const cockpit = `<path d="M ${noseX - s.nose + 4} ${top + 5} q 14 -1 20 6 l -18 4 Z" fill="#0a3161"/>`;

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stylized airplane silhouette">
      <rect width="${W}" height="${H}" fill="#eaf1fb"/>
      <line x1="0" y1="${groundY + 2}" x2="${W}" y2="${groundY + 2}" stroke="#cfd6e2" stroke-width="3"/>
      <path d="${fin}" fill="#f0a500"/>
      <path d="${fuselage}" fill="#ffffff" stroke="#8fa5c4" stroke-width="2.5"/>
      ${windows}${cockpit}
      <path d="${wing}" fill="#cfd9ea" stroke="#8fa5c4" stroke-width="2"/>
      ${tip}
      <path d="${engBottom}" fill="#dfe7f3" stroke="#8fa5c4" stroke-width="2.5"/>
      ${chev}
      ${gearLeg(noseX - s.nose - 8)}${gearLeg(wingRootX + 8)}
      <text x="${W - 8}" y="16" text-anchor="end" font-size="11" fill="#5b6678" font-family="sans-serif">placeholder art</text>
    </svg>`;
  }

  return { load, hasPhotos, anyPhotos, credits, next, silhouette };
})();

if (typeof module !== "undefined") module.exports = { Photos };
