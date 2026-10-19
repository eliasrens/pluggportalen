// ============================================================================
// Schackets pluggmynt (#798) – SERVERNS kontroll av det eleven skickar in. Ren
// modul (chess.js + motorn + lektionerna + pusslen, inget DOM, ingen Firebase);
// kopieras till functions/schack/ med npm run sync:schack och testas i node.
//
//   verifieraDatorParti({ niva, seed, drag }, { egenFarg?, krav, ... }) → { ok, fel?, studentFarg }
//       Draglistan (SAN) spelas upp med chess.js: alla drag lagliga, partiet slutar
//       med matt där eleven vinner (krav "vinst") eller är över enligt reglerna
//       (krav "klart", lektion 12). VARJE datordrag kontrolleras sedan med motorn:
//       det måste vara nivåns val med partiets seed (seed + halvdrag · 7919) på
//       något djup mellan MIN_DJUP och nivåns största (provaDatorDrag).
//   verifieraLektion(nr, losning)  → { ok, fel? }   övningens slutvillkor per uppgift
//   verifieraPussel(pussel, sort, drag) → bool       elevens drag (UCI) löser pusslet
//
// Felkoderna (`fel`) är korta ord som servern gör om till HttpsError.
// ============================================================================

import { Chess } from "./vendor/chess.js";
import { provaDatorDrag } from "./schack-motor.js";
import { lektionFor, bedomDrag } from "./schack-lektioner.js";
import { skapaJaktKontroll } from "./schack-stjarnjakt.js";
import { skapaPusselLopp, uciDrag, ARSORT } from "./schack-pussel.js";
import { DATOR_MYNT } from "./schack-mynt-delat.js";

export const MAX_HALVDRAG = 600;
/** Lägsta djup som godtas per nivå (en långsam dator kan ha hunnit ett djup mindre). */
export const MIN_DJUP = Object.freeze({ bonden: 1, springaren: 1, tornet: 2, damen: 3 });
/** Tidsgräns för servern att hitta ETT datordrag, och för hela partiet. */
export const DRAG_TIDSGRANS_MS = 5_000;
export const PARTI_TIDSGRANS_MS = 150_000;

