// ============================================================================
// Schack 3B (#791, spec §13): bygg pusselbanken "Matt i ett drag" och "Matt i
// två drag" ur Lichess öppna pusseldatabas (CC0, https://database.lichess.org/#puzzles).
//
//   node admin/schack-pussel.mjs                       strömma från lichess.org
//   node admin/schack-pussel.mjs --fil <csv.zst|csv>   en redan hämtad fil
//   node admin/schack-pussel.mjs --max-rader 2000000 --antal 200
//
// Filen är stor (~300 MB zstd, ~5,8 miljoner pussel). Den STRÖMMAS och dekomprimeras
// i minnet med `zstd -dc` (zstd-programmet – bara här i admin/, aldrig i webben)
// och läsningen avbryts efter --max-rader rader. Pusslen ligger i slumpmässig
// ordning (PuzzleId), så de första raderna är ett slumpmässigt urval av hela banken.
// Ingen rådata sparas – bara resultatet:
//
//   src/schack/pussel/matt-i-ett.json   ~200 pussel, lätt → svårt
//   src/schack/pussel/matt-i-tva.json   ~200 pussel, lätt → svårt
//
// Filtret (FILTER nedan): temat mateIn1 resp. mateIn2, säkert rating
// (RatingDeviation ≤ 90), populärt (Popularity ≥ 80) och spelat många gånger
// (NbPlays ≥ 300) och lätt: rating ≤ 1000 (matt i ett) resp. ≤ 1100 (matt i två) –
// Lichess lägsta är ~400, medel ~1500. Bara pussel där VIT är vid draget efter
// motståndarens första drag – texten är alltid "Vit drar …" och brädet står alltid
// med vit nederst (samma som partierna mot datorn). Urvalet sprids JÄMNT över
// ratingen (mål 400 → maxRating i 200 steg, närmaste giltiga pussel uppåt), annars
// hamnar alla 200 på 400–460 (tusentals pussel ligger där) och ordningen "lätt →
// svårt" blir platt. Resultatet sorteras på rating (lägst först), sedan flest spelningar. Normalisering: Lichess FEN är ställningen FÖRE motståndarens drag
// (första draget i Moves); skriptet gör det draget, så `fen` är ställningen där
// eleven är vid draget och `senast` det drag som just gjordes (markeras på brädet).
//
// Varje pussel kontrolleras med chess.js (src/schack/vendor/chess.js):
//   matt i ett: lösningsdraget är lagligt och ger matt (fler mattdrag får finnas –
//               vyn räknar VARJE drag som ger matt som rätt).
//   matt i två: ingen matt i ett finns; lösningens drag är lagliga, andra vita draget
//               ger matt; och lösningens första drag är det ENDA som tvingar fram
//               matt i två (mot varje svart svar finns ett mattdrag) – annars tas
//               pusslet bort, så att "fel första drag" aldrig är ett annat rätt drag.
// ============================================================================

import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/schack/vendor/chess.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const UT = join(ROOT, "src/schack/pussel");
export const KALLA = "https://database.lichess.org/lichess_db_puzzle.csv.zst";

export const FILTER = { maxRd: 90, minPopularitet: 80, minSpelningar: 300 };
export const SORTER = {
  ett: { tema: "mateIn1", fil: "matt-i-ett.json", drag: 1, maxRating: 1000 },
  tva: { tema: "mateIn2", fil: "matt-i-tva.json", drag: 3, maxRating: 1100 },
};

// --- Kontrollen (ren, används också av test/schack-pussel.test.js) --------------

const uci = (m) => m.from + m.to + (m.promotion || "");
const dragAv = (s) => ({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] || undefined });

/** Gör ett UCI-drag; null om det är olagligt. */
export function provaUci(chess, s) {
  try {
    return chess.move(dragAv(s));
  } catch {
    return null;
  }
}

/** Alla drag som ger matt direkt (UCI). */
export function mattDrag(fen) {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).filter((m) => {
    c.move(m);
    const matt = c.isCheckmate();
    c.undo();
    return matt;
  }).map(uci);
}

