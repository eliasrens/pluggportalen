// ============================================================================
// QA #656 (Datakuppen F, spec §6 test 19): inga emojier från Emoji 13 eller
// senare i Datakuppens gränssnitt. Till skillnad från test/mynt-ikon.test.js
// (ett urval) jämförs här mot Unicodes egna tabeller:
//   emoji-test.txt  – varje emoji och sekvens med sin Emoji-version (E13.1 =
//                     sekvenser av gamla tecken, t.ex. 😮‍💨)
//   DerivedAge.txt  – vilken Unicode-version varje tecken kom i (13.0+ = nytt)
// Hämta dem (en gång) till en mapp och ange den:
//   curl -o /tmp/u/emoji-test.txt https://unicode.org/Public/emoji/latest/emoji-test.txt
//   curl -o /tmp/u/DerivedAge.txt https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt
//   node admin/qa-datakuppen-emoji.mjs /tmp/u
// Skriver varje emoji som används (med version och filer) och avslutar med
// kod 1 om någon är Emoji 13+.
// ============================================================================
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "emoji-test.txt"))) {
  console.error("Ange mappen med emoji-test.txt och DerivedAge.txt.");
  process.exit(2);
}

// Emoji-version per sekvens (utan FE0F, så att båda skrivsätten hittas).
const version = new Map();
for (const rad of readFileSync(join(dir, "emoji-test.txt"), "utf8").split("\n")) {
  const m = rad.match(/^([0-9A-F ]+);\s*\S+\s*#\s*\S+\s+E(\d+\.\d+)/);
  if (!m) continue;
  const seq = String.fromCodePoint(...m[1].trim().split(/\s+/).map((h) => parseInt(h, 16))).replace(/️/g, "");
  version.set(seq, Math.min(version.get(seq) ?? 99, Number(m[2])));
}
// Tecken som kom i Unicode 13.0 eller senare (oavsett om de är emojier).
const nya = [];
for (const rad of readFileSync(join(dir, "DerivedAge.txt"), "utf8").split("\n")) {
  const m = rad.match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*(\d+)\.\d/);
  if (m && Number(m[3]) >= 13) nya.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
}
const nyttTecken = (cp) => cp > 0x2000 && nya.some(([a, b]) => cp >= a && cp <= b);

function filer(p) {
  if (!existsSync(p)) return [];
  if (!statSync(p).isDirectory()) return [p];
  return readdirSync(p).flatMap((n) => filer(join(p, n))).filter((f) => /\.(js|mjs|css|html|json)$/.test(f));
}
const ROTTER = [
  "src/live/formats/datakuppen", "src/live/kistspel", "functions/datakuppen", "functions/kistspel",
  ...readdirSync("functions").filter((n) => n.startsWith("datakuppen")).map((n) => `functions/${n}`),
  ...readdirSync("src/live").filter((n) => /\.(js|css)$/.test(n)).map((n) => `src/live/${n}`),
  ...readdirSync("preview").filter((n) => n.includes("datakupp")).map((n) => `preview/${n}`),
];
const LANGST = Math.max(...[...version.keys()].map((s) => [...s].length));

const fynd = new Map(); // emoji → { v, filer }
const notera = (e, v, f) => {
  const x = fynd.get(e) || { v, filer: new Set() };
  x.filer.add(f);
  fynd.set(e, x);
};
for (const f of ROTTER.flatMap(filer)) {
  const tecken = [...readFileSync(f, "utf8").replace(/️/g, "")];
  for (let i = 0; i < tecken.length; i++) {
    let traff = null;
    for (let n = Math.min(LANGST, tecken.length - i); n >= 1 && !traff; n--) {
      const s = tecken.slice(i, i + n).join("");
      if (version.has(s) && (n > 1 || s.codePointAt(0) > 0xff)) traff = [s, n];
    }
    if (traff) {
      notera(traff[0], version.get(traff[0]), f);
      i += traff[1] - 1;
    } else if (nyttTecken(tecken[i].codePointAt(0))) {
      notera(tecken[i], "Unicode 13+", f);
    }
  }
}

const rader = [...fynd].sort((a, b) => (typeof b[1].v === "number" ? b[1].v : 99) - (typeof a[1].v === "number" ? a[1].v : 99));
let fel = 0;
for (const [e, { v, filer: fs }] of rader) {
  const ny = typeof v !== "number" || v >= 13;
  if (ny) fel++;
  const cps = [...e].map((c) => c.codePointAt(0).toString(16).toUpperCase()).join(" ");
  console.log(`${ny ? "✗" : "✓"} ${e}  U+${cps}  E${v}  (${fs.size} fil${fs.size > 1 ? "er" : ""})${ny ? " → " + [...fs].join(", ") : ""}`);
}
console.log(`\n${fynd.size} olika emojier i ${ROTTER.flatMap(filer).length} filer; högsta version: E${rader[0]?.[1].v}; Emoji 13+: ${fel}`);
process.exitCode = fel ? 1 : 0;
