// ============================================================================
// Prov (#764, spec §6.0): "Rätta alla automatiska frågor" – vad som är SÄKERT
// att rätta automatiskt och vad som lämnas åt läraren, för alla elever på en
// gång. Ren logik, ingen Firebase/DOM (testas i test/prov-ratta-alla.test.js);
// rättningsvyn (prov-ratta-lager.js) kör den och sparar EN skrivning per elev.
//
//   autoBedom(fraga, svar, facit, opt)        → { lage: "saker"|"osaker"|"fritext", post }
//   rattaAllaElev(r, fragor, svar, facit, opt) → { r, andrad, rattade, osakra, fritext }
//   rattaAlla({ med, rattningar, … })         → sammanställningen (rättningarna byts ut)
//   sammanfattning(res, fragor)               → raderna "312 svar rättades automatiskt." …
//   facitMedTillagg(fraga, facit, text, lucka) → facit i efterhand ("Godkänn även 'Björkö'")
//   delaIBatchar(lista, max)                  → skrivningarna i batchar (≤ 500)
//
// Säkert (rättas, auto: true + autoRattad: true – räknas som bedömt):
//   flerval, flera rätt, sant/falskt, para och ordna (delpoäng NEDÅT till 0,5,
//   prov-poang.js), obesvarade frågor (fel), kortsvar/luckor som stämmer EXAKT
//   med facit efter normaliseringen – och, med "Fel svar på kortsvar rättas
//   som fel" (felKortsvarFel, standard på), svar som inte stämmer alls.
// Osäkert (lämnas åt läraren, förblir ett förslag – eller inget alls):
//   nästan rätt (ett stavfel när exakt stavning inte krävs – med stavfel
//   "sjalv", #759, får det inget förslag alls; med "auto" står halva poängen
//   kvar som förslag), och med felKortsvarFel av: svar som inte stämmer.
// Fritext rörs aldrig. Lärarens egna bedömningar (auto !== true) skrivs aldrig
// över; autorättade får räknas om (t.ex. efter ett tillägg i facit).
// ============================================================================

import { arFraga, fragetyp } from "./prov-fragetyper.js";
import { fragaNummer } from "./prov-modell.js";
import { matchaText, normSvar } from "./prov-rattning.js";
import { arManuell, rattFragor, summera } from "./prov-rattning-logik.js";
import { felKortsvarFelFor, stavfelFor } from "./prov-validera.js";
import { GRANS, klipp } from "./typer/delat.js";

export const LAGE = Object.freeze({ SAKER: "saker", OSAKER: "osaker", FRITEXT: "fritext" });

// Högst så här många rättningar per batch (+ räkneverket på tillfället) – under
// Firestores 500 skrivningar per batch.
export const RATTNING_PER_BATCH = 450;
// Godkända svar i en lista efter tillägg i efterhand (editorn tillåter 20).
export const FACIT_LISTA_MAX = 30;

const besvarad = (s) => typeof s === "string" && s.trim() !== "";
const saker = (r) => ({ lage: LAGE.SAKER, post: { poang: r.poang, ratt: r.ratt, auto: true, autoRattad: true } });
const osaker = (r) => ({ lage: LAGE.OSAKER, post: r ? { poang: r.poang, ratt: r.ratt, auto: true } : null });

/** Provets val för rätta-alla: { stavfel, felKortsvarFel } ur tillfällets inställningar. */
export const rattaAllaVal = (installningar) => ({
  stavfel: stavfelFor(installningar), felKortsvarFel: felKortsvarFelFor(installningar),
});

/**
 * Bedöm en fråga hos en elev automatiskt.
 * @param {object} fraga  tillfällets fråga
 * @param {any} svar      elevens svar på frågan
 * @param {any} fa        privat/facit.facit[fraga.id]
 * @param {{ stavfel?: "auto"|"sjalv", felKortsvarFel?: boolean }} [opt]
 * @returns {{ lage: string, post: object|null }} post i rattning.fragor-form (null = ingen post)
 */
