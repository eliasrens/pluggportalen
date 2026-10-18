// ============================================================================
// Prov (#742, spec §7.5): den enkla statistiken – ren logik, ingen Firebase
// eller DOM (testas i test/prov-statistik.test.js).
//
//   cellLage(post, svar, fraga)     en fråga hos en elev: ratt/delvis/fel/obesvarad/ej
//   andelFor(r, fragor, poangsatt)  elevens andel av de BEDÖMDA frågorna
//   granserFor(installningar)       provets/tillfällets färggränser, annars 60/85 (#759)
//   fargFor(andel, granser)         gron (≥ 85 %) / gul (60–84 %) / rod (< 60 %)
//   klassOversikt({ … })            fliken Översikt: rutnätet, räknaren, snittet,
//                                   de tre svåraste frågorna
//   provInfoDok(r, fragor, tf)      det som sparas i rättningen för statistik-
//                                   fliken "Prov" (datum, gränser, andel)
//   historik(rattningar)            fliken "Prov" i klassens statistik: klassens
//                                   tillfällen + varje elevs prov över tid
//
// Obesvarade och orättade frågor räknas INTE som fel förrän läraren bedömt
// dem: andelen räknas bara över bedömda frågor (ett förslag är inte bedömt).
// Utan poäng räknas andelen rätt, där "delvis" = ½.
// ============================================================================

import { fragetyp } from "./prov-fragetyper.js";
import { STANDARD_INSTALLNINGAR, granserOk } from "./prov-validera.js";

export { granserText } from "./prov-validera.js";
import { arBedomd, bedomning, elevStatus, nivaNamn, rattFragor } from "./prov-rattning-logik.js";
import { fragaNummer } from "./prov-modell.js";
import { tillMs } from "./prov-tillfalle-logik.js";
import { poangTal } from "./prov-poang.js";

/** En cells läge (§7.5 "Per fråga och elev"). */
export const CELL = Object.freeze({ RATT: "ratt", DELVIS: "delvis", FEL: "fel", OBESVARAD: "obesvarad", EJ: "ej" });
export const CELL_INFO = Object.freeze({
  ratt: { ikon: "✓", namn: "Rätt" },
  delvis: { ikon: "½", namn: "Delvis rätt" },
  fel: { ikon: "✗", namn: "Fel" },
  obesvarad: { ikon: "–", namn: "Obesvarad" },
  ej: { ikon: "?", namn: "Inte rättad än" },
});

/** Totalens färger – alltid med symbol och text (färgblinda, utskrift). */
export const FARG = Object.freeze({ GRON: "gron", GUL: "gul", ROD: "rod" });
export const FARG_INFO = Object.freeze({
  gron: { ikon: "✓", emoji: "🟢", namn: "Grön" },
  gul: { ikon: "½", emoji: "🟡", namn: "Gul" },
  rod: { ikon: "✗", emoji: "🔴", namn: "Röd" },
});

/**
 * Gränserna { gul, gron } i procent (#759) – den enda upplösaren, alla vyer
 * (översikten, elevvyn, statistiken, utskriften) går via den här. Kedjan:
 * tillfällets gränser (provets kopia, eller reglaget i Översikten) → provets
 * → standarden 60/85. Ogiltiga eller saknade gränser hoppas över.
 *   granserFor(tf.installningar)                   tillfället (kopian bär provets)
 *   granserFor(tf.installningar, prov.installningar) med provet som reserv
 */
export function granserFor(...installningar) {
  for (const ins of installningar) {
    const g = ins?.granser;
    const tal = { gul: Number(g?.gul), gron: Number(g?.gron) };
    if (granserOk(tal)) return tal;
  }
  return { ...STANDARD_INSTALLNINGAR.granser };
}

/**
 * Färgen för en andel (0–1). null = inget att färga (ingen bedömd fråga).
 * Gränserna gäller hela procent: med 60/85 är 59 % röd, 60 % gul, 84 % gul, 85 % grön.
 */
export function fargFor(andel, granser = STANDARD_INSTALLNINGAR.granser) {
  if (andel == null || !Number.isFinite(andel)) return null;
  const pct = Math.round(andel * 100000) / 1000; // bort med flyttalsbrus (0.7 * 100 = 70.00000000000001)
  if (pct >= granser.gron) return FARG.GRON;
  if (pct >= granser.gul) return FARG.GUL;
  return FARG.ROD;
}

/** "75 %" – avrundat för visning (färgen räknas på den exakta andelen). */
export const procent = (andel) => (andel == null ? "" : `${Math.round(andel * 100)} %`);

/** En fråga hos en elev: bedömd → ratt/delvis/fel, annars obesvarad eller ej rättad. */
export function cellLage(post, svar, fraga) {
  if (arBedomd(post)) return bedomning(post.ratt).id;
  const typ = fragetyp(fraga.typ);
  return typ && !typ.arBesvarad(svar, fraga) ? CELL.OBESVARAD : CELL.EJ;
}

