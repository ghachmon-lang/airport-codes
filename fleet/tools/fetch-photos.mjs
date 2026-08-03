#!/usr/bin/env node
/*
 * fetch-photos.mjs — pull freely-licensed United fleet photos from
 * Wikimedia Commons into photos/ and (re)build photos/manifest.json with
 * proper attribution. No dependencies; needs Node 18+ (built-in fetch).
 *
 * Usage (from the fleet/ directory, on a machine with open internet):
 *   node tools/fetch-photos.mjs            # download up to 3 photos per type
 *   node tools/fetch-photos.mjs --per 5    # more photos per type
 *   node tools/fetch-photos.mjs --reset    # delete ALL downloaded photos and
 *                                          #   refetch from scratch
 *   node tools/fetch-photos.mjs --prune    # only rebuild manifest from files
 *                                          #   still on disk (after you delete
 *                                          #   any photos you don't like)
 *
 * Curation is human: the script grabs the top search hits with a free
 * license, then YOU look at photos/ and delete bad ones (weird angles,
 * other airlines, blurry) and run --prune. The quiz is only as good as
 * the photos.
 */
import { writeFile, readFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PHOTOS = join(ROOT, "photos");
const MANIFEST = join(PHOTOS, "manifest.json");
const API = "https://commons.wikimedia.org/w/api.php";
const WIDTH = 1000; // downloaded thumb width (plenty for a phone screen)

/*
 * Where to find photos. `cats` are Wikimedia Commons categories — Commons
 * curates aircraft photos per airline+type (e.g. "Boeing 737-800 of United
 * Airlines"), which is what guarantees UNITED planes and the RIGHT variant.
 * Plain text search is only a fallback, with a strict united-only filter,
 * because search ranks any popular 737 photo high (hello, Southwest).
 */
const SOURCES = {
  "b737-700": { cats: ["Boeing 737-700 of United Airlines"], search: "United Airlines Boeing 737-700" },
  "b737-800": { cats: ["Boeing 737-800 of United Airlines"], search: "United Airlines Boeing 737-800" },
  "b737-900er": { cats: ["Boeing 737-900ER of United Airlines", "Boeing 737-900 of United Airlines"], search: "United Airlines Boeing 737-900ER" },
  "b737-max8": { cats: ["Boeing 737 MAX 8 of United Airlines"], search: "United Airlines Boeing 737 MAX 8" },
  "b737-max9": { cats: ["Boeing 737 MAX 9 of United Airlines"], search: "United Airlines Boeing 737 MAX 9" },
  "a319": { cats: ["Airbus A319 of United Airlines", "Airbus A319-100 of United Airlines"], search: "United Airlines Airbus A319" },
  "a320": { cats: ["Airbus A320 of United Airlines", "Airbus A320-200 of United Airlines"], search: "United Airlines Airbus A320" },
  "a321neo": { cats: ["Airbus A321neo of United Airlines", "Airbus A321-271NX of United Airlines"], search: "United Airlines Airbus A321neo" },
  "b757-200": { cats: ["Boeing 757-200 of United Airlines"], search: "United Airlines Boeing 757-200" },
  "b757-300": { cats: ["Boeing 757-300 of United Airlines"], search: "United Airlines Boeing 757-300" },
  "b767-300er": { cats: ["Boeing 767-300ER of United Airlines", "Boeing 767-300 of United Airlines"], search: "United Airlines Boeing 767-300ER" },
  "b767-400er": { cats: ["Boeing 767-400ER of United Airlines"], search: "United Airlines Boeing 767-400ER" },
  "b777-200er": { cats: ["Boeing 777-200ER of United Airlines", "Boeing 777-200 of United Airlines"], search: "United Airlines Boeing 777-200ER" },
  "b777-300er": { cats: ["Boeing 777-300ER of United Airlines"], search: "United Airlines Boeing 777-300ER" },
  "b787-8": { cats: ["Boeing 787-8 of United Airlines"], search: "United Airlines Boeing 787-8" },
  "b787-9": { cats: ["Boeing 787-9 of United Airlines"], search: "United Airlines Boeing 787-9" },
  "b787-10": { cats: ["Boeing 787-10 of United Airlines"], search: "United Airlines Boeing 787-10" },
};

// Files that are clearly not "a United airplane you'd spot at a gate".
const BAD_TITLE = /interior|cabin|cockpit|seat|galley|lavatory|logo|livery detail|diagram|sticker|menu|meal/i;
// Fallback-search only: the title itself must say United, and must not be
// another airline's bird that happens to rank well.
const OTHER_AIRLINES = /southwest|delta|american air|alaska|jetblue|spirit|frontier|allegiant|hawaiian|westjet|lufthansa|air canada|continental|klm|ana\b|qantas|ryanair|easyjet/i;

const FREE = /(^|\b)(CC BY|CC BY-SA|CC0|Public domain)/i;

const args = process.argv.slice(2);
const PER = Math.max(1, parseInt(args[args.indexOf("--per") + 1], 10) || 3);
const PRUNE = args.includes("--prune");
const RESET = args.includes("--reset");

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").trim();
}

