/*
 * data.js — the United mainline fleet, full tree (16 types in 5 groups).
 *
 * Every fact here is public, stable, spec-level knowledge (fleet lists,
 * aisle counts, approximate seats/length/range). Nothing safety-critical
 * or manual-specific — that's what training is for. Numbers are "about"
 * values on purpose: configs vary by tail, and the game only ever asks
 * for *comparisons* with a healthy gap (see quiz.js TRUMP_GAP).
 *
 * Per type:
 *   spot  — the visual cue that separates it from lookalikes; shown after
 *           every answer, so each rep teaches HOW to tell planes apart.
 *   clues — Who Am I? riddle lines, vague → giveaway.
 *   sil   — placeholder silhouette proportions (photos.js) until real
 *           photos land in photos/manifest.json.
 *   seats/lenFt/rangeMi/aisles — Top Trumps comparison stats.
 */

const FLEET = [
  // ===== Group 1 — First Wings ==========================================
  {
    id: "b737-800",
    name: "Boeing 737-800",
    family: "737",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 166,
    lenFt: 129,
    rangeMi: 3300,
    spot:
      "Pointy nose, and the engine bottoms look flattened (the 737 “hamster pouch”). " +
      "Sits low to the ground. United's workhorse — you'll fly this one constantly.",
    fun: "The backbone of the fleet: United flies more 737s than anything else.",
    clues: [
      "I'm a single-aisle Boeing, and there are more of me at United than any other plane.",
      "My engine covers look a little flattened on the bottom.",
      "I'm the middle child of the classic 737 family — bigger than the -700, shorter than the -900.",
    ],
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
    lenFt: 123,
    rangeMi: 3500,
    spot:
      "The 737's lookalike — but the nose is rounded like a dolphin, the engines are " +
      "perfectly round, and it stands taller on its landing gear.",
    fun: "First airliner family flown by computer “fly-by-wire” controls with a sidestick.",
    clues: [
      "I'm a single-aisle jet, but I'm not a Boeing.",
      "My pilots steer me with a sidestick, like a video game.",
      "Round nose, round engines — I'm the 737's European rival.",
    ],
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
    lenFt: 155,
    rangeMi: 4500,
    spot:
      "Long and lanky with very tall landing gear — it looks like it's standing on stilts. " +
      "One aisle inside, but big enough to cross the Atlantic.",
    fun: "Crews call it the “flying pencil.” A single-aisle jet that flies to Europe.",
    clues: [
      "I have one aisle, but I still cross the Atlantic.",
      "I stand on landing gear so tall I look like I'm on stilts.",
      "Crews call me the flying pencil.",
    ],
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
    lenFt: 242,
    rangeMi: 8500,
    spot:
      "Enormous — the engines alone are as wide as a 737's body. Six wheels on each " +
      "main landing gear leg. No winglets; the wings end in a straight rake.",
    fun: "United's biggest plane. Its GE90 engines are the largest ever put on an airliner.",
    clues: [
      "I'm the biggest plane United flies.",
      "Each of my engines is about as wide as a 737's whole body.",
      "Count my wheels: six on each main landing gear leg.",
    ],
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
    lenFt: 206,
    rangeMi: 8800,
    spot:
      "Smooth, swoopy look: the windshield blends into the nose with no step, the wings " +
      "flex upward, and the engine covers have zig-zag (sawtooth) trailing edges.",
    fun: "The “Dreamliner” — built from carbon fiber, with bigger windows that dim at a touch.",
    clues: [
      "I'm made mostly of carbon fiber, not aluminum.",
      "My windows don't have shades — they dim at the touch of a button.",
      "I'm the mid-size Dreamliner, between the -8 and the -10.",
    ],
    sil: { len: 360, h: 40, nose: 52, finH: 56, finSweep: 40, engR: 20, engFlat: false, tip: "raked", chevrons: true },
  },

  // ===== Group 2 — The 737 Family =======================================
  {
    id: "b737-700",
    name: "Boeing 737-700",
    family: "737",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 126,
    lenFt: 110,
    rangeMi: 3400,
    spot:
      "A stubby 737: same pointy nose and flat-bottom engines, but noticeably short. " +
      "If it looks like a 737 that shrank in the wash, it's the -700.",
    fun: "The smallest Boeing at United — quick hops and thinner routes.",
    clues: [
      "I'm the smallest Boeing United flies.",
      "Same pointy nose and flat-bottom engines as my siblings — just less of me.",
      "I'm the baby of the classic 737 family.",
    ],
    sil: { len: 270, h: 34, nose: 34, finH: 50, finSweep: 32, engR: 15, engFlat: true, tip: "split" },
  },
  {
    id: "b737-900er",
    name: "Boeing 737-900ER",
    family: "737",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 179,
    lenFt: 138,
    rangeMi: 3200,
    spot:
      "The stretch 737 — longest of the classic family, with an extra small exit door " +
      "behind the wing. Same flat-bottom engines as the -800.",
    fun: "ER means Extended Range: the longest classic 737 United flies.",
    clues: [
      "I'm a stretched version of United's most common plane.",
      "I have an extra small exit door behind the wing that my shorter siblings lack.",
      "The two letters at the end of my name stand for Extended Range.",
    ],
    sil: { len: 320, h: 34, nose: 34, finH: 52, finSweep: 34, engR: 15, engFlat: true, tip: "split" },
  },
  {
    id: "b737-max8",
    name: "Boeing 737 MAX 8",
    family: "737",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 166,
    lenFt: 130,
    rangeMi: 3900,
    spot:
      "Looks like a 737-800 until you check the engines: bigger, rounder, and with " +
      "zig-zag chevron edges on the covers. Sleeker pointed tail cone, too.",
    fun: "The new-generation 737 — quieter, with much better fuel range.",
    clues: [
      "I'm the new generation of a very familiar Boeing.",
      "My engine covers have zig-zag sawtooth edges to keep me quiet.",
      "Same size as the 737-800, but my name sounds like a superlative.",
    ],
    sil: { len: 302, h: 34, nose: 34, finH: 52, finSweep: 34, engR: 17, engFlat: false, tip: "split", chevrons: true },
  },
  {
    id: "b737-max9",
    name: "Boeing 737 MAX 9",
    family: "737",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 179,
    lenFt: 138,
    rangeMi: 3800,
    spot:
      "The stretched MAX — chevron engine covers give away the MAX part, and it's " +
      "longer than the MAX 8 (same length as the 737-900ER).",
    fun: "The big MAX: 737-900ER length with new-generation engines.",
    clues: [
      "I'm the stretched version of Boeing's newest narrowbody at United.",
      "Zig-zag chevron engine covers, but longer than my -8 sibling.",
      "I'm the MAX that matches the 737-900ER in length.",
    ],
    sil: { len: 322, h: 34, nose: 34, finH: 52, finSweep: 34, engR: 17, engFlat: false, tip: "split", chevrons: true },
  },

  // ===== Group 3 — The Airbus Corner ====================================
  {
    id: "a319",
    name: "Airbus A319",
    family: "A320",
    maker: "Airbus",
    body: "narrowbody",
    aisles: 1,
    seats: 126,
    lenFt: 111,
    rangeMi: 4000,
    spot:
      "A shortened A320: same rounded dolphin nose and round engines, but stubby. " +
      "Think “baby Airbus.”",
    fun: "Small but mighty — the A319 handles short runways and small cities with ease.",
    clues: [
      "I'm the smallest Airbus United flies.",
      "Rounded nose, perfectly round engines, short body.",
      "I'm the A320's little sibling.",
    ],
    sil: { len: 268, h: 34, nose: 44, finH: 48, finSweep: 30, engR: 16, engFlat: false, tip: "sharklet" },
  },
  {
    id: "a321neo",
    name: "Airbus A321neo",
    family: "A320",
    maker: "Airbus",
    body: "narrowbody",
    aisles: 1,
    seats: 200,
    lenFt: 146,
    rangeMi: 4000,
    spot:
      "The longest Airbus in the fleet — a stretched A320 with big round engines and " +
      "four full-size doors down each side instead of two plus overwing exits.",
    fun: "“neo” means New Engine Option — United's newest narrowbody, replacing the 757 on many routes.",
    clues: [
      "I'm United's newest single-aisle plane.",
      "The last three letters of my name mean New Engine Option.",
      "I'm the stretched Airbus taking over many routes from the aging 757.",
    ],
    sil: { len: 330, h: 34, nose: 44, finH: 52, finSweep: 32, engR: 17, engFlat: false, tip: "sharklet" },
  },

  // ===== Group 4 — Long-Haul Classics ===================================
  {
    id: "b757-300",
    name: "Boeing 757-300",
    family: "757",
    maker: "Boeing",
    body: "narrowbody",
    aisles: 1,
    seats: 234,
    lenFt: 178,
    rangeMi: 3900,
    spot:
      "The 757 that kept stretching — the longest single-aisle plane United flies, " +
      "on the same stilt-like landing gear as its little sibling.",
    fun: "The longest single-aisle airliner Boeing ever built.",
    clues: [
      "I'm the longest single-aisle plane at United.",
      "I stand on the same stilt-like landing gear as my shorter sibling.",
      "I'm the super-stretched version of the flying pencil.",
    ],
    sil: { len: 372, h: 32, nose: 40, finH: 56, finSweep: 38, engR: 17, engFlat: false, tip: "winglet", tallGear: true },
  },
  {
    id: "b767-300er",
    name: "Boeing 767-300ER",
    family: "767",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 167,
    lenFt: 180,
    rangeMi: 6900,
    spot:
      "A gentle-giant widebody, narrower than a 777, and most of United's wear very " +
      "tall blended winglets. Shorter body than its -400 sibling.",
    fun: "United's 767-300ERs carry a huge share of Polaris business seats across the Atlantic.",
    clues: [
      "I'm a widebody, but the smallest kind United flies.",
      "Most of us wear very tall, curved winglets.",
      "I'm the Atlantic specialist with a huge share of Polaris business seats.",
    ],
    sil: { len: 350, h: 40, nose: 44, finH: 58, finSweep: 40, engR: 19, engFlat: false, tip: "winglet" },
  },
  {
    id: "b767-400er",
    name: "Boeing 767-400ER",
    family: "767",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 240,
    lenFt: 201,
    rangeMi: 6500,
    spot:
      "The stretched 767: longer body and swept-back raked wingtips instead of " +
      "winglets. Only a handful of airlines ever flew it.",
    fun: "A rare bird — United is one of only two airlines that ever flew the 767-400ER.",
    clues: [
      "I'm a stretched widebody that only two airlines ever flew.",
      "No winglets for me — my wingtips sweep straight back.",
      "I'm the biggest member of the 767 family.",
    ],
    sil: { len: 380, h: 40, nose: 44, finH: 58, finSweep: 40, engR: 19, engFlat: false, tip: "raked" },
  },

  // ===== Group 5 — Widebody Flagships ===================================
  {
    id: "b777-200er",
    name: "Boeing 777-200ER",
    family: "777",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 280,
    lenFt: 209,
    rangeMi: 8300,
    spot:
      "The 777's shorter body — still huge, with the same six-wheel landing gear " +
      "trucks, but more balanced-looking than the super-stretched -300ER.",
    fun: "United's globe-trotter: the -200ER opened ultra-long routes across the Pacific.",
    clues: [
      "I'm a giant twin-engine widebody, but not the longest of my family.",
      "Six wheels on each main gear leg, like my bigger sibling.",
      "I'm the original long-range 777 at United.",
    ],
    sil: { len: 380, h: 44, nose: 46, finH: 62, finSweep: 44, engR: 24, engFlat: false, tip: "raked" },
  },
  {
    id: "b787-8",
    name: "Boeing 787-8",
    family: "787",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 243,
    lenFt: 186,
    rangeMi: 8400,
    spot:
      "The shortest Dreamliner — same smooth blended nose and chevron engine covers, " +
      "but it looks almost stubby next to its sisters.",
    fun: "The original Dreamliner — United was the first US airline to fly the 787.",
    clues: [
      "I'm made of carbon fiber, and I'm the shortest of my family.",
      "United was the first airline in the US to fly me.",
      "I'm the baby Dreamliner.",
    ],
    sil: { len: 344, h: 40, nose: 52, finH: 54, finSweep: 40, engR: 20, engFlat: false, tip: "raked", chevrons: true },
  },
  {
    id: "b787-10",
    name: "Boeing 787-10",
    family: "787",
    maker: "Boeing",
    body: "widebody",
    aisles: 2,
    seats: 318,
    lenFt: 224,
    rangeMi: 7400,
    spot:
      "The longest Dreamliner — a stretched -9 that looks almost too long for its " +
      "wings. Same smooth nose and chevron engine covers.",
    fun: "The full-stretch Dreamliner — trades a little range for a lot more seats.",
    clues: [
      "I'm the longest member of the carbon-fiber family.",
      "I trade a little range for a lot more seats.",
      "If the Dreamliner looks stretched almost too far — that's me.",
    ],
    sil: { len: 384, h: 40, nose: 52, finH: 58, finSweep: 40, engR: 20, engFlat: false, tip: "raked", chevrons: true },
  },
];