/** En bedömd posts bidrag: { p, m } (poäng av max, eller rätt = 1, delvis = ½). */
function bidrag(post, fraga, poangsatt) {
  if (poangsatt) {
    const p = Number(post.poang);
    return { p: Number.isFinite(p) ? p : 0, m: Number(fraga.poang) || 0 };
  }
  return { p: post.ratt === true ? 1 : post.ratt === "delvis" ? 0.5 : 0, m: 1 };
}

/**
 * Elevens resultat över de bedömda frågorna.
 * @returns {{ andel: number|null, poang: number, max: number, bedomda: number, antal: number }}
 */
export function andelFor(r, fragor, poangsatt) {
  const lista = rattFragor(fragor);
  const bedomda = lista.filter((f) => arBedomd(r?.fragor?.[f.id]));
  // Poängsatt prov där alla bedömda frågor har 0 poäng: räkna rätt i stället.
  const medPoang = poangsatt && bedomda.some((f) => (Number(f.poang) || 0) > 0);
  let p = 0;
  let m = 0;
  for (const f of bedomda) {
    const b = bidrag(r.fragor[f.id], f, medPoang);
    p += b.p;
    m += b.m;
  }
  return { andel: m > 0 ? p / m : null, poang: Math.round(p * 2) / 2, max: m, bedomda: bedomda.length, antal: lista.length };
}

/** Snittet av andelarna (null-andelar räknas inte). */
export function snitt(andelar) {
  const ok = andelar.filter((a) => a != null && Number.isFinite(a));
  return ok.length ? ok.reduce((s, a) => s + a, 0) / ok.length : null;
}

/** Fördelningen { gron, gul, rod, ej } för en lista andelar. */
export function fordelning(andelar, granser) {
  const n = { gron: 0, gul: 0, rod: 0, ej: 0 };
  for (const a of andelar) n[fargFor(a, granser) || "ej"]++;
  return n;
}

/** "🟢 12 · 🟡 7 · 🔴 4 · ej rättade 1" */
export function fordelningText(n) {
  const delar = [`🟢 ${n.gron}`, `🟡 ${n.gul}`, `🔴 ${n.rod}`];
  if (n.ej) delar.push(`ej rättade ${n.ej}`);
  return delar.join(" · ");
}

/**
 * Fliken Översikt (§7.5 "Hela klassen").
 * @param {object} o
 * @param {object[]} o.fragor  tillfällets frågor
 * @param {string[]} o.med  eleverna som lämnat in (raderna)
 * @param {Record<string,string>} o.namn  uid → namn
 * @param {(uid: string, fid: string) => any} o.svarAv
 * @param {Record<string, object>} o.rattningar
 * @param {object} [o.installningar]  tillfällets (poang, granser)
 */
export function klassOversikt({ fragor, med, namn = {}, svarAv, rattningar, installningar }) {
  const rf = rattFragor(fragor);
  const nr = fragaNummer(fragor);
  const poangsatt = installningar?.poang !== false;
  const granser = granserFor(installningar);
  const rader = med.map((uid) => {
    const r = rattningar[uid] || null;
    const res = andelFor(r, fragor, poangsatt);
    return {
      id: uid,
      namn: namn[uid] || uid,
      celler: rf.map((f) => ({ fid: f.id, lage: cellLage(r?.fragor?.[f.id], svarAv(uid, f.id), f) })),
      ...res,
      farg: fargFor(res.andel, granser),
      niva: r?.niva || null,
      nivaNamn: nivaNamn(r?.niva),
      status: elevStatus(r, fragor),
    };
  });
  const fragaSumma = rf.map((f) => {
    let p = 0;
    let m = 0;
    let bedomda = 0;
    for (const uid of med) {
      const post = rattningar[uid]?.fragor?.[f.id];
      if (!arBedomd(post)) continue;
      const b = bidrag(post, f, poangsatt && (Number(f.poang) || 0) > 0);
      p += b.p;
      m += b.m;
      bedomda++;
    }
    const andel = m > 0 ? p / m : null;
    return { fid: f.id, nr: nr[f.id], andel, farg: fargFor(andel, granser), bedomda };
  });
  const svarast = fragaSumma.filter((s) => s.andel != null)
    .sort((a, b) => a.andel - b.andel || a.nr - b.nr).slice(0, 3);
  const andelar = rader.map((r) => r.andel);
  return {
    rader, fragaSumma, svarast, granser, poangsatt,
    raknare: fordelning(andelar, granser),
    snitt: snitt(andelar),
  };
}