async function api(params) {
  const url = API + "?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(url, { headers: { "User-Agent": "TypeRatings/1.0 (personal study app)" } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

function toCandidates(data) {
  const pages = Object.values(data.query?.pages || {});
  return pages
    .map((p) => {
      const ii = p.imageinfo?.[0];
      const meta = ii?.extmetadata || {};
      return ii
        ? {
            title: p.title,
            thumb: ii.thumburl || ii.url,
            mime: ii.mime,
            license: stripHtml(meta.LicenseShortName?.value),
            credit: stripHtml(meta.Artist?.value),
            source: ii.descriptionurl,
          }
        : null;
    })
    .filter(
      (c) =>
        c &&
        /jpeg|png/.test(c.mime || "") &&
        FREE.test(c.license || "") &&
        !BAD_TITLE.test(c.title)
    );
}

/* Primary source: members of a curated Commons category — these are filed
 * by humans as "this airline, this exact variant", so no Southwest strays. */
async function categoryCandidates(cat) {
  const data = await api({
    action: "query",
    generator: "categorymembers",
    gcmtitle: "Category:" + cat,
    gcmtype: "file",
    gcmlimit: "40",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: String(WIDTH),
  });
  return toCandidates(data);
}

/* Fallback: text search, but ONLY files whose own title says United and
 * doesn't name another airline. */
async function searchCandidates(term) {
  const data = await api({
    action: "query",
    generator: "search",
    gsrsearch: term + " filetype:bitmap",
    gsrnamespace: "6",
    gsrlimit: "25",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: String(WIDTH),
  });
  return toCandidates(data).filter(
    (c) => /united/i.test(c.title) && !OTHER_AIRLINES.test(c.title)
  );
}

async function candidatesFor(src) {
  for (const cat of src.cats) {
    try {
      const fromCat = await categoryCandidates(cat);
      if (fromCat.length) {
        console.log(`  📂 using category “${cat}” (${fromCat.length} usable files)`);
        return fromCat;
      }
    } catch (err) {
      console.error(`  ⚠️  category “${cat}”: ${err.message}`);
    }
  }
  console.log(`  🔎 no category hits — falling back to filtered search`);
  return searchCandidates(src.search);
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "TypeRatings/1.0 (personal study app)" } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function existingManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return [];
  }
}

async function prune() {
  const entries = await existingManifest();
  const kept = [];
  for (const e of entries) {
    try {
      await stat(join(PHOTOS, e.file));
      kept.push(e);
    } catch {
      console.log(`  ✂️  dropped ${e.file} (deleted from disk)`);
    }
  }
  await writeFile(MANIFEST, JSON.stringify(kept, null, 2) + "\n");
  console.log(`Manifest rebuilt: ${kept.length} photos.`);
}

async function main() {
  await mkdir(PHOTOS, { recursive: true });
  if (PRUNE) return prune();
  if (RESET) {
    for (const f of await readdir(PHOTOS))
      if (f !== "manifest.json") await unlink(join(PHOTOS, f));
    await writeFile(MANIFEST, "[]\n");
    console.log("🧹 Cleared photos/ and manifest — refetching from scratch.\n");
  }

  const manifest = await existingManifest();
  const have = new Set(manifest.map((e) => e.file));

  for (const [typeId, src] of Object.entries(SOURCES)) {
    const already = manifest.filter((e) => e.type === typeId).length;
    if (already >= PER) {
      console.log(`${typeId}: already has ${already} photos, skipping`);
      continue;
    }
    console.log(`${typeId}: looking on Commons…`);
    let cands;
    try {
      cands = await candidatesFor(src);
    } catch (err) {
      console.error(`  ⚠️  lookup failed: ${err.message}`);
      continue;
    }
    let n = already;
    for (const c of cands) {
      if (n >= PER) break;
      const ext = /png/i.test(c.mime) ? "png" : "jpg";
      const file = `${typeId}_${n + 1}.${ext}`;
      if (have.has(file)) { n++; continue; }
      try {
        await download(c.thumb, join(PHOTOS, file));
        manifest.push({ type: typeId, file, credit: c.credit, license: c.license, source: c.source });
        have.add(file);
        n++;
        console.log(`  ✅ ${file} ← ${c.title}  (${c.license} — ${c.credit || "unknown"})`);
      } catch (err) {
        console.error(`  ⚠️  ${c.title}: ${err.message}`);
      }
    }
    if (n === already) console.log(`  😕 nothing usable found for ${typeId}`);
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  const files = (await readdir(PHOTOS)).filter((f) => f !== "manifest.json");
  console.log(`\nDone. ${files.length} photos on disk, ${manifest.length} in the manifest.`);
  console.log("👀 Now LOOK at photos/ — delete any bad shots, then run: node tools/fetch-photos.mjs --prune");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
