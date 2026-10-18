// ============================================================================
// Schack på SERVERN – partiet (functions/schack-parti.js, #779; spec §6–§7.3)
// ----------------------------------------------------------------------------
// Servern avgör ALLT: tur, laglighet (chess.js via schack/schack-server-parti.js),
// FEN, draglistan, klockan med serverns tid och partiets slut. Varje anrop är
// EN transaktion på schackPartier/{partiId}; tar partiet slut uppdateras även
// schackKlass/{classId} (partiet bort ur `partier`, `tabell` för båda) i SAMMA
// transaktion (avslutaParti). Avbrutet (lärare, 24 h) rör aldrig tabellen.
//
//   drag        { partiId, from, to, promotion? } → { san, fen, tur, drag, klocka, slut }
//               tid slut hos den som drar → partiet slutar "tid" i stället (gjort: false)
//   geUpp       { partiId } → { slut }                     orsak "gav-upp"
//   remi        { partiId, handling: "erbjud"|"acceptera"|"neka" } → { remiErbjudenAv, slut }
//   kravaVinst  { partiId } → { slut }                     §7.3: motståndarens tid slut
//               (klocka) eller inget drag på 5 min (utan klocka); orsak "tid"/"lamnade"
//   Ett parti utan drag på 24 h avbryts i stället (status slut, orsak "avbrutet",
//   ingen tabell) och anropet nekas med failed-precondition – 24 h-valet i SCHACK.md.
// ============================================================================

import {
  SchackFel, KLASS_COLL, PARTI_COLL, ctx, idEller, klassData, hamtaKlassForElev,
} from "./schack-state.js";
import {
  arGammalt, harLamnat, klockaEfterDrag, klockaNu, tidSlut, uppdateraTabell,
} from "./schack/schack-server-delat.js";
import { provaDrag } from "./schack/schack-server-parti.js";

export { SchackFel };

const motstandareTill = (parti, uid) => (parti.vit === uid ? parti.svart : parti.vit);
const fargFor = (parti, uid) => (parti.vit === uid ? "w" : "b");
const paTur = (parti) => (parti.tur === "w" ? parti.vit : parti.svart);
const vinstFor = (farg) => (farg === "w" ? "1-0" : "0-1");

/**
 * Avsluta partiet i en pågående transaktion: partidokumentet får status/
 * resultat/orsak, klassdokumentet tappar posten i `partier` och – utom vid
 * "avbrutet" – får nya tabellrader för båda. Klassdokumentet MÅSTE vara läst
 * med tx.get innan (Firestore: alla läsningar före skrivningarna).
 */
export function avslutaParti(tx, { partiRef, parti, klassRef, klass, resultat, orsak, nu }) {
  const klockaKvar = parti.klocka ? { ...parti.klocka, ...klockaFrys(parti, nu) } : null;
  tx.update(partiRef, { status: "slut", resultat, orsak, remiErbjudenAv: null, klocka: klockaKvar, uppdaterad: nu });
  const partier = { ...klass.partier };
  delete partier[partiRef.id];
  const tabell = orsak === "avbrutet"
    ? klass.tabell
    : { ...klass.tabell, ...uppdateraTabell(klass.tabell, { vit: parti.vit, svart: parti.svart, resultat }) };
  tx.set(klassRef, { ...klass, partier, tabell });
  return { resultat, orsak };
}

/** Klockan som den stod när partiet tog slut (den på tur har förbrukat tiden fram till nu). */
function klockaFrys(parti, nu) {
  const k = klockaNu(parti.klocka, parti.tur, nu);
  return { vitMs: k.vitMs, svartMs: k.svartMs, senastDragAt: nu };
}

/**
 * Transaktionen runt ett partianrop. Läser partiet, elevens grind (klassen) och
 * klassdokumentet, kontrollerar att partiet pågår och att uid spelar i det, och
 * avbryter ett parti utan drag på 24 h. `fn(tx, st)` gör skrivningarna.
 */
async function partiTx(c, uid, data, fn) {
  const partiId = idEller(data?.partiId, "parti-id");
  const partiRef = c.db.collection(PARTI_COLL).doc(partiId);
  const utfall = await c.db.runTransaction(async (tx) => {
    const snap = await tx.get(partiRef);
    if (!snap.exists) throw new SchackFel("not-found", "Partiet finns inte.");
    const parti = snap.data();
    if (parti.vit !== uid && parti.svart !== uid) throw new SchackFel("permission-denied", "Du spelar inte i det partiet.");
    const nu = c.now();
    await hamtaKlassForElev(c.db, uid, parti.classId, nu, (ref) => tx.get(ref));
    if (parti.status !== "pagar") throw new SchackFel("failed-precondition", "Partiet är redan slut.");
    const klassRef = c.db.collection(KLASS_COLL).doc(parti.classId);
    const klass = klassData(await tx.get(klassRef));
    const st = { tx, partiRef, parti, klassRef, klass, nu, uid, farg: fargFor(parti, uid) };
    if (arGammalt(parti.senastDragAt, nu)) {
      avslutaParti(tx, { ...st, resultat: null, orsak: "avbrutet" });
      return { fel: new SchackFel("failed-precondition", "Partiet avbröts – ingen hade dragit på 24 timmar.") };
    }
    return fn(st);
  });
  if (utfall?.fel) throw utfall.fel;
  return utfall;
}

