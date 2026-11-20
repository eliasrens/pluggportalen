// ============================================================================
// Matchdagen (#873, Etapp 3): MÄSTARCUPEN – ren (spec §10.2). Ingen DOM, ingen
// Firebase, ingen klocka. Den som vinner Superligan bjuds in till Mästarcupen
// NÄSTA säsong (md-sasong.js matchKlar sätter K.mastarcup = "säsong+1-0"). Cupen
// spelas vid sidan av ligan, mellan Superligans omgångar: kvartsfinal, semifinal
// och final mot påhittade toppklubbar från andra länder (md-namn.js TOPPKLUBBAR)
// med styrkan 0,86–0,95. Oavgjort → straffar, förlust → ute, finalvinst → den
// största pokalen och MASTARCUP.seger × multiplikatorn. Divisionen ändras aldrig.
//
// K.mastarcup är EN rad text (reglerna prövar den med ett reguljärt uttryck, MC_MONSTER):
//   "säsong-spelade" ("4-0" inbjudna säsong 4, "4-2" två rundor vunna) · "säsong-spelade-u"
//   (utslagna i den rundan) – "säsong-3" = vunnen. null, inget fält eller en annan säsong:
//   inte inbjudna den här säsongen.
//
//   mcSchema(antal)                     → [omgång, …] ligaomgångarna som rundorna spelas efter (11 → 3, 6, 8)
//   mcLage(K)                           → { inbjuden, spelade, ute, vann }
//   mcLottning(K, uid)                  → tre motståndare { id, namn, farg, styrka } (samma vid omladdning)
//   mcMatch(K, uid)                     → { runda, namn, final, mot } | null   (en match i Mästarcupen väntar nu)
//   mcKlar(K, { res, nu, matchId, uid, kallNamn?, rng? })
//                                       → { K, match, pengar, vann, vannCupen, runda, rekord }
//   mcInbjudan(K)                       → texten för inbjudan ("säsong+1-0") efter en vunnen Superliga
// ============================================================================

import * as C from "./md-config.js";
import { kl } from "./md-motor.js";
import { LAGFARGER, TOPPKLUBBAR } from "./md-namn.js";
import { skapaPrng } from "./md-prng.js";
import { bokforMatch } from "./md-sasong.js";
import { nyMarknad } from "./md-trupp.js";

export const MC_RUNDOR = C.MASTARCUP.rundor.length;
/** Samma uttryck som i firestore.rules (validMatchdagen, mastarcup) – testat i test/matchdagen-mastarcup.test.js. */
export const MC_MONSTER = "[0-9]{1,5}-[0-3](-u)?";
const kopia = (v) => JSON.parse(JSON.stringify(v));

/**
 * Ligaomgångarna som rundorna spelas efter: ligan delas i fyra jämna bitar, finalen alltid
 * före sista omgången. Superligan (11 omgångar) → 3, 6, 8 – Silverpokalen spelas efter 2, 4, 7, 9.
 */
export function mcSchema(antal) {
  const n = Number(antal) || 0;
  return Array.from({ length: MC_RUNDOR }, (_, i) => kl(Math.round(((i + 1) * n) / (MC_RUNDOR + 1)), 1, Math.max(1, n - 1)));
}

/** Inbjudan till nästa säsong efter en vunnen Superliga. */
export const mcInbjudan = (K) => `${(Number(K.sasong) || 1) + 1}-0`;

/** Mästarcupen den här säsongen: inbjudna, spelade rundor, utslagna, vunnen. */
export function mcLage(K) {
  const [, sasong, sp, u] = /^(\d+)-(\d)(-u)?$/.exec(String(K?.mastarcup ?? "")) || [];
  const spelade = Number(sp);
  const inbjuden = sasong != null && Number(sasong) === Number(K?.sasong) && spelade >= 0 && spelade <= MC_RUNDOR &&
    Number(K?.div) === C.TOPP_DIV;
  if (!inbjuden) return { inbjuden: false, spelade: 0, ute: false, vann: false };
  return { inbjuden, spelade, ute: !!u, vann: !u && spelade >= MC_RUNDOR };
}

/** Fröet för säsongens lottning: samma klubb och säsong ger samma motståndare. */
export const mcFro = (K, uid = "") => `${uid}|${K.sasong}|mastarcup`;

function blanda(rng, lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Säsongens tre motståndare: toppklubbar med styrkan MASTARCUP.styrka (0,86–0,95),
 * de svagaste först – finalen är tuffast.
 */
export function mcLottning(K, uid = "") {
  const rng = skapaPrng(mcFro(K, uid)).tal;
  const { min, max } = C.MASTARCUP.styrka;
  const namn = blanda(rng, TOPPKLUBBAR).slice(0, MC_RUNDOR);
  const styrkor = namn.map(() => Math.round((min + rng() * (max - min)) * 1000) / 1000).sort((a, b) => a - b);
  const farger = blanda(rng, LAGFARGER.filter((f) => f !== K.klubb?.farg));
  return namn.map((n, i) => ({ id: "mastarcup", namn: n, farg: farger[i % farger.length], styrka: styrkor[i] }));
}

/** Väntar en match i Mästarcupen nu? Efter ligaomgången i mcSchema, så länge laget är kvar och ligan inte är slut. */
export function mcMatch(K, uid = "") {
  if (!K?.liga?.schema) return null;
  const L = mcLage(K);
  if (!L.inbjuden || L.ute || L.vann) return null;
  const antal = K.liga.schema.length;
  const omg = Number(K.liga.omg) || 0;
  if (omg >= antal || omg < mcSchema(antal)[L.spelade]) return null;
  return { runda: L.spelade, namn: C.MASTARCUP.rundor[L.spelade], final: L.spelade === MC_RUNDOR - 1, mot: mcLottning(K, uid)[L.spelade] };
}

function vidare(res) {
  if (typeof res.vann === "boolean") return res.vann;
  if (res.oss === res.dem) throw new Error("mcKlar: oavgjord match utan straffar");
  return res.oss > res.dem;
}

/**
 * Matchen i Mästarcupen är spelad. Ändrar inte K. Bokförs som en match (kassa, summa,
 * senaste, dagar, rekord; matchdokumentet med typ "mastarcup" och omg = rundan 1–3).
 * Vinst → nästa runda, i finalen pokalen och prispengarna. Förlust → ute. Divisionen ändras aldrig.
 */
export function mcKlar(K0, { res, nu, matchId, uid = "", kallNamn = {}, rng = null }) {
  const mc = mcMatch(K0, uid);
  if (!mc) throw new Error("mcKlar: ingen match i Mästarcupen att spela");
  const vann = vidare(res);
  const K = kopia(K0);
  const runda = mc.runda + 1;
  const vannCupen = vann && runda >= MC_RUNDOR;
  const extraPengar = vannCupen ? Math.round(C.MASTARCUP.seger * (1 + (Number(K.div) || 0) * C.KASSA.perDiv)) : 0;
  const { match, pengar, dag, rekord } = bokforMatch(K, { res, nu, matchId, kallNamn, mot: mc.mot.namn, typ: "mastarcup", omg: runda, extraPengar });
  K.mastarcup = `${K.sasong}-${runda}${vann ? "" : "-u"}`;
  if (vannCupen) K.pokaler = [...(K.pokaler || []), { typ: "mastarcup", namn: C.MASTARCUP.namn, sasong: K.sasong, datum: dag }];
  if (rng) K.marknad = nyMarknad(K, rng);
  return { K, match, pengar, vann, vannCupen, runda: mc.runda, rekord };
}
