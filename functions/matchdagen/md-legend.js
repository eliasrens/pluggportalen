// ============================================================================
// Matchdagen (#873, Etapp 3): LEGENDKLUBBEN och POKALSKÅPET – ren (spec §10.3,
// §10.4). Ingen DOM, ingen Firebase, ingen klocka.
//
// Legendklubben: efter en vunnen Mästarcup erbjuds eleven att starta en ny klubb
// från Division 6 – nytt namn, nya grundpelare, nollställd kassa, ny marknad. Med
// följer pokalskåpet (pokaler), rekorden (rekord – den löpande säsongen nollas),
// statistiken (summa, senaste, dagar, säsongerna – lärarens historik får inte
// försvinna) och en guldstjärna på klubbmärket för varje klubb som tagits hela
// vägen (klubb.legendStjarnor). Den gamla klubben sparas som EN rad i
// klubbhistorik (reglerna prövar listan med ETT reguljärt uttryck, HISTORIK_MONSTER):
//   "namn|#färg|från-till|liga.kval.cup.superliga.mastarcup"   ("Pluggporten FC|#2f6fe8|1-24|3.4.2.2.1")
// Säsongerna räknas vidare (säsong 25 är den nya klubbens första) – så att pokalernas
// och rekordens säsonger aldrig blandas ihop mellan klubbarna.
//
//   legendErbjudande(K)          → bool   Mästarcupen vunnen DEN HÄR säsongen (och plats kvar i historiken)
//   nyLegendklubb(K, { namn, farg, rng }) → K för den nya klubben (ändrar inte K)
//   klubbStart(K)                → första säsongen för den nuvarande klubben
//   historikRader(lista)         → [{ namn, farg, fran, till, sasonger, pokaler: { liga, … } }] (tålig)
//   POKAL_SORTER, pokalSort(p), skapet(pokaler) → [{ id, namn, antal, sasonger }] (§10.4)
//   guldkant(K)                  → bool   den nuvarande klubben har vunnit Superligan (§10.1)
// ============================================================================

import * as C from "./md-config.js";
import { lasRekord, rekordText } from "./md-rekord.js";
import { lagnamnOk, nyLiga, nyTrupp } from "./md-sasong.js";
import { STANDARD_LAGNAMN, TROJFARGER } from "./md-namn.js";

/** Pokalskåpets fem sorter (§10.4), i skåpets ordning. */
export const POKAL_SORTER = [
  { id: "liga", namn: "Divisionsvinst" },
  { id: "kval", namn: "Uppflyttning genom kval" },
  { id: "cup", namn: C.CUP.namn },
  { id: "superliga", namn: "Superligan" },
  { id: "mastarcup", namn: C.MASTARCUP.namn },
];
const SORT_IDS = POKAL_SORTER.map((s) => s.id);
/** Samma uttryck som i firestore.rules (mdLegendOk) – testat i test/matchdagen-mastarcup.test.js. */
export const HISTORIK_MONSTER = "[^|/<>&\"]{1,24}[|]#[0-9a-fA-F]{6}[|][0-9]{1,5}-[0-9]{1,5}[|][0-9]{1,4}([.][0-9]{1,4}){4}";

/**
 * Sorten för en pokal. Före Etapp 3 var Superligans ligavinst en "liga"-pokal ("Vinnare
 * Superligan") – den räknas som Superligan i skåpet.
 */
export function pokalSort(p) {
  const typ = p?.typ;
  if (typ === "liga" && /Superligan/.test(String(p?.namn ?? ""))) return "superliga";
  return SORT_IDS.includes(typ) ? typ : null;
}

const tal = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);

/** Skåpet: en hylla per sort med antal och säsonger (äldst först). */
export function skapet(pokaler) {
  const lista = Array.isArray(pokaler) ? pokaler : [];
  return POKAL_SORTER.map(({ id, namn }) => {
    const sasonger = lista.filter((p) => pokalSort(p) === id).map((p) => tal(p.sasong)).sort((a, b) => a - b);
    return { id, namn, antal: sasonger.length, sasonger };
  });
}

