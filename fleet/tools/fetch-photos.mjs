#!/usr/bin/env node
/*
 * fetch-photos.mjs — pull freely-licensed United fleet photos from
 * Wikimedia Commons into photos/ and (re)build photos/manifest.json with
 * proper attribution. No dependencies; needs Node 18+ (built-in fetch).
 *
 * Usage (from the fleet/ directory, on a machine with open internet):
 *   node tools/fetch-photos.mjs            # download up to 3 photos per type
 *   node tools/fetch-photos.mjs --per 5    # more photos per type
 *   node tools/fetch-photos.mjs --prune    # only rebuild manifest from files
 *                                          #   still on disk (after you delete
 *                                          #   any photos you don't like)
 *
 * Curation is human: the script grabs the top search hits with a free
 * license, then YOU look at photos/ and delete bad ones (weird angles,
 * other airlines, blurry) and run --prune. The quiz is only as good as
 * the photos.
 */
import { writeFile, readFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PHOTOS = join(ROOT, "photos");
const MANIFEST = join(PHOTOS, "manifest.json");
const API = "https://commons.wikimedia.org/w/api.php";
const WIDTH = 1000; // downloaded thumb width (plenty for a phone screen)

// Search terms tuned for United-livery, side-ish views.
const SEARCHES = {
  "b737-800": 'United Airlines Boeing 737-800',
  "a320": 'United Airlines Airbus A320',
  "b757-200": 'United Airlines Boeing 757-200',
  "b777-300er": 'United Airlines Boeing 777-300ER',
  "b787-9": 'United Airlines Boeing 787-9',
};

const FREE = /(^|\b)(CC BY|CC BY-SA|CC0|Public domain)/i;

const args = process.argv.slice(2);
const PER = Math.max(1, parseInt(args[args.indexOf("--per") + 1], 10) || 3);
const PRUNE = args.includes("--prune");

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").trim();
}

async function api(params) {
  const url = API + "?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(url, { headers: { "User-Agent": "TypeRatings/1.0 (personal study app)" } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

async function candidatesFor(term) {
  const data = await api({
    action: "query",
    generator: "search",
    gsrsearch: term + " filetype:bitmap",
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: String(WIDTH),
  });
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
    .filter((c) => c && /jpeg|png/.test(c.mime || "") && FREE.test(c.license || ""));
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

  const manifest = await existingManifest();
  const have = new Set(manifest.map((e) => e.file));

  for (const [typeId, term] of Object.entries(SEARCHES)) {
    const already = manifest.filter((e) => e.type === typeId).length;
    if (already >= PER) {
      console.log(`${typeId}: already has ${already} photos, skipping`);
      continue;
    }
    console.log(`${typeId}: searching Commons for “${term}”…`);
    let cands;
    try {
      cands = await candidatesFor(term);
    } catch (err) {
      console.error(`  ⚠️  search failed: ${err.message}`);
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
        console.log(`  ✅ ${file}  (${c.license} — ${c.credit || "unknown"})`);
      } catch (err) {
        console.error(`  ⚠️  ${c.title}: ${err.message}`);
      }
    }
    if (n === already) console.log(`  😕 no freely-licensed hits — try tweaking the search term`);
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