export async function drag(deps, uid, data = {}) {
  const c = ctx(deps);
  return partiTx(c, uid, data, ({ tx, partiRef, parti, klassRef, klass, nu, farg }) => {
    if (paTur(parti) !== uid) throw new SchackFel("failed-precondition", "Det är inte din tur.");
    if (tidSlut(parti.klocka, parti.tur, nu)) {
      // Den som drar har redan fått slut på tid: draget görs inte, partiet slutar på tid.
      const slut = avslutaParti(tx, { partiRef, parti, klassRef, klass, resultat: vinstFor(farg === "w" ? "b" : "w"), orsak: "tid", nu });
      return { gjort: false, slut };
    }
    const r = provaDrag(parti.drag || [], { from: data.from, to: data.to, promotion: data.promotion });
    if (!r) throw new SchackFel("invalid-argument", "Olagligt drag.");
    const klocka = parti.klocka ? klockaEfterDrag(parti.klocka, parti.tur, nu) : null;
    tx.update(partiRef, {
      fen: r.fen, drag: r.drag, tur: r.tur, klocka, remiErbjudenAv: null, senastDragAt: nu, uppdaterad: nu,
    });
    let slut = null;
    if (r.slut) {
      const efter = { ...parti, fen: r.fen, drag: r.drag, tur: r.tur, klocka };
      slut = avslutaParti(tx, { partiRef, parti: efter, klassRef, klass, resultat: r.slut.resultat, orsak: r.slut.orsak, nu });
    }
    return { gjort: true, san: r.san, fen: r.fen, tur: r.tur, drag: r.drag, klocka, slut };
  });
}

export async function geUpp(deps, uid, data = {}) {
  const c = ctx(deps);
  return partiTx(c, uid, data, ({ tx, partiRef, parti, klassRef, klass, nu, farg }) => ({
    slut: avslutaParti(tx, { partiRef, parti, klassRef, klass, resultat: vinstFor(farg === "w" ? "b" : "w"), orsak: "gav-upp", nu }),
  }));
}

const HANDLINGAR = ["erbjud", "acceptera", "neka"];

export async function remi(deps, uid, data = {}) {
  const c = ctx(deps);
  const handling = data.handling;
  if (!HANDLINGAR.includes(handling)) throw new SchackFel("invalid-argument", "Okänd handling.");
  return partiTx(c, uid, data, ({ tx, partiRef, parti, klassRef, klass, nu }) => {
    const motst = motstandareTill(parti, uid);
    const erbjudenAvMotst = parti.remiErbjudenAv === motst;
    if (handling === "erbjud" && !erbjudenAvMotst) {
      tx.update(partiRef, { remiErbjudenAv: uid, uppdaterad: nu });
      return { remiErbjudenAv: uid, slut: null };
    }
    if (!erbjudenAvMotst) throw new SchackFel("failed-precondition", "Det finns inget remierbjudande att svara på.");
    if (handling === "neka") {
      tx.update(partiRef, { remiErbjudenAv: null, uppdaterad: nu });
      return { remiErbjudenAv: null, slut: null };
    }
    // acceptera – eller ett eget erbjudande när motståndaren redan erbjudit
    return { remiErbjudenAv: null, slut: avslutaParti(tx, { partiRef, parti, klassRef, klass, resultat: "½-½", orsak: "remi", nu }) };
  });
}

export async function kravaVinst(deps, uid, data = {}) {
  const c = ctx(deps);
  return partiTx(c, uid, data, ({ tx, partiRef, parti, klassRef, klass, nu, farg }) => {
    if (paTur(parti) === uid) throw new SchackFel("failed-precondition", "Det är din tur – du kan inte kräva vinst.");
    let orsak;
    if (parti.klocka) {
      if (!tidSlut(parti.klocka, parti.tur, nu)) throw new SchackFel("failed-precondition", "Motståndarens tid är inte slut.");
      orsak = "tid";
    } else {
      if (!harLamnat(parti.senastDragAt, nu)) throw new SchackFel("failed-precondition", "Motståndaren har inte varit borta i fem minuter.");
      orsak = "lamnade";
    }
    return { slut: avslutaParti(tx, { partiRef, parti, klassRef, klass, resultat: vinstFor(farg), orsak, nu }) };
  });
}
