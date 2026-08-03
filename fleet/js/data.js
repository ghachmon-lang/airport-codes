/*
 * data.js — the United mainline fleet (prototype slice: 5 types).
 *
 * Every fact here is public, stable, spec-level knowledge (fleet lists,
 * aisle counts, approximate United seat counts). Nothing safety-critical
 * or manual-specific — that's what training is for. Seat counts are
 * "about" numbers on purpose: configs vary by tail.
 *
 * `spot` is the money field: the visual cue that separates this type from
 * its lookalikes. It's shown after every answer, right or wrong, so each
 * rep teaches *how* to tell planes apart, not just the label.
 *
 * `sil` drives the placeholder silhouette renderer (photos.js) until real
 * photos land in photos/manifest.json. Rough proportions, not blueprints.
 */

const FLEET = [
  {
    id: "b737-800",
    name: "Boeing 737-800",
    family: "737",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 166,
    spot:
      "Pointy nose, and the engine bottoms look flattened (the 737 “hamster pouch”). " +
      "Sits low to the ground. United's workhorse — you'll fly this one constantly.",
    fun: "The backbone of the fleet: United flies more 737s than anything else.",
    sil: { len: 300, h: 34, nose: 34, finH: 52, finSweep: 34, engR: 15, engFlat: true, tip: "split" },
  },
  {
    id: "a320",
    name: "Airbus A320",
    family: "A320",
    maker: "Airbus",
    body: "narrowbody",
    aisles: 1,
    seats: 150,
    spot:
      "The 737's lookalike — but the nose is rounded like a dolphin, the engines are " +
      "perfectly round, and it stands taller on its landing gear.",
    fun: "First airliner family flown by computer “fly-by-wire” controls with a sidestick.",
    sil: { len: 296, h: 34, nose: 44, finH: 50, finSweep: 30, engR: 16, engFlat: false, tip: "sharklet" },
  },
  {
    id: "b757-200",
    name: "Boeing 757-200",
    family: "757",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 169,
    spot:
      "Long and lanky with very tall landing gear — it looks like it's standing on stilts. " +
      "One aisle inside, but big enough to cross the Atlantic.",
    fun: "Crews call it the “flying pencil.” A single-aisle jet that flies to Europe.",
    sil: { len: 340, h: 32, nose: 40, finH: 56, finSweep: 38, engR: 17, engFlat: false, tip: "winglet", tallGear: true },
  },
  {
    id: "b777-300er",
    name: "Boeing 777-300ER",
    family: "777",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 350,
    spot:
      "Enormous — the engines alone are as wide as a 737's body. Six wheels on each " +
      "main landing gear leg. No winglets; the wings end in a straight rake.",
    fun: "United's biggest plane. Its GE90 engines are the largest ever put on an airliner.",
    sil: { len: 400, h: 44, nose: 46, finH: 64, finSweep: 44, engR: 24, engFlat: false, tip: "raked" },
  },
  {
    id: "b787-9",
    name: "Boeing 787-9",
    family: "787",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 257,
    spot:
      "Smooth, swoopy look: the windshield blends into the nose with no step, the wings " +
      "flex upward, and the engine covers have zig-zag (sawtooth) trailing edges.",
    fun: "The “Dreamliner” — built from carbon fiber, with bigger windows that dim at a touch.",
    sil: { len: 360, h: 40, nose: 52, finH: 56, finSweep: 40, engR: 20, engFlat: false, tip: "raked", chevrons: true },
  },
];

/*
 * Which types get confused with which. Distractor picking prefers the
 * listed rivals first, then same body class, then anything. When the
 * fleet grows (MAX 9 vs -900ER, A321 vs A320...) this map is where the
 * "twins" pressure comes from.
 */
const RIVALS = {
  "b737-800": ["a320", "b757-200"],
  "a320": ["b737-800", "b757-200"],
  "b757-200": ["b737-800", "a320"],
  "b777-300er": ["b787-9"],
  "b787-9": ["b777-300er"],
};

if (typeof module !== "undefined") module.exports = { FLEET, RIVALS };
