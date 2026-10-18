// ============================================================================
// Prov (#747, spec §12): den fördjupade statistiken – ren logik, ingen
// Firebase eller DOM (testas i test/prov-statistik-fordjupad.test.js). Bygger
// på klassOversikt (#742, prov-statistik.js) – samma regler: bara BEDÖMDA
// frågor räknas, ett förslag är inte bedömt.
//
//   perFragaStaplar(m, fragor)   staplarna per fråga: antal rätt/delvis/fel/
//                                obesvarade/ej rättade, svårast först
//   poangFordelning(rader, g)    diagrammet över totalen: tio staplar à 10 %
//   nivaFordelning(rader)        EG/G/MG/ingen nivå
//   jamforKlasser(nu, andra)     samma prov i flera klasser sida vid sida
//   resultatCsv(o)               klassens resultat som CSV (semikolon, BOM)
//   csvFilnamn(prov, klass)      "Vikingatiden – 4B.csv" utan otillåtna tecken
// Avsnitt (#765): staplarna bär avsnittets namn, jämförelsen grupperar
// frågorna per avsnitt med avsnittets snitt, CSV:n får en kolumn per avsnitt.
// ============================================================================

import { NIVAER, fragaNummer, poangAvsnitt } from "./prov-modell.js";
import { arBedomd, bedomning, ELEV_STATUS_NAMN, rattFragor } from "./prov-rattning-logik.js";
import { CELL, FARG_INFO, fargFor, granserFor, klassOversikt } from "./prov-statistik.js";
import { arOmprov } from "./prov-anpassningar.js";
import { poangP, poangTal } from "./prov-poang.js";

/** Kort text för en etikett: första raden, högst n tecken (kodpunkter). */
export function kortText(s, n = 60) {
  const rad = String(s ?? "").split(/\r?\n/).map((x) => x.trim()).find(Boolean) || "";
  const tecken = Array.from(rad);
  return tecken.length > n ? `${tecken.slice(0, n - 1).join("").trimEnd()}…` : rad;
}

/**
 * Staplarna per fråga (§12 "Per fråga"): hur många elever som fick rätt,
 * delvis, fel – och hur många som inte svarat eller inte rättats än.
 * Svårast först: lägst andel (av poängen, som i översikten) överst; frågor
 * utan något bedömt sist, i nummerordning.
 * @param {ReturnType<typeof klassOversikt>} m
 * @param {object[]} fragor  tillfällets frågor (för frågetexten)
 * @returns {{ fid, nr, text, avsnitt, andel, farg, bedomda, totalt, n: { ratt, delvis, fel, obesvarad, ej } }[]}
 *   avsnitt = avsnittets namn (#765), null när provet saknar avsnitt
 */
export function perFragaStaplar(m, fragor) {
  const text = new Map((fragor || []).map((f) => [f.id, kortText(f.fraga)]));
  const avsnitt = new Map(poangAvsnitt(fragor).flatMap((a) => a.fragor.map((f) => [f.id, a.titel])));
  const lista = m.fragaSumma.map((s, i) => {
    const n = { ratt: 0, delvis: 0, fel: 0, obesvarad: 0, ej: 0 };
    for (const rad of m.rader) n[rad.celler[i]?.lage || CELL.EJ]++;
    return { fid: s.fid, nr: s.nr, text: text.get(s.fid) || "", avsnitt: avsnitt.get(s.fid) ?? null, andel: s.andel, farg: s.farg, bedomda: s.bedomda, totalt: m.rader.length, n };
  });
  return lista.sort((a, b) => (a.andel == null) - (b.andel == null) || (a.andel ?? 0) - (b.andel ?? 0) || a.nr - b.nr);
}

/**
 * Fördelningen av totalen (§12 "Fördelning"): tio staplar, 0–9 %, 10–19 % …
 * 90–100 %. Stapelns färg är färgen för dess lägsta procent (med provets
 * gränser). Elever utan något bedömt räknas i `ej`.
 * @param {{ andel: number|null, poang?: number, max?: number }[]} rader
 * @returns {{ staplar: { fran, till, antal, farg, text }[], ej: number, flest: number }}
 */
