// ============================================================================
// Schack på SERVERN – pluggmynten (functions/schack-mynt.js, #798)
// ----------------------------------------------------------------------------
// Partier mot datorn, guiden och pusslen körs i klienten – därför betalar BARA
// servern mynt, efter att ha kontrollerat det eleven skickar in (schack-mynt-
// kontroll.js, delad kod i functions/schack/). Belopp: schack-mynt-delat.js.
//
//   datorVinst    { niva, seed, drag: [SAN…] }        → första vinsten per nivå (Damen + pokal)
//   lektionMynt   { nr, losning }                      → 5 per lektion i "Lär dig schack"
//   pusselMynt    { sort: "ett"|"tva", nr, id?, drag: [UCI…] } → 5 per pussel (id = Lichess-id, gäller före nr)
// Alla svarar { mynt, redan, nyckel, pokal? } – `mynt` = utbetalt NU (0 när kvittot
// redan har nyckeln: dubbelanrop, två flikar, en senare vinst).
//
// Kvittot schackMynt/{uid} gör utbetalningen idempotent: EN transaktion läser det,
// och bara om nyckeln saknas skrivs nyckeln + total, studentData.coins += mynt och
// (Damen) studentData.schack.pokaler.damen. Reglerna nekar alla klientskrivningar
// av kvittot och av schack.pokaler.
//
// Grinden: eleven går i en klass med schack påslaget (enabledModules, inte dold)
// och ingen av elevens klasser har ett aktivt fokuslås – samma regel som
// kompis-callables (schack är inte låsbart: varje aktivt lås stänger schacket).
// Kvittot läses FÖRE den dyra kontrollen, så en redan betald nivå kostar ingen motor. Ett NEKAT
// datorparti stämplar kvittot (senastFel) och nästa försök väntar FEL_PAUS_MS (30 s) – en spärr
// mot den som skickar påhittade partier för att hålla motorn igång.
// ============================================================================

import { readFileSync } from "node:fs";
import { SchackFel, ctx } from "./schack-state.js";
import { activeLockMal } from "./schack/schack-server-delat.js";
import { DATOR_MYNT, DATOR_POKAL, LEKTION_MYNT, PUSSEL_MYNT, pusselNyckel, normaliseraKvitto } from "./schack/schack-mynt-delat.js";
import { verifieraDatorParti, verifieraLektion, verifieraPussel } from "./schack/schack-mynt-kontroll.js";

export { SchackFel };
export const KVITTO_COLL = "schackMynt";

const FIL = { ett: "matt-i-ett.json", tva: "matt-i-tva.json" };
const bank = new Map();
/** Pusselbanken (samma JSON som klienten hämtar), läst en gång per instans. */
export function pusselBank(sort) {
  if (!bank.has(sort)) {
    const data = JSON.parse(readFileSync(new URL(`./schack/pussel/${FIL[sort]}`, import.meta.url), "utf8"));
    bank.set(sort, Array.isArray(data?.pussel) ? data.pussel : []);
  }
  return bank.get(sort);
}

/** Elevens grind för mynten (se huvudet). */
export async function grindForMynt(db, uid, nu) {
  const s = await db.collection("classes").where("studentIds", "array-contains", uid).get();
  const klasser = s.docs.map((d) => d.data() || {});
  const pa = klasser.some((k) => Array.isArray(k.enabledModules) && k.enabledModules.includes("schack") &&
    !(Array.isArray(k.hiddenModules) && k.hiddenModules.includes("schack")));
  if (!pa) throw new SchackFel("failed-precondition", "Schack är inte påslaget för din klass.");
  if (klasser.some((k) => activeLockMal(k.lock, nu))) {
    throw new SchackFel("failed-precondition", "Din klass har fokusläge just nu – schacket är stängt.");
  }
}

const KONTROLL_FEL = {
  niva: "Okänd nivå.", seed: "Ogiltigt parti.", drag: "Ogiltig draglista.", olagligt: "Partiet har ett olagligt drag.",
  "ingen-matt": "Partiet slutar inte med att du gör matt.", "inte-slut": "Partiet är inte slut.",
  dator: "Datorns drag stämmer inte med nivån.", tid: "Partiet tog för lång tid att kontrollera.",
  lektion: "Okänd lektion.", losning: "Ogiltig lösning.", "fel-svar": "Lösningen klarar inte övningen.",
};
const nekad = (fel) => new SchackFel("invalid-argument", KONTROLL_FEL[fel] || "Det gick inte att kontrollera.");

/**
 * Betala `mynt` för `grupp.nyckel` om kvittot saknar den – EN transaktion.
 * @returns {Promise<{ mynt, redan, nyckel, pokal }>}
 */