export function autoBedom(fraga, svar, fa, { stavfel = "auto", felKortsvarFel = true } = {}) {
  const typ = fragetyp(fraga.typ);
  if (!typ || !arFraga(fraga) || !typ.autoratt) return { lage: LAGE.FRITEXT, post: null };
  if (fa === undefined || fa === null) return osaker(null);
  const forslag = () => typ.forslag(svar ?? typ.tomtSvar(fraga), fa, fraga, { stavfel });
  if (!typ.arBesvarad(svar, fraga)) return saker({ poang: 0, ratt: false });
  if (fraga.typ === "kortsvar") {
    const m = matchaText(svar, fa.godkanda, fa);
    if (m === true) return saker(forslag());
    if (m === "delvis") return osaker(forslag());
    return felKortsvarFel ? saker({ poang: 0, ratt: false }) : osaker(forslag());
  }
  if (fraga.typ === "lucktext") {
    const lista = Array.isArray(svar) ? svar : [];
    const res = typ.luckResultat(lista, fa);
    if (res.includes("delvis")) return osaker(forslag());
    // En tom lucka är säkert fel; ett ifyllt svar som inte stämmer är det bara med felKortsvarFel.
    if (!felKortsvarFel && res.some((m, i) => m === false && besvarad(lista[i]))) return osaker(forslag());
    return saker(forslag());
  }
  const r = forslag();
  return r ? saker(r) : osaker(null);
}

const lika = (a, b) => (a?.ratt ?? null) === (b?.ratt ?? null) && (a?.poang ?? null) === (b?.poang ?? null) &&
  (a?.auto ?? null) === (b?.auto ?? null) && (a?.autoRattad === true) === (b?.autoRattad === true) &&
  (a?.kommentar || "") === (b?.kommentar || "");

/**
 * Rätta alla automatiska frågor hos en elev. Rör aldrig fritext eller lärarens
 * bedömningar; lärarens kommentar på ett förslag följer med.
 * @returns {{ r: object, andrad: boolean, rattade: string[], osakra: string[], fritext: string[] }}
 *   rattade = frågorna som fick en ny (eller ändrad) automatisk rättning,
 *   osakra = frågorna som väntar på läraren, fritext = fritext som inte bedömts
 */
export function rattaAllaElev(r, fragor, svar, facit, opt = {}) {
  const ut = { r, andrad: false, rattade: [], osakra: [], fritext: [] };
  if (!r || r.aterlamnad === true) return ut;
  const fr = { ...(r.fragor || {}) };
  for (const f of rattFragor(fragor)) {
    const fore = fr[f.id];
    if (arManuell(fore)) continue;
    const b = autoBedom(f, svar?.[f.id], facit?.[f.id], opt);
    if (b.lage === LAGE.FRITEXT) {
      ut.fritext.push(f.id);
      continue;
    }
    let ny = b.post ? { ...b.post } : null;
    if (fore?.kommentar) ny = { ...(ny || { auto: true }), kommentar: fore.kommentar };
    if (b.lage === LAGE.OSAKER) ut.osakra.push(f.id);
    if (lika(fore, ny)) continue;
    if (ny) fr[f.id] = ny;
    else delete fr[f.id];
    ut.andrad = true;
    if (b.lage === LAGE.SAKER) ut.rattade.push(f.id);
  }
  if (ut.andrad) ut.r = summera({ ...r, fragor: fr }, fragor);
  return ut;
}

/**
 * Rätta alla automatiska frågor för alla elever (§6.0). Byter ut rättningarna
 * i `rattningar` (som bedomGrupp); tillbakalämnade prov rörs inte.
 * @param {object} o
 * @param {string[]} o.med  eleverna som rättas
 * @param {Record<string, object>} o.rattningar
 * @param {object[]} o.fragor
 * @param {(uid: string) => object|undefined} o.svarAv  elevens svar-map
 * @param {Record<string, any>} o.facit
 * @param {{ stavfel?, felKortsvarFel? }} [o.opt]
 * @returns {{ andrade: string[], rattade: number, osakra: number, fritext: number,
 *   osakraPer: Record<string, number>, fritextPer: Record<string, number>, tillbaka: number }}
 */
export function rattaAlla({ med, rattningar, fragor, svarAv, facit, opt = {} }) {
  const res = { andrade: [], rattade: 0, osakra: 0, fritext: 0, osakraPer: {}, fritextPer: {}, tillbaka: 0 };
  for (const uid of med) {
    const r = rattningar[uid];
    if (!r) continue;
    if (r.aterlamnad === true) {
      res.tillbaka++;
      continue;
    }
    const e = rattaAllaElev(r, fragor, svarAv(uid), facit, opt);
    if (e.andrad) {
      rattningar[uid] = e.r;
      res.andrade.push(uid);
    }
    res.rattade += e.rattade.length;
    res.osakra += e.osakra.length;
    res.fritext += e.fritext.length;
    for (const fid of e.osakra) res.osakraPer[fid] = (res.osakraPer[fid] || 0) + 1;
    for (const fid of e.fritext) res.fritextPer[fid] = (res.fritextPer[fid] || 0) + 1;
  }
  return res;
}