export function poangFordelning(rader, granser) {
  const staplar = Array.from({ length: 10 }, (_, i) => {
    const fran = i * 10;
    const till = i === 9 ? 100 : fran + 9;
    return { fran, till, antal: 0, farg: fargFor(fran / 100, granser), text: `${fran}–${till} %` };
  });
  let ej = 0;
  for (const r of rader) {
    if (r.andel == null || !Number.isFinite(r.andel)) { ej++; continue; }
    const pct = Math.round(r.andel * 100000) / 1000; // som fargFor: bort med flyttalsbrus
    staplar[Math.min(9, Math.max(0, Math.floor(pct / 10)))].antal++;
  }
  return { staplar, ej, flest: Math.max(0, ...staplar.map((s) => s.antal)) };
}

/** Nivåerna läraren satt: [{ id, namn, antal }] + "Ingen nivå". */
export function nivaFordelning(rader) {
  const ut = NIVAER.map((n) => ({ id: n.id, namn: n.namn, antal: 0 }));
  let ingen = 0;
  for (const r of rader) {
    const p = ut.find((n) => n.id === r.niva);
    if (p) p.antal++;
    else ingen++;
  }
  return [...ut, { id: "", namn: "Ingen nivå", antal: ingen }];
}

/**
 * En klass i jämförelsen: översikten ur dess rättningar (eleverna = de som
 * har en rättning). Gränserna är DET HÄR provets, så färgerna går att jämföra.
 */
function klassKolumn({ tf, klassNamn, rattningar, med }, granser) {
  const uids = med || Object.keys(rattningar || {});
  const m = klassOversikt({
    fragor: tf.fragor || [], med: uids, svarAv: () => undefined, rattningar: rattningar || {},
    installningar: { ...(tf.installningar || {}), granser },
  });
  return {
    // Omprovet (#748) heter "4A – omprov" (#749 F2), inte "4A (2)".
    t: tf.id, klassNamn: `${klassNamn || tf.classId || ""}${arOmprov(tf) ? " – omprov" : ""}`, antal: uids.length,
    rattade: m.rader.filter((r) => r.andel != null).length,
    snitt: m.snitt, farg: fargFor(m.snitt, granser), fordelning: m.raknare,
    perFraga: new Map(m.fragaSumma.map((s) => [s.fid, s.andel])),
    perAvsnitt: m.avsnitt,
  };
}

/**
 * Samma prov i flera klasser (§12 "Jämförelse"). Den här klassen först, de
 * andra i namnordning. Frågorna är DET HÄR tillfällets; en fråga som saknas
 * i en annan klass (provet ändrat mellan öppningarna) blir null där.
 * @param {{ tf, klassNamn, rattningar, med }} nu
 * @param {{ tf, klassNamn, rattningar }[]} andra
 */
export function jamforKlasser(nu, andra = []) {
  const granser = nu.granser || granserFor(nu.tf.installningar);
  const ovriga = andra.filter((a) => a?.tf && a.tf.id !== nu.tf.id)
    .map((a) => klassKolumn(a, granser))
    .sort((a, b) => a.klassNamn.localeCompare(b.klassNamn, "sv", { numeric: true }));
  const kolumner = [klassKolumn(nu, granser), ...ovriga];
  // Samma klass två gånger (provet kört igen): skilj dem åt med en siffra.
  const sett = new Map();
  for (const k of kolumner) {
    const n = (sett.get(k.klassNamn) || 0) + 1;
    sett.set(k.klassNamn, n);
    if (n > 1) k.klassNamn = `${k.klassNamn} (${n})`;
  }
  const nr = fragaNummer(nu.tf.fragor || []);
  const perFraga = rattFragor(nu.tf.fragor).map((f) => ({
    fid: f.id, nr: nr[f.id], text: kortText(f.fraga),
    andelar: kolumner.map((k) => (k.perFraga.has(f.id) ? k.perFraga.get(f.id) : null)),
  }));
  // Avsnitten (#765): DET HÄR tillfällets; en annan klass andel för samma avsnitt (samma id), annars null.
  const avsnitt = poangAvsnitt(nu.tf.fragor).map((a) => ({
    id: a.id, titel: a.titel, fids: a.fragor.map((f) => f.id),
    andelar: kolumner.map((k) => k.perAvsnitt.find((x) => x.id === a.id && x.titel === a.titel)?.andel ?? null),
  }));
  return { kolumner: kolumner.map(({ perFraga: _, perAvsnitt: _a, ...k }) => k), perFraga, avsnitt, granser };
}