const SAN_OK = /^[A-Za-z0-9+#=\-]{2,9}$/;
const RUTA_OK = /^[a-h][1-8]$/;
const UCI_OK = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const PROMO_OK = new Set(["q", "r", "b", "n"]);

export const arSeed = (s) => Number.isInteger(s) && s >= 0 && s < 2 ** 32;

/**
 * Ett parti mot datorn.
 * @param {{ niva: string, seed: number, drag: string[] }} p
 * @param {object} [o]
 * @param {"w"|"b"} [o.egenFarg]   elevens färg om den är bestämd (lektion 12: vit)
 * @param {"vinst"|"klart"} [o.krav]
 * @param {() => number} [o.nu]
 * @param {number} [o.dragTidsgransMs]
 * @param {number} [o.partiTidsgransMs]
 */
export function verifieraDatorParti(p, o = {}) {
  const krav = o.krav || "vinst";
  const nu = o.nu || (() => performance.now());
  if (!p || typeof p !== "object" || !Object.hasOwn(DATOR_MYNT, p.niva)) return { ok: false, fel: "niva" };
  if (!arSeed(p.seed)) return { ok: false, fel: "seed" };
  const drag = p.drag;
  if (!Array.isArray(drag) || !drag.length || drag.length > MAX_HALVDRAG || !drag.every((d) => typeof d === "string" && SAN_OK.test(d))) {
    return { ok: false, fel: "drag" };
  }
  // 1. Reglerna (billigt): varje drag lagligt, och slutet.
  const c = new Chess();
  const fore = []; // [{ fen, tur, drag: {from,to,promotion} }]
  for (const san of drag) {
    const fen = c.fen();
    const tur = c.turn();
    let m;
    try { m = c.move(san); } catch { m = null; }
    if (!m) return { ok: false, fel: "olagligt" };
    fore.push({ fen, tur, drag: { from: m.from, to: m.to, promotion: m.promotion || undefined } });
  }
  let studentFarg;
  if (krav === "vinst") {
    if (!c.isCheckmate()) return { ok: false, fel: "ingen-matt" };
    studentFarg = c.turn() === "w" ? "b" : "w"; // den som är matt är på tur
    if (o.egenFarg && o.egenFarg !== studentFarg) return { ok: false, fel: "ingen-matt" };
  } else {
    if (!c.isGameOver()) return { ok: false, fel: "inte-slut" };
    studentFarg = o.egenFarg || "w";
  }
  // 2. Datorns drag (dyrt): nivåns val med partiets seed.
  const datorFarg = studentFarg === "w" ? "b" : "w";
  const slutTid = nu() + (o.partiTidsgransMs ?? PARTI_TIDSGRANS_MS);
  for (let i = 0; i < fore.length; i++) {
    if (fore[i].tur !== datorFarg) continue;
    if (nu() > slutTid) return { ok: false, fel: "tid" };
    const djup = provaDatorDrag(fore[i].fen, fore[i].drag, {
      niva: p.niva, seed: (p.seed + i * 7919) >>> 0, historik: { drag: drag.slice(0, i) },
      minDjup: MIN_DJUP[p.niva], tidsgransMs: o.dragTidsgransMs ?? DRAG_TIDSGRANS_MS, nu: o.nu,
    });
    if (!djup) return { ok: false, fel: "dator", halvdrag: i };
  }
  return { ok: true, studentFarg };
}

/** Ett ställningsdrag ({from,to,promotion?}) → brädets dragobjekt som bedomDrag läser, eller null. */
function stallningsDrag(fen, d) {
  if (!d || typeof d !== "object" || !RUTA_OK.test(d.from) || !RUTA_OK.test(d.to)) return null;
  if (d.promotion != null && !PROMO_OK.has(d.promotion)) return null;
  const c = new Chess(fen);
  let m;
  try { m = c.move({ from: d.from, to: d.to, promotion: d.promotion || undefined }); } catch { m = null; }
  return m ? { piece: m.piece, captured: m.captured, flags: m.flags, san: m.san, efter: c.fen() } : null;
}

/**
 * En lektion i guiden – övningens slutvillkor, uppgift för uppgift:
 *   fragor    losning = [ruta …]               rätt ruta per fråga
 *   jakt      losning = [[ruta …] …]           pjäsens mål i det lyckade försöket – alla stjärnor/pjäser tagna
 *   stallning losning = [{from,to,promotion?} …] draget som uppfyllde kravet
 *   parti     losning = { seed, drag: [SAN …] } ett helt parti mot Bonden som vit, spelat klart (inte uppgivet)
 */
export function verifieraLektion(nr, losning, o = {}) {
  const l = Number.isInteger(nr) ? lektionFor(nr) : null;
  if (!l) return { ok: false, fel: "lektion" };
  if (l.typ === "parti") {
    if (!losning || typeof losning !== "object" || Array.isArray(losning)) return { ok: false, fel: "losning" };
    const r = verifieraDatorParti({ niva: "bonden", seed: losning.seed, drag: losning.drag }, { ...o, egenFarg: "w", krav: "klart" });
    return r.ok ? { ok: true } : { ok: false, fel: r.fel };
  }
  if (!Array.isArray(losning) || losning.length !== l.uppgifter.length) return { ok: false, fel: "losning" };
  for (let i = 0; i < l.uppgifter.length; i++) {
    const u = l.uppgifter[i];
    const svar = losning[i];
    if (l.typ === "fragor") {
      if (typeof svar !== "string" || !u.svar.includes(svar)) return { ok: false, fel: "fel-svar", uppgift: i };
    } else if (l.typ === "jakt") {
      if (!Array.isArray(svar) || !svar.length || svar.length > 64 || !svar.every((r) => typeof r === "string" && RUTA_OK.test(r))) {
        return { ok: false, fel: "losning", uppgift: i };
      }
      const k = skapaJaktKontroll(u);
      for (const to of svar) if (!k.move(to)) return { ok: false, fel: "fel-svar", uppgift: i };
      if (!k.getState().jakt.klar) return { ok: false, fel: "fel-svar", uppgift: i };
    } else {
      const d = stallningsDrag(u.fen, svar);
      if (!d || !bedomDrag(u, d).ok) return { ok: false, fel: "fel-svar", uppgift: i };
    }
  }
  return { ok: true };
}

/**
 * Löser elevens drag (UCI, bara elevens egna – försvaret i matt i två spelas ur
 * lösningen) pusslet? Samma bedömning som pusselvyn (skapaPusselLopp): varje
 * mattdrag är rätt när det är dags för matt.
 */
export function verifieraPussel(pussel, sort, drag) {
  if (!pussel || !ARSORT(sort) || !Array.isArray(drag) || drag.length < 1 || drag.length > 2) return false;
  if (!drag.every((d) => typeof d === "string" && UCI_OK.test(d))) return false;
  const lopp = skapaPusselLopp(pussel, sort);
  for (let i = 0; i < drag.length; i++) {
    const r = lopp.bedom(uciDrag(drag[i]));
    if (!r.ok) return false;
    if (r.klart) return i === drag.length - 1;
  }
  return false;
}