/*
 * The fleet tree: groups unlock in order. Group N+1 opens once every type
 * in group N has UNLOCK_CORRECT lifetime correct answers (see quiz.js).
 */
const GROUPS = [
  { id: "g1", name: "First Wings", icon: "🛫", types: ["b737-800", "a320", "b757-200", "b777-300er", "b787-9"] },
  { id: "g2", name: "The 737 Family", icon: "✈️", types: ["b737-700", "b737-900er", "b737-max8", "b737-max9"] },
  { id: "g3", name: "The Airbus Corner", icon: "🇪🇺", types: ["a319", "a321neo"] },
  { id: "g4", name: "Long-Haul Classics", icon: "🌊", types: ["b757-300", "b767-300er", "b767-400er"] },
  { id: "g5", name: "Widebody Flagships", icon: "🌏", types: ["b777-200er", "b787-8", "b787-10"] },
];

/*
 * Which types get confused with which. Distractor picking prefers the
 * listed rivals first, then same body class, then anything.
 */
const RIVALS = {
  "b737-700": ["a319", "b737-800"],
  "b737-800": ["b737-900er", "b737-max8", "a320"],
  "b737-900er": ["b737-max9", "b737-800"],
  "b737-max8": ["b737-800", "b737-max9"],
  "b737-max9": ["b737-900er", "b737-max8"],
  "a319": ["b737-700", "a320"],
  "a320": ["b737-800", "a319", "a321neo"],
  "a321neo": ["a320", "b757-200"],
  "b757-200": ["b757-300", "b737-900er", "a321neo"],
  "b757-300": ["b757-200", "a321neo"],
  "b767-300er": ["b767-400er", "b787-8"],
  "b767-400er": ["b767-300er", "b787-9"],
  "b777-200er": ["b777-300er", "b787-9"],
  "b777-300er": ["b777-200er", "b787-10"],
  "b787-8": ["b787-9", "b767-300er"],
  "b787-9": ["b787-10", "b787-8", "b777-200er"],
  "b787-10": ["b787-9", "b777-300er"],
};

