// ============================================================================
// QA: inga emojier från Emoji 13 eller senare (#590) i det en säsongsepic lagt
// till – Halloween (#696, epic #689), Vinter/Jul (#910, epic #906) och nästa.
// Generaliserad ur admin/qa-halloween-emoji.mjs (som nu bara anropar den här).
// Metoden: Unicodes emoji-test.txt + DerivedAge.txt, och bara RADER som lagts
// till under src/ och preview/ sedan bas-ref:en (git diff) – äldre Emoji 13+ i
// samma filer (t.ex. shop-items.js) räknas inte.
//   curl -o <dir>/emoji-test.txt https://unicode.org/Public/emoji/latest/emoji-test.txt
//   curl -o <dir>/DerivedAge.txt https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt
//   node admin/qa-sasong-emoji.mjs <dir> [bas-ref, förval origin/main]
//   node admin/qa-sasong-emoji.mjs <dir> --fixtur
//     → skriver test/fixtures/emoji-13-plus.json (tecken + sekvenser), som
//       test/sasong-emoji.test.js använder för att stoppa Emoji 13+ i
//       samlingarnas filer och katalog utan nätet.
// Avslutar med kod 1 om någon emoji är Emoji 13+.
// ============================================================================
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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

if (process.argv.includes("--fixtur")) {
  // Teckenintervall (> U+2000) + de Emoji 13+-sekvenser som bara består av
  // äldre tecken (t.ex. 🧑‍🎄, 🐻‍❄️) – resten fångas redan av intervallen.
  const intervall = nya.filter(([, b]) => b > 0x2000).map(([a, b]) => [Math.max(a, 0x2001), b]);
  const sekvenser = [...version]
    .filter(([s, v]) => v >= 13 && [...s].every((c) => !nyttTecken(c.codePointAt(0))))
    .map(([s]) => s)
    .sort();
  const ut = join(ROOT, "test/fixtures/emoji-13-plus.json");
  writeFileSync(ut, JSON.stringify({ kalla: "unicode.org emoji-test.txt + DerivedAge.txt", intervall, sekvenser }) + "\n");
  console.log(`Skrev ${ut}: ${intervall.length} intervall, ${sekvenser.length} sekvenser.`);
  process.exit(0);
}

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
