// ============================================================================
// Schack – texter och härledda värden ur en chess.js-ställning (#775, §2.3).
// Rena funktioner (ingen DOM, ingen egen regelkod): svensk notation,
// rutornas aria-etiketter, statusraden, slutet, tagna pjäser och draglistan.
// All regelkunskap (schack, matt, patt, remi) frågas från chess.js.
// ============================================================================

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const PJAS_NAMN = { p: "bonde", n: "springare", b: "löpare", r: "torn", q: "dam", k: "kung" };
export const FARG_NAMN = { w: "vit", b: "svart" };
const VARDE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SVENSK_BOKSTAV = { N: "S", B: "L", R: "T", Q: "D", K: "K" };

/** chess.js-notation (engelska bokstäver) → svensk: Nf3 → Sf3, e8=Q → e8=D. */
export function svenskSan(san) {
  return String(san).replace(/[NBRQK]/g, (c) => SVENSK_BOKSTAV[c]);
}

/** "vit springare", "vitt torn" (torn är ett ett-ord), "svart dam". */
export function pjasText(farg, typ) {
  const adj = FARG_NAMN[farg] + (typ === "r" && farg === "w" ? "t" : "");
  return `${adj} ${PJAS_NAMN[typ]}`;
}

/** Rutans aria-label: "e4, vit springare" / "e4, tom". */
export function rutaEtikett(ruta, pjas, tillagg = []) {
  return [ruta, pjas ? pjasText(pjas.color, pjas.type) : "tom", ...tillagg].join(", ");
}

/**
 * Slutet enligt chess.js, eller null om partiet pågår.
 * @returns {{ resultat: "1-0"|"0-1"|"½-½", orsak: string, vinnare: "w"|"b"|null } | null}
 */
export function slutFor(chess) {
  if (chess.isCheckmate()) {
    const vinnare = chess.turn() === "w" ? "b" : "w";
    return { resultat: vinnare === "w" ? "1-0" : "0-1", orsak: "matt", vinnare };
  }
  const remi = (orsak) => ({ resultat: "½-½", orsak, vinnare: null });
  if (chess.isStalemate()) return remi("patt");
  if (chess.isInsufficientMaterial()) return remi("material");
  if (chess.isThreefoldRepetition()) return remi("upprepning");
  if (chess.isDrawByFiftyMoves()) return remi("femtio");
  return null;
}

/** Förklaringen under statusraden när partiet har slutat (barnvänlig). */
export const ORSAK_TEXT = {
  matt: "Kungen står i schack och kan inte räddas.",
  patt: "Patt: den som är på tur kan inte flytta, men kungen står inte i schack.",
  material: "Ingen har tillräckligt med pjäser kvar för att kunna göra schack matt.",
  upprepning: "Samma ställning har kommit tre gånger.",
  femtio: "50 drag i rad utan att någon bonde har flyttats eller någon pjäs har tagits.",
  "gav-upp": "Partiet slutade med att någon gav upp.",
  tid: "Tiden tog slut.",
  avbrutet: "Partiet avbröts.",
};

/**
 * Statusraden. `ctx.egenFarg` = elevens färg (null = båda sidor spelas här,
 * som i förhandsvisningen); `ctx.motstandare` = "dator" | "kompis" | null;
 * `ctx.namn` = { w, b } (visningsnamn); `ctx.slut` = ett externt slut (t.ex.
 * "gav-upp") som går före ställningens.
 * @returns {{ text: string, ton: "normal"|"schack"|"vinst"|"forlust"|"remi", orsak: string }}
 */
export function statusFor(chess, ctx = {}) {
  const { egenFarg = null, motstandare = null, namn = {} } = ctx;
  const slut = ctx.slut || slutFor(chess);
  const vemText = (f) => (motstandare === "dator" && f !== egenFarg ? "datorn" : namn[f] || FARG_NAMN[f]);
  if (slut) {
    const orsak = slut.text || ORSAK_TEXT[slut.orsak] || "";
    const mattOrd = slut.orsak === "matt" ? "Schack matt" : "Slut";
    const ton = !slut.vinnare ? "remi" : !egenFarg || slut.vinnare === egenFarg ? "vinst" : "forlust";
    if (slut.titel) return { text: slut.titel, ton, orsak };
    if (!slut.vinnare) return { text: "Remi – ingen vann", ton: "remi", orsak };
    if (egenFarg && slut.vinnare === egenFarg) return { text: `${mattOrd} – du vann! 🎉`, ton: "vinst", orsak };
    if (egenFarg) return { text: `${mattOrd} – ${vemText(slut.vinnare)} vann.`, ton: "forlust", orsak };
    return { text: `${mattOrd} – ${vemText(slut.vinnare)} vann! 🎉`, ton: "vinst", orsak };
  }
  const tur = chess.turn();
  const schack = chess.isCheck();
  let text;
  if (!egenFarg) text = `${FARG_NAMN[tur] === "vit" ? "Vit" : "Svart"} drar`;
  else if (tur === egenFarg) text = schack ? "Din tur – rädda kungen!" : "Din tur";
  else if (motstandare === "dator") text = "Datorn tänker…";
  else text = `Väntar på ${vemText(tur)}…`;
  return { text: schack ? `Schack! ${text}` : text, ton: schack ? "schack" : "normal", orsak: "" };
}

/** Rutan där kungen som är på tur står, om den står i schack. */
export function schackRuta(chess) {
  if (!chess.isCheck()) return null;
  return chess.findPiece({ type: "k", color: chess.turn() })[0] || null;
}

function pjasLista(chess) {
  const lista = [];
  for (const rad of chess.board()) for (const p of rad) if (p) lista.push(p);
  return lista;
}

/**
 * Tagna pjäser per spelare: `tagna.w` = de svarta pjäser som vit har tagit,
 * räknat exakt ur draghistoriken (en inläst ställning utan historik har alltså
 * inga tagna pjäser – B och Etapp 2 laddar partier med loadGame och får dem).
 * `fordel` = materialövervikten på brädet (+N) för den som leder, annars 0.
 */
export function tagnaPjaser(chess) {
  const tagna = { w: [], b: [] };
  for (const d of chess.history({ verbose: true })) if (d.captured) tagna[d.color].push(d.captured);
  const ordning = "qrbnp";
  for (const f of ["w", "b"]) tagna[f].sort((a, b) => ordning.indexOf(a) - ordning.indexOf(b));
  const summa = { w: 0, b: 0 };
  for (const p of pjasLista(chess)) summa[p.color] += VARDE[p.type];
  const diff = summa.w - summa.b;
  return { tagna, fordel: { w: Math.max(0, diff), b: Math.max(0, -diff) } };
}

/**
 * Draglistan i enkel svensk notation: "1. e4 e5 2. Sf3". Börjar partiet från
 * en ställning där svart drar blir första raden "12… e5".
 * @returns {{ text: string, rader: string[] }}
 */
export function dragLista(sanLista, startFen = START_FEN) {
  const delar = String(startFen).split(/\s+/);
  let nr = Number(delar[5]) || 1;
  let tur = delar[1] === "b" ? "b" : "w";
  const rader = [];
  let rad = "";
  for (const san of sanLista) {
    const s = svenskSan(san);
    if (tur === "w") rad = `${nr}. ${s}`;
    else {
      rad = rad ? `${rad} ${s}` : `${nr}… ${s}`;
      rader.push(rad);
      rad = "";
      nr++;
    }
    tur = tur === "w" ? "b" : "w";
  }
  if (rad) rader.push(rad);
  return { text: rader.join(" "), rader };
}