export async function betala(c, uid, grupp, nyckel, mynt, pokal = null) {
  const kvittoRef = c.db.collection(KVITTO_COLL).doc(uid);
  const sdRef = c.db.collection("studentData").doc(uid);
  return c.db.runTransaction(async (tx) => {
    const k = normaliseraKvitto((await tx.get(kvittoRef)).data());
    if (Object.hasOwn(k[grupp], nyckel)) return { mynt: 0, redan: true, nyckel, pokal: false };
    const nu = c.now();
    tx.set(kvittoRef, {
      [grupp]: { [nyckel]: nu }, ...(pokal ? { pokaler: { [pokal]: nu } } : {}),
      total: c.FieldValue.increment(mynt), uppdaterad: nu,
    }, { merge: true });
    tx.set(sdRef, { coins: c.FieldValue.increment(mynt), ...(pokal ? { schack: { pokaler: { [pokal]: nu } } } : {}) }, { merge: true });
    return { mynt, redan: false, nyckel, pokal: Boolean(pokal) };
  });
}

/** Kvittot som det är (läses före den dyra kontrollen). */
async function lasKvitto(c, uid) {
  return (await c.db.collection(KVITTO_COLL).doc(uid).get()).data() || {};
}
const harNyckel = (data, grupp, nyckel) => Object.hasOwn(normaliseraKvitto(data)[grupp], nyckel);

/** Efter ett nekat parti får eleven vänta så här länge – motorn är dyr (ett påhittat parti kan ta 150 s). */
export const FEL_PAUS_MS = 30_000;

export async function datorVinst(deps, uid, data = {}) {
  const c = ctx(deps);
  const niva = typeof data.niva === "string" && Object.hasOwn(DATOR_MYNT, data.niva) ? data.niva : null;
  if (!niva) throw nekad("niva");
  await grindForMynt(c.db, uid, c.now());
  const kv = await lasKvitto(c, uid);
  if (harNyckel(kv, "dator", niva)) return { mynt: 0, redan: true, nyckel: niva, pokal: false };
  if (Number(kv.senastFel) > c.now() - FEL_PAUS_MS) {
    throw new SchackFel("resource-exhausted", "Vänta en halv minut och försök igen.");
  }
  const r = verifieraDatorParti({ niva, seed: data.seed, drag: data.drag }, { krav: "vinst", ...deps.kontroll });
  if (!r.ok) {
    await c.db.collection(KVITTO_COLL).doc(uid).set({ senastFel: c.now() }, { merge: true });
    throw nekad(r.fel);
  }
  return betala(c, uid, "dator", niva, DATOR_MYNT[niva], DATOR_POKAL[niva] || null);
}

export async function lektionMynt(deps, uid, data = {}) {
  const c = ctx(deps);
  const nr = Number.isInteger(data.nr) && data.nr >= 1 && data.nr <= 12 ? data.nr : null;
  if (!nr) throw nekad("lektion");
  await grindForMynt(c.db, uid, c.now());
  const nyckel = String(nr);
  if (harNyckel(await lasKvitto(c, uid), "lektioner", nyckel)) return { mynt: 0, redan: true, nyckel, pokal: false };
  const r = verifieraLektion(nr, data.losning, deps.kontroll);
  if (!r.ok) throw nekad(r.fel);
  return betala(c, uid, "lektioner", nyckel, LEKTION_MYNT);
}

export async function pusselMynt(deps, uid, data = {}) {
  const c = ctx(deps);
  const sort = data.sort === "ett" || data.sort === "tva" ? data.sort : null;
  if (!sort) throw new SchackFel("invalid-argument", "Okänd pusselsort.");
  const lista = pusselBank(sort);
  // Id:t (Lichess) gäller före numret: en klient med en gammal bank i cachen pekar ändå rätt.
  const viaId = typeof data.id === "string" ? lista.find((x) => x.id === data.id) : null;
  const p = viaId || (Number.isInteger(data.nr) && data.nr >= 1 && data.nr <= lista.length ? lista[data.nr - 1] : null);
  if (!p) throw new SchackFel("invalid-argument", "Pusslet finns inte.");
  await grindForMynt(c.db, uid, c.now());
  const nyckel = pusselNyckel(sort, p.id);
  if (harNyckel(await lasKvitto(c, uid), "pussel", nyckel)) return { mynt: 0, redan: true, nyckel, pokal: false };
  if (!verifieraPussel(p, sort, data.drag)) throw new SchackFel("invalid-argument", "Det där löser inte pusslet.");
  return betala(c, uid, "pussel", nyckel, PUSSEL_MYNT);
}