/** Tvingar vita draget `s` fram matt i nästa drag (mot VARJE svart svar)? */
function tvingarMatt(fen, s) {
  const c = new Chess(fen);
  if (!provaUci(c, s) || c.isGameOver()) return false;
  for (const svar of c.moves({ verbose: true })) {
    c.move(svar);
    const ok = mattDrag(c.fen()).length > 0;
    c.undo();
    if (!ok) return false;
  }
  return true;
}

/** Alla vita första drag som tvingar fram matt i två (UCI). */
export function mattITvaForsta(fen) {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).map(uci).filter((s) => tvingarMatt(fen, s));
}

/**
 * Normalisera en Lichess-rad: gör motståndarens första drag. Returnerar
 * { fen, senast, losning } eller null (olagligt drag, svart vid draget).
 */
export function normalisera(lichessFen, moves) {
  let c;
  try {
    c = new Chess(lichessFen);
  } catch {
    return null;
  }
  const [forsta, ...losning] = moves;
  if (!forsta || !provaUci(c, forsta) || c.turn() !== "w") return null;
  return { fen: c.fen(), senast: forsta, losning };
}

/**
 * Kontrollera ett normaliserat pussel. Returnerar null om det håller, annars
 * en kort förklaring. `sort` = "ett" | "tva".
 */
export function kontrollera(p, sort) {
  let c;
  try {
    c = new Chess(p.fen);
  } catch {
    return "ogiltig FEN";
  }
  if (c.turn() !== "w") return "inte vit vid draget";
  if (c.isGameOver()) return "redan slut";
  if (sort === "ett") {
    if (p.losning.length !== 1) return "fel antal drag";
    if (!provaUci(c, p.losning[0])) return "olagligt drag";
    if (!c.isCheckmate()) return "inte matt";
    return null;
  }
  if (p.losning.length !== 3) return "fel antal drag";
  if (mattDrag(p.fen).length) return "matt i ett finns";
  if (!provaUci(c, p.losning[0])) return "olagligt första drag";
  if (c.isGameOver()) return "slut efter första draget";
  if (!provaUci(c, p.losning[1])) return "olagligt försvar";
  if (!provaUci(c, p.losning[2])) return "olagligt andra drag";
  if (!c.isCheckmate()) return "inte matt efter andra draget";
  const forsta = mattITvaForsta(p.fen);
  if (forsta.length !== 1 || forsta[0] !== p.losning[0]) return `${forsta.length} första drag ger matt i två`;
  return null;
}

// --- Läsningen -------------------------------------------------------------------

function argument(argv) {
  const a = { fil: null, maxRader: 2_000_000, antal: 200 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--fil") a.fil = argv[++i];
    else if (argv[i] === "--max-rader") a.maxRader = Number(argv[++i]);
    else if (argv[i] === "--antal") a.antal = Number(argv[++i]);
  }
  return a;
}

/**
 * zstd-avkodare: zstd-programmet (`apt install zstd`). node:zlib:s experimentella
 * zstd (node 22) klarar inte Lichess-filen ("Unknown frame descriptor").
 */
function zstdStrom(inStrom) {
  const p = spawn("zstd", ["-dc"], { stdio: ["pipe", "pipe", "inherit"] });
  p.on("error", (e) => { console.error(`zstd saknas? ${e.message}`); process.exit(1); });
  inStrom.pipe(p.stdin);
  p.stdin.on("error", () => {}); // EPIPE när vi avbryter läsningen tidigt
  return { strom: p.stdout, stang: () => p.kill() };
}

async function radStrom(fil, avbryt) {
  let ratt;
  if (fil) ratt = createReadStream(fil);
  else {
    const svar = await fetch(KALLA, { signal: avbryt.signal });
    if (!svar.ok) throw new Error(`${KALLA}: HTTP ${svar.status}`);
    ratt = Readable.fromWeb(svar.body);
  }
  const z = !fil || fil.endsWith(".zst") ? zstdStrom(ratt) : { strom: ratt, stang() {} };
  return {
    rader: createInterface({ input: z.strom, crlfDelay: Infinity }),
    stang: () => { z.stang(); ratt.destroy(); },
  };
}

