// ============================================================================
// QA #696 (Höst & Halloween G, epic #689): inga emojier från Emoji 13 eller
// senare i det som epicen lagt till/ändrat. Samma metod som
// admin/qa-datakuppen-emoji.mjs (Unicodes emoji-test.txt + DerivedAge.txt),
// men bara RADER som epicen lagt till under src/ och preview/ (git diff mot en
// bas-ref) – äldre Emoji 13+ i samma filer (t.ex. shop-items.js) räknas inte.
//   curl -o /tmp/u/emoji-test.txt https://unicode.org/Public/emoji/latest/emoji-test.txt
//   curl -o /tmp/u/DerivedAge.txt https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt
//   node admin/qa-halloween-emoji.mjs /tmp/u [bas-ref, förval origin/main]
// Avslutar med kod 1 om någon emoji är Emoji 13+.
// ============================================================================
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
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

const bas = execFileSync("git", ["merge-base", "HEAD", process.argv[3] || "origin/main"], { encoding: "utf8" }).trim();
// Tillagda rader per fil ur en -U0-diff (flyttade rader räknas som tillagda).
const TILLAGT = new Map();
let aktuell = null;
for (const rad of execFileSync("git", ["diff", "-U0", bas, "HEAD", "--", "src", "preview"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n")) {
  if (rad.startsWith("+++ ")) aktuell = rad.slice(6);
  else if (rad.startsWith("+") && aktuell) TILLAGT.set(aktuell, (TILLAGT.get(aktuell) || "") + rad.slice(1) + "\n");
}
const ROTTER = [...TILLAGT.keys()];
const LANGST = Math.max(...[...version.keys()].map((s) => [...s].length));

const fynd = new Map(); // emoji → { v, filer }
const notera = (e, v, f) => {
  const x = fynd.get(e) || { v, filer: new Set() };
  x.filer.add(f);
  fynd.set(e, x);
};
for (const f of ROTTER) {
  const tecken = [...TILLAGT.get(f).replace(/️/g, "")];
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
console.log(`\n${fynd.size} olika emojier i ${ROTTER.length} filers tillagda rader; högsta version: E${rader[0]?.[1].v}; Emoji 13+: ${fel}`);
process.exitCode = fel ? 1 : 0;
