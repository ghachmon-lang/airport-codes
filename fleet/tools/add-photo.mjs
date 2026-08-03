#!/usr/bin/env node
/*
 * add-photo.mjs — hand-pick one Commons photo into the app.
 *
 *   node tools/add-photo.mjs <typeId> "File:Exact Commons Title.jpg"
 *
 * Downloads a 1000px-wide rendition into photos/ under the next free
 * <typeId>_N.jpg name and appends a manifest entry with credit + license
 * pulled from Commons. Refuses non-free licenses. Companion to
 * fetch-photos.mjs for when a human (or Claude) has already chosen the
 * exact shot they want.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PHOTOS = join(ROOT, "photos");
const MANIFEST = join(PHOTOS, "manifest.json");
const WIDTH = 1000;
const FREE = /(^|\b)(CC BY|CC BY-SA|CC0|Public domain)/i;
const UA = { "User-Agent": "TypeRatings/1.0 (personal study app; contact via github)" };

const [typeId, title] = process.argv.slice(2);
if (!typeId || !title || !/^File:/i.test(title)) {
  console.error('Usage: node tools/add-photo.mjs <typeId> "File:Exact Title.jpg"');
  process.exit(1);
}

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Same politeness as fetch-photos.mjs: honor 429 Retry-After with backoff. */
async function politeFetch(url, what) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) {
      const wait = Math.max(Number(res.headers.get("retry-after")) || 0, attempt * 10) * 1000;
      console.log(`⏳ rate-limited on ${what} — waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${what} ${res.status}`);
    return res;
  }
  throw new Error(`${what} 429 (gave up after retries)`);
}

const url =
  "https://commons.wikimedia.org/w/api.php?" +
  new URLSearchParams({
    format: "json",
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: String(WIDTH),
  });
const res = await politeFetch(url, "Commons API");
const page = Object.values((await res.json()).query?.pages || {})[0];
const ii = page?.imageinfo?.[0];
if (!ii) throw new Error(`no imageinfo for ${title}`);
const meta = ii.extmetadata || {};
const license = stripHtml(meta.LicenseShortName?.value);
if (!FREE.test(license)) throw new Error(`license "${license}" is not free — refusing`);

await mkdir(PHOTOS, { recursive: true });
let manifest = [];
try {
  manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
} catch {}
let n = 1;
const taken = new Set(manifest.map((e) => e.file));
while (taken.has(`${typeId}_${n}.jpg`) || taken.has(`${typeId}_${n}.png`)) n++;
const ext = /png/i.test(ii.mime || "") ? "png" : "jpg";
const file = `${typeId}_${n}.${ext}`;

const img = await politeFetch(ii.thumburl || ii.url, "download");
await writeFile(join(PHOTOS, file), Buffer.from(await img.arrayBuffer()));
manifest.push({
  type: typeId,
  file,
  credit: stripHtml(meta.Artist?.value),
  license,
  source: ii.descriptionurl,
});
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✅ ${file} ← ${title} (${license})`);