/*
 * Twins mode: curated lookalike pairs. `tell` is the after-answer lesson —
 * the one cue that reliably separates the pair. A pair enters the rotation
 * once both types are unlocked.
 */
const TWINS = [
  { a: "b737-800", b: "a320", tell: "Nose shape: pointy = Boeing 737, rounded dolphin nose = Airbus A320. The A320 also stands taller and its engines are perfectly round." },
  { a: "b777-300er", b: "b787-9", tell: "The 777's engines are even bigger, its main gear has six wheels per truck (the 787 has four), and the 787's windshield blends smoothly into the nose." },
  { a: "b737-800", b: "b737-max8", tell: "Chevrons! The MAX 8's engine covers have zig-zag trailing edges and are bigger. The -800's engines have the classic flat bottom." },
  { a: "b737-900er", b: "b737-max9", tell: "Same trick: chevron engine covers = MAX 9. The -900ER also shares the classic flat-bottom engines." },
  { a: "a319", b: "b737-700", tell: "The two babies: rounded nose and round engines = A319; pointy nose and flat-bottom engines = 737-700." },
  { a: "a320", b: "a321neo", tell: "Length: the A321neo is a stretched A320 with four full-size doors per side instead of two plus overwing exits." },
  { a: "b757-200", b: "b757-300", tell: "The -300 is dramatically longer — the longest single-aisle jet at United. If it seems to go on forever, it's the -300." },
  { a: "b757-200", b: "a321neo", tell: "The old guard vs its replacement: the 757 stands on much taller landing gear and has a pointier nose; the A321neo's nose is rounded and its engines are fatter." },
  { a: "b767-300er", b: "b767-400er", tell: "Wingtips: tall blended winglets = -300ER, swept-back raked tips = -400ER. The -400 is longer, too." },
  { a: "b777-200er", b: "b777-300er", tell: "Both are giants with six-wheel gear trucks, but the -300ER is a full stretch longer — it looks almost train-like on the taxiway." },
  { a: "b787-9", b: "b787-10", tell: "Pure length: the -10 is the full stretch. If the body looks almost too long for the wings, it's the -10." },
  { a: "b787-8", b: "b787-9", tell: "The -8 is the stubby one — shorter body, same smooth nose and chevron engine covers. The -9 looks better-proportioned." },
];

if (typeof module !== "undefined") module.exports = { FLEET, GROUPS, RIVALS, TWINS };