// "kortsvar" / "lucktexter" / "kortsvar och lucktexter" efter vilka frågor som väntar.
function osakraNamn(fids, fragor) {
  const typer = new Set(fids.map((fid) => fragor.find((f) => f.id === fid)?.typ));
  if (typer.size === 1 && typer.has("lucktext")) return "lucktexter";
  return typer.has("lucktext") ? "kortsvar och lucktexter" : "kortsvar";
}

/**
 * Sammanfattningen efter en körning (§6.0).
 * @returns {{ text: string, fid?: string, fragor?: { fid: string, nr: number, antal: number }[] }[]}
 *   fid = första frågan att länka till, fragor = alla frågor med antal (i provets ordning)
 */
export function sammanfattning(res, fragor) {
  const nr = fragaNummer(fragor);
  const lista = (per) => rattFragor(fragor).filter((f) => per[f.id]).map((f) => ({ fid: f.id, nr: nr[f.id], antal: per[f.id] }));
  const rader = [{ text: res.rattade ? `${res.rattade} svar rättades automatiskt.` : "Inga nya svar att rätta automatiskt." }];
  if (res.osakra) {
    const fr = lista(res.osakraPer);
    rader.push({ text: `${res.osakra} ${osakraNamn(fr.map((x) => x.fid), fragor)} behöver din bedömning.`, fid: fr[0]?.fid, fragor: fr });
  }
  if (res.fritext) {
    const fr = lista(res.fritextPer);
    rader.push({ text: `${res.fritext} fritextsvar väntar på rättning.`, fid: fr[0]?.fid, fragor: fr });
  }
  if (res.tillbaka) {
    rader.push({ text: `${res.tillbaka} ${res.tillbaka === 1 ? "tillbakalämnat prov rördes" : "tillbakalämnade prov rördes"} inte.` });
  }
  return rader;
}

/**
 * Facit i efterhand (§6.0): facit för frågan med `text` som ett godkänt svar
 * till – för en lucka (`lucka` = index) i en lucktext. null = inget att lägga
 * till (tomt, redan godkänt efter normaliseringen, listan full eller fel typ).
 */
export function facitMedTillagg(fraga, fa, text, lucka = null) {
  const t = klipp(String(text ?? "").normalize("NFC").replace(/\s+/g, " ").trim(), GRANS.kortsvar);
  if (!t || !fa) return null;
  const opt = { skiftlage: fa.skiftlage === true };
  const lagg = (lista) => {
    const g = Array.isArray(lista) ? lista : [];
    if (g.length >= FACIT_LISTA_MAX || g.some((x) => normSvar(x, opt) === normSvar(t, opt))) return null;
    return [...g, t];
  };
  if (fraga.typ === "kortsvar") {
    const godkanda = lagg(fa.godkanda);
    return godkanda ? { ...fa, godkanda } : null;
  }
  if (fraga.typ === "lucktext" && Number.isInteger(lucka) && fa.luckor?.[lucka]) {
    const godkanda = lagg(fa.luckor[lucka].godkanda);
    return godkanda ? { ...fa, luckor: fa.luckor.map((l, i) => (i === lucka ? { ...l, godkanda } : l)) } : null;
  }
  return null;
}

/**
 * Svar som kan godkännas i efterhand: kortsvaret, eller varje ifylld lucka,
 * som inte redan stämmer exakt med facit. [{ text, lucka }] (lucka null = kortsvar).
 */
export function godkannbara(fraga, svar, fa) {
  if (!fa) return [];
  const exakt = { ...fa, exaktStavning: true };
  if (fraga.typ === "kortsvar") {
    return besvarad(svar) && matchaText(svar, fa.godkanda, exakt) !== true ? [{ text: svar.trim(), lucka: null }] : [];
  }
  if (fraga.typ === "lucktext") {
    const lista = Array.isArray(svar) ? svar : [];
    return (fa.luckor || []).flatMap((l, i) => (besvarad(lista[i]) && matchaText(lista[i], l.godkanda, exakt) !== true
      ? [{ text: lista[i].trim(), lucka: i }] : []));
  }
  return [];
}

/** Dela en lista i batchar om högst `max` (minst en batch, även tom). */
export function delaIBatchar(lista, max = RATTNING_PER_BATCH) {
  const ut = [];
  for (let i = 0; i < Math.max(lista.length, 1); i += max) ut.push(lista.slice(i, i + max));
  return ut;
}