/** Rad → { id, fen, moves, rating, rd, pop, spelningar, teman } (eller null för rubriken). */
function tolka(rad) {
  const f = rad.split(",");
  if (f.length < 8 || f[0] === "PuzzleId") return null;
  return {
    id: f[0], fen: f[1], moves: f[2].split(" "), rating: Number(f[3]), rd: Number(f[4]),
    pop: Number(f[5]), spelningar: Number(f[6]), teman: f[7].split(" "),
  };
}

export const ordning = (a, b) => a.rating - b.rating || b.spelningar - a.spelningar || (a.id < b.id ? -1 : 1);

async function main() {
  const a = argument(process.argv.slice(2));
  const avbryt = new AbortController();
  const { rader, stang } = await radStrom(a.fil, avbryt);
  const kandidater = { ett: [], tva: [] };
  let lasta = 0;
  for await (const rad of rader) {
    const r = tolka(rad);
    if (!r) continue;
    if (++lasta >= a.maxRader) break;
    if (lasta % 250_000 === 0) console.log(`  ${lasta} rader, ${kandidater.ett.length} + ${kandidater.tva.length} kandidater`);
    if (r.rd > FILTER.maxRd || r.pop < FILTER.minPopularitet || r.spelningar < FILTER.minSpelningar) continue;
    for (const [sort, s] of Object.entries(SORTER)) {
      if (!r.teman.includes(s.tema) || r.moves.length !== s.drag + 1) continue;
      const n = normalisera(r.fen, r.moves);
      if (n) kandidater[sort].push({ ...r, ...n });
    }
  }
  rader.close();
  avbryt.abort();
  stang();
  console.log(`Läste ${lasta} rader.`);
  if (!lasta) throw new Error("Inga rader lästes – nås lichess.org? Hitta aldrig på pussel.");

  mkdirSync(UT, { recursive: true });
  const hamtad = new Date().toISOString().slice(0, 10);
  for (const [sort, s] of Object.entries(SORTER)) {
    const valda = [];
    const bort = {};
    const lista = kandidater[sort].filter((k) => k.rating <= s.maxRating).sort(ordning);
    const lagst = lista[0]?.rating ?? 0;
    let i = 0;
    for (let steg = 0; steg < a.antal && i < lista.length; steg++) {
      const mal = lagst + ((s.maxRating - lagst) * steg) / Math.max(1, a.antal - 1);
      while (i < lista.length && lista[i].rating < mal) i++;
      // Närmaste GILTIGA pussel från målet och uppåt.
      for (; i < lista.length; i++) {
        const k = lista[i];
        const fel = kontrollera(k, sort);
        if (fel) { bort[fel] = (bort[fel] || 0) + 1; continue; }
        valda.push({ id: k.id, fen: k.fen, senast: k.senast, losning: k.losning, rating: k.rating });
        i++;
        break;
      }
    }
    const ut = {
      sort, tema: s.tema, kalla: KALLA, licens: "CC0-1.0", hamtad, lastaRader: lasta,
      filter: { ...FILTER, maxRating: s.maxRating },
      antal: valda.length, pussel: valda,
    };
    // En rad per pussel: läsbart i en diff, och litet nog att ladda lat.
    const json = `{\n${Object.entries(ut).filter(([k]) => k !== "pussel").map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n` +
      `  "pussel": [\n${valda.map((p) => `    ${JSON.stringify(p)}`).join(",\n")}\n  ]\n}\n`;
    writeFileSync(join(UT, s.fil), json);
    const r = valda.map((p) => p.rating);
    console.log(`${s.fil}: ${valda.length} av ${lista.length} kandidater, rating ${r[0]}–${r.at(-1)}; bortsorterade ${JSON.stringify(bort)}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