// --- CSV -----------------------------------------------------------------------

const SEP = ";";

/**
 * Ett fält: citeras om det innehåller semikolon, citattecken, radbrytning
 * eller börjar/slutar med blanksteg. Text som börjar med = + - @ (formler
 * i kalkylprogram) får en apostrof först.
 */
export function csvFalt(v) {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Klassens resultat som CSV (§12 "Export"): en rad per elev (A–Ö), poängen
 * per fråga (utan poäng: rätt/delvis/fel), totalen av de bedömda frågorna,
 * procent, färg, nivå och status. Orättade frågor lämnas tomma. Semikolon
 * och decimalkomma som svenska Excel vill ha, BOM först (åäö), CRLF.
 * @param {object} o
 * @param {object[]} o.fragor
 * @param {string[]} o.med
 * @param {Record<string,string>} o.namn  uid → elevens riktiga namn
 * @param {Record<string, object>} o.rattningar
 * @param {object} [o.installningar]
 */
export function resultatCsv({ fragor, med, namn = {}, rattningar, installningar }) {
  const m = klassOversikt({ fragor, med, namn, svarAv: () => undefined, rattningar, installningar });
  const rf = rattFragor(fragor);
  const p = m.poangsatt;
  // En kolumn per avsnitt efter frågorna (#765): poängen (utan poäng: procent) av de bedömda frågorna.
  const avsnittCell = (a) => (a.andel == null ? "" : p && a.max ? poangTal(a.poang) : String(Math.round(a.andel * 100)));
  const huvud = [
    "Elev",
    ...rf.map((f, i) => (p ? `Fråga ${i + 1} (${poangP(f.poang ?? 0)})` : `Fråga ${i + 1}`)),
    ...m.avsnitt.map((a) => (p ? `${a.titel} (${poangP(a.maxAvsnitt)})` : `${a.titel} (%)`)),
    ...(p ? ["Poäng", "Av (rättade)"] : []), "Procent", "Färg", "Nivå", "Status",
  ];
  const rader = m.rader.slice().sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
  const kropp = rader.map((rad) => {
    const r = rattningar[rad.id] || null;
    const celler = rf.map((f) => {
      const post = r?.fragor?.[f.id];
      if (!arBedomd(post)) return "";
      if (p) return poangTal(post.poang);
      return { ratt: "rätt", delvis: "delvis", fel: "fel" }[bedomning(post.ratt)?.id] || "";
    });
    const harTotal = rad.andel != null;
    return [
      rad.namn, ...celler, ...rad.avsnitt.map(avsnittCell),
      ...(p ? [harTotal ? poangTal(rad.poang) : "", harTotal ? poangTal(rad.max) : ""] : []),
      harTotal ? String(Math.round(rad.andel * 100)) : "",
      rad.farg ? FARG_INFO[rad.farg].namn : "",
      rad.niva || "",
      ELEV_STATUS_NAMN[rad.status] || "",
    ];
  });
  return `﻿${[huvud, ...kropp].map((rad) => rad.map(csvFalt).join(SEP)).join("\r\n")}\r\n`;
}

/** Ett filnamn som alla system klarar: "Vikingatiden – 4B.csv". */
export function csvFilnamn(provNamn, klassNamn) {
  const s = [provNamn || "Prov", klassNamn].filter(Boolean).join(" – ").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return `${Array.from(s).slice(0, 80).join("").trim() || "Prov"}.csv`;
}