/** Klubbhistorikens rader som objekt – trasiga rader hoppas över (dokumentet skrivs av eleven). */
export function historikRader(lista) {
  return (Array.isArray(lista) ? lista : []).map((rad) => {
    const [namn, farg, sp, p] = String(rad ?? "").split("|");
    const [fran, till] = String(sp ?? "").split("-").map(tal);
    const antal = String(p ?? "").split(".").map(tal);
    if (!namn || !/^#[0-9a-fA-F]{6}$/.test(String(farg)) || !fran || antal.length !== SORT_IDS.length) return null;
    return { namn, farg, fran, till, sasonger: Math.max(1, till - fran + 1), pokaler: Object.fromEntries(SORT_IDS.map((id, i) => [id, antal[i]])) };
  }).filter(Boolean);
}

/** Första säsongen för den nuvarande klubben: efter den senaste gamla klubben, annars 1. */
export function klubbStart(K) {
  const h = historikRader(K?.klubbhistorik);
  return h.length ? Math.max(...h.map((x) => x.till)) + 1 : 1;
}

/** Guldkanten på klubbmärket (§10.1): den nuvarande klubben har vunnit Superligan. */
export function guldkant(K) {
  const fran = klubbStart(K);
  return (Array.isArray(K?.pokaler) ? K.pokaler : []).some((p) => pokalSort(p) === "superliga" && tal(p.sasong) >= fran);
}

/** Erbjudandet (§10.3): Mästarcupen vunnen den här säsongen, i Superligan, och plats kvar i historiken. */
export function legendErbjudande(K) {
  if (!K || Number(K.div) !== C.TOPP_DIV) return false;
  if ((Array.isArray(K.klubbhistorik) ? K.klubbhistorik.length : 0) >= C.LEGEND.max) return false;
  return (Array.isArray(K.pokaler) ? K.pokaler : []).some((p) => p?.typ === "mastarcup" && tal(p.sasong) === tal(K.sasong));
}

const RAD_TECKEN = /[|/<>&"]/g;

/** Den gamla klubbens rad i klubbhistoriken. */
export function historikRad(K) {
  const fran = klubbStart(K);
  const till = Math.max(fran, tal(K.sasong));
  const antal = Object.fromEntries(SORT_IDS.map((id) => [id, 0]));
  for (const p of Array.isArray(K.pokaler) ? K.pokaler : []) {
    const s = pokalSort(p);
    if (s && tal(p.sasong) >= fran && tal(p.sasong) <= till) antal[s]++;
  }
  const namn = String(K.klubb?.namn ?? "").replace(RAD_TECKEN, "").trim().slice(0, C.LAGNAMN_MAX) || STANDARD_LAGNAMN;
  const farg = /^#[0-9a-fA-F]{6}$/.test(String(K.klubb?.farg)) ? K.klubb.farg : TROJFARGER[0];
  return `${namn}|${farg}|${fran}-${till}|${SORT_IDS.map((id) => Math.min(9999, antal[id])).join(".")}`;
}

/**
 * Rekorden följer med (§10.3). Den löpande säsongen börjar om, och sviterna (utan förlust,
 * ligatitlar i rad) hör till den gamla klubben – den nya klubbens svit annonseras när den
 * slår rekordet.
 */
function legendRekord(text, sasong) {
  if (text == null) return undefined;
  const R = lasRekord(text, sasong);
  R.nu = { s: sasong, mal: 0, fragor: 0, ratt: 0, matcher: 0, svit: 0, lt: 0, svBas: R.sv?.v || 0 };
  return rekordText(R);
}

const kopia = (v) => JSON.parse(JSON.stringify(v));

/** Den nya klubben (§10.3). Ändrar inte K0. Kastar om erbjudandet inte gäller. */
export function nyLegendklubb(K0, { namn, farg, rng }) {
  if (!legendErbjudande(K0)) throw new Error("nyLegendklubb: Mästarcupen är inte vunnen den här säsongen");
  const K = kopia(K0);
  const klubbFarg = TROJFARGER.includes(farg) ? farg : TROJFARGER[0];
  const sasong = tal(K0.sasong) + 1;
  K.klubbhistorik = [...(Array.isArray(K0.klubbhistorik) ? K0.klubbhistorik : []), historikRad(K0)];
  K.klubb = { namn: lagnamnOk(namn) || STANDARD_LAGNAMN, farg: klubbFarg, legendStjarnor: tal(K0.klubb?.legendStjarnor) + 1 };
  K.div = 0;
  K.sasong = sasong;
  K.kassa = C.KASSA.start;
  K.trupp = nyTrupp(rng);
  K.reserver = [];
  K.marknad = [];
  K.liga = nyLiga(0, klubbFarg, rng);
  K.kval = null;
  K.mastarcup = null;
  const rekord = legendRekord(K0.rekord, sasong);
  if (rekord !== undefined) K.rekord = rekord;
  return K;
}