/** Sortera raderna: "namn" (A–Ö) eller "resultat" (bäst först, ej rättade sist). */
export function sorteraRader(rader, satt = "namn") {
  const efterNamn = (a, b) => a.namn.localeCompare(b.namn, "sv");
  if (satt !== "resultat") return rader.slice().sort(efterNamn);
  return rader.slice().sort((a, b) => (a.andel == null) - (b.andel == null) || (b.andel ?? 0) - (a.andel ?? 0) || efterNamn(a, b));
}

/** "18/24 · 75 %" (utan poäng: "75 %"); "" om inget är bedömt. */
export function totalText(rad, poangsatt) {
  if (rad.andel == null) return "";
  const p = poangTal;
  return poangsatt && rad.max ? `${p(rad.poang)}/${p(rad.max)} · ${procent(rad.andel)}` : procent(rad.andel);
}

/**
 * Det som sparas i rättningen (fältet provInfo) så att statistikfliken "Prov"
 * klarar sig med EN fråga (§7.5): provets datum, färggränserna och elevens
 * andel av de bedömda frågorna.
 */
export function provInfoDok(r, fragor, tf) {
  const poangsatt = tf?.installningar?.poang !== false;
  return {
    datum: tillMs(tf?.oppnad) ?? tillMs(tf?.skapad) ?? null,
    granser: granserFor(tf?.installningar),
    andel: andelFor(r, fragor, poangsatt).andel,
  };
}

/** En rättnings andel: provInfo.andel, annars (äldre dokument) totalen av max. */
function andelUr(r) {
  const a = r?.provInfo?.andel;
  if (a === null) return null;
  if (Number.isFinite(a)) return a;
  const max = Number(r?.maxPoang);
  return r?.aterlamnad && max > 0 ? Number(r.totalPoang || 0) / max : null;
}

/**
 * Fliken "Prov" i klassens statistik (§7.5 "Över tid"), ur EN collection
 * group-läsning på rattning (where classId == klassen).
 * @param {{ t: string, elevId: string, provNamn?: string, provInfo?: object, niva?: string, aterlamnad?: boolean, aterlamnadAt?: any }[]} lista
 * @returns {{ tillfallen: object[], perElev: Map<string, object[]> }}
 *   tillfallen nyast först: { t, provNamn, datum, granser, snitt, farg, fordelning, antal }
 *   perElev[uid] äldst först: { t, provNamn, datum, andel, farg, niva, nivaNamn, aterlamnad }
 */
export function historik(lista) {
  const perT = new Map();
  const perElev = new Map();
  for (const r of lista || []) {
    if (!r?.t || !r.elevId) continue;
    const granser = granserFor({ granser: r.provInfo?.granser });
    const datum = r.provInfo?.datum ?? tillMs(r.aterlamnadAt) ?? null;
    const andel = andelUr(r);
    const post = {
      t: r.t, provNamn: r.provNamn || "Prov", datum, andel, farg: fargFor(andel, granser),
      niva: r.niva || null, nivaNamn: nivaNamn(r.niva), aterlamnad: r.aterlamnad === true,
    };
    if (!perT.has(r.t)) perT.set(r.t, { t: r.t, provNamn: post.provNamn, datum, granser, andelar: [] });
    const tf = perT.get(r.t);
    tf.andelar.push(andel);
    if (datum != null && (tf.datum == null || datum < tf.datum)) tf.datum = datum;
    if (!perElev.has(r.elevId)) perElev.set(r.elevId, []);
    perElev.get(r.elevId).push(post);
  }
  const tillfallen = [...perT.values()].map(({ andelar, ...tf }) => {
    const s = snitt(andelar);
    return { ...tf, snitt: s, farg: fargFor(s, tf.granser), fordelning: fordelning(andelar, tf.granser), antal: andelar.length };
  }).sort((a, b) => (b.datum ?? 0) - (a.datum ?? 0) || a.provNamn.localeCompare(b.provNamn, "sv"));
  for (const prov of perElev.values()) prov.sort((a, b) => (a.datum ?? 0) - (b.datum ?? 0));
  return { tillfallen, perElev };
}

/**
 * Den lilla linjen (§7.5): punkternas koordinater i en ruta b × h för andelar
 * 0–1 (null hoppas över). → [{ x, y, andel }]
 */
export function linjePunkter(andelar, b = 160, h = 40, kant = 4) {
  const ok = andelar.map((a, i) => ({ a, i })).filter((p) => p.a != null && Number.isFinite(p.a));
  const steg = ok.length > 1 ? (b - 2 * kant) / (ok.length - 1) : 0;
  return ok.map((p, j) => ({
    x: Math.round((ok.length > 1 ? kant + j * steg : b / 2) * 10) / 10,
    y: Math.round((kant + (1 - Math.min(1, Math.max(0, p.a))) * (h - 2 * kant)) * 10) / 10,
    andel: p.a,
  }));
}
