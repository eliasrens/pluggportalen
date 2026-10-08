// ============================================================================
// Klasscentret – gemensam layout: ren logik + skrivplan (#489, epic #475).
// ----------------------------------------------------------------------------
// Ingen Firebase-import (samma mönster som kc-fund-plan.js): beskriver EXAKT
// vad "Spara" och "Återställ" skriver för att firestore.rules ("KLASSCENTRET",
// layout/layoutHistory) ska godta det. Transaktionerna (korSparning,
// korAterstallning) tar SDK:t som argument → kc-layout-data.js kör dem med
// gstatic-SDK:t och regeltesterna (test/firestore-rules-klasscenter-layout
// .test.js) med npm-SDK:t mot emulatorn.
//
// Dokument (DATAMODELL.md "Klasscentret" → "Gemensam layout + historik"):
//   classCenters/{classId}/layout/current
//       { placedItems, version, updatedBy, updatedAt }
//   classCenters/{classId}/layoutHistory/{version % 10}
//       { placedItems, savedBy, savedAt, version }
//   placedItems = { "<itemId>" | "<itemId>#<n>": { x, y, z } }
//       x/y procent av scenen 0–100 (som studentData.room.placements),
//       z heltal KC_Z_MIN..KC_Z_MAX (ritordning, högre = framför).
//
// Ringbuffert: varje sparning (även en återställning) blir version + 1 och
// skriver slot `version % 10` i SAMMA transaktion → de 10 senaste finns
// alltid kvar utan raderingar (version 11 skriver över slot 1 osv.).
//
// Samtidighet (BESLUT: "senaste vinner, med historik"): sparningen läser
// current i en transaktion och skriver version + 1. Sparar två elever
// samtidigt körs den ena om med färska värden → båda landar som två
// versioner i följd (båda i historiken), den senaste syns. placedItems
// ersätts ALLTID i sin helhet (set utan merge) → aldrig en blandad layout.
// Vill UI:t i stället varna ("någon annan sparade – laddar om") skickas
// `forvantadVersion` (versionen som visades): avviker current → kod "krock"
// och ingenting skrivs.
//
// Pokaler (#497): "pokal-<trophyId>" (kc-pokal-typer.js pokalNyckel) är en
// FLYTTAD pokal – högst KC_POKAL_MAX, inte i möbellådan (pokalen tillhör
// klassen). Oflyttade pokaler auto-placeras och sparas aldrig
// (kc-pokal-placering.js).
//
// "#<n>"-nycklar (extra exemplar, n ≥ 2, som rummets makePlacementKey) godtas
// här om lådan har ≥ n exemplar. Crowdfunding ger ett exemplar per föremål,
// och firestore.rules godtar bara katalog-id:n som nycklar – flera exemplar
// kräver alltså en regeländring.
//
// API
//   historikSlot(version)                     → 0..9
//   ladaAntal(lada)                           → Map<id, antal>
//       lada = unlockedItems(funds) (föremål), id-lista eller { id: antal }
//   validatePlacedItems(placedItems, { lada? }) → { ok:true, placedItems } | Fel
//   normaliseraLayout(data)                   → Layout (förlåtande läsning)
//   normaliseraHistorik(docs)                 → HistorikPost[] (nyast först)
//   planSave({ current, placedItems, uid, lada?, forvantadVersion? }) → Plan | Fel
//   planRestore(historySlot, { lada? })       → { ok:true, placedItems, version } | Fel
//   planSaveWrites({ classId, plan, fv })     → Write[] (2) ; Write = { path, data }
//   korSparning(sdk, db, { classId, uid, placedItems, lada?, forvantadVersion?, forsok? })
//   korAterstallning(sdk, db, { classId, uid, slot, historikVersion?, lada?, forvantadVersion?, forsok? })
//       → Promise<Plan & { aterstalldFran? } | Fel>  sdk = { runTransaction, doc,
//         serverTimestamp }; samtidiga sparningar körs om (kc-omforsok.js).
//         Kastar om reglerna nekar: err.krock = false = verkligt nekad,
//         true = försöken tog slut
//   kanInredaFor({ uid, arLarare, studentIds, inredningSparr }) → bool
//
//   Layout = { placedItems, version, updatedBy, updatedAt }
//   Plan = { ok:true, version, slot, placedItems, uid }
//   Fel  = { ok:false, kod, error, nyckel? }  kod: "ogiltig-form" |
//          "for-manga" | "for-manga-pokaler" | "okant-foremal" | "ej-i-ladan" | "ogiltig-position" |
//          "ingen-anvandare" | "krock" | "tom-slot" | "ogiltig-slot" |
//          "historik-andrad" (slotten innehåller inte längre historikVersion)
// ============================================================================

import { kcShopItem } from "./kc-shop-items.js";
import { pokalIdFranNyckel } from "./kc-pokal-typer.js";
import { medKrockOmforsok, sammaSomNekat, SAMMA_LAGE } from "./kc-omforsok.js";
import { kcRoll, rollKanInreda } from "./kc-behorighet.js";

export const KC_HISTORIK = 10;
/** Max antal flyttade pokaler i layouten (reglernas kcPokalerOk). */
export const KC_POKAL_MAX = 8;
/**
 * Max antal placerade poster = alla 8 katalogföremål + KC_POKAL_MAX (även
 * reglernas storleksgräns, en kcPosOk-rad per index – 1000-uttryckstaket).
 */
export const KC_LAYOUT_MAX = 16;
export const KC_Z_MIN = 0;
export const KC_Z_MAX = 999;
/** Försök när en samtidig sparning krockar (se kc-omforsok.js). */
export const KROCK_FORSOK = 8;

const NYCKEL = /^([a-z0-9-]{1,40})(?:#([0-9]{1,3}))?$/;

function fel(kod, error, nyckel) {
  return nyckel === undefined ? { ok: false, kod, error } : { ok: false, kod, error, nyckel };
}

function heltal(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : 0;
}

const klamra = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Ringbuffertens slot för en version (version 10 → 0, 11 → 1). */
export function historikSlot(version) {
  return ((heltal(version) % KC_HISTORIK) + KC_HISTORIK) % KC_HISTORIK;
}

/** Möbellådan som antal per föremål. */
export function ladaAntal(lada) {
  const ut = new Map();
  if (Array.isArray(lada)) {
    for (const it of lada) {
      const id = typeof it === "string" ? it : it && it.id;
      if (id) ut.set(id, (ut.get(id) || 0) + 1);
    }
  } else if (lada && typeof lada === "object") {
    for (const [id, n] of Object.entries(lada)) if (heltal(n) > 0) ut.set(id, heltal(n));
  }
  return ut;
}

/** { x, y, z } → normaliserad position, eller null om formen är fel. */
function position(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const x = Number(p.x);
  const y = Number(p.y);
  const z = p.z === undefined || p.z === null ? 0 : Number(p.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x: klamra(x, 0, 100), y: klamra(y, 0, 100), z: klamra(Math.round(z), KC_Z_MIN, KC_Z_MAX) };
}

/**
 * Validera + normalisera placedItems inför en sparning. Strikt på vad som
 * placeras (okänt/ej upplåst/för många → Fel), förlåtande på positionen
 * (x/y klamras till 0–100, z avrundas/klamras; saknat z = 0).
 * lada utelämnad → bara katalogen kontrolleras (inte möbellådan).
 */
export function validatePlacedItems(placedItems, { lada } = {}) {
  if (!placedItems || typeof placedItems !== "object" || Array.isArray(placedItems)) {
    return fel("ogiltig-form", "Layouten har fel form.");
  }
  const nycklar = Object.keys(placedItems);
  if (nycklar.length > KC_LAYOUT_MAX) {
    return fel("for-manga", `Högst ${KC_LAYOUT_MAX} föremål får stå i rummet.`);
  }
  if (nycklar.filter((k) => pokalIdFranNyckel(k)).length > KC_POKAL_MAX) {
    return fel("for-manga-pokaler", `Högst ${KC_POKAL_MAX} pokaler kan flyttas från hyllan – ställ tillbaka någon.`);
  }
  const antal = lada === undefined ? null : ladaAntal(lada);
  const ut = {};
  for (const nyckel of nycklar.sort()) {
    if (pokalIdFranNyckel(nyckel)) {
      const pos = position(placedItems[nyckel]);
      if (!pos) return fel("ogiltig-position", "Pokalen har en ogiltig plats.", nyckel);
      ut[nyckel] = pos;
      continue;
    }
    const m = NYCKEL.exec(nyckel);
    if (!m || !kcShopItem(m[1])) return fel("okant-foremal", "Föremålet finns inte.", nyckel);
    const exemplar = m[2] === undefined ? 1 : Number(m[2]);
    if (exemplar < 2 && m[2] !== undefined) return fel("okant-foremal", "Föremålet finns inte.", nyckel);
    if (antal && (antal.get(m[1]) || 0) < exemplar) {
      return fel("ej-i-ladan", "Föremålet finns inte i klassens möbellåda.", nyckel);
    }
    const pos = position(placedItems[nyckel]);
    if (!pos) return fel("ogiltig-position", "Föremålet har en ogiltig plats.", nyckel);
    ut[nyckel] = pos;
  }
  return { ok: true, placedItems: ut };
}

/** Förlåtande läsning av ett placedItems-fält: trasiga poster hoppas över. */
function lasPlacerade(pi) {
  const ut = {};
  if (!pi || typeof pi !== "object") return ut;
  for (const [nyckel, p] of Object.entries(pi)) {
    const m = NYCKEL.exec(nyckel);
    const pos = position(p);
    const kand = (m && kcShopItem(m[1])) || pokalIdFranNyckel(nyckel);
    if (kand && pos && Object.keys(ut).length < KC_LAYOUT_MAX) ut[nyckel] = pos;
  }
  return ut;
}

/** layout/current (eller null = ingen sparat än) → fast form, version 0. */
export function normaliseraLayout(data) {
  const d = data && typeof data === "object" ? data : {};
  return {
    placedItems: lasPlacerade(d.placedItems),
    version: Math.max(0, heltal(d.version)),
    updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : null,
    updatedAt: d.updatedAt || null,
  };
}

/**
 * layoutHistory-dokument → poster nyast först.
 * docs = [{ id, data }] (eller Firestore-snapshots med .id/.data()).
 */
export function normaliseraHistorik(docs = []) {
  const ut = [];
  for (const d of docs) {
    const data = (typeof d.data === "function" ? d.data() : d.data) || {};
    const slot = Number(d.id);
    if (!Number.isInteger(slot) || slot < 0 || slot >= KC_HISTORIK) continue;
    ut.push({
      slot,
      version: Math.max(0, heltal(data.version)),
      placedItems: lasPlacerade(data.placedItems),
      savedBy: typeof data.savedBy === "string" ? data.savedBy : null,
      savedAt: data.savedAt || null,
    });
  }
  return ut.sort((a, b) => b.version - a.version);
}

/**
 * Planera en sparning. current = layout/current som det lästes (null om
 * ingen sparat än) → nästa version och dess historikslot.
 */
export function planSave({ current = null, placedItems, uid, lada, forvantadVersion } = {}) {
  if (!uid) return fel("ingen-anvandare", "Ingen inloggad användare.");
  const fore = Math.max(0, heltal(current && current.version));
  if (forvantadVersion !== undefined && forvantadVersion !== null && heltal(forvantadVersion) !== fore) {
    return fel("krock", "Någon annan sparade nyss – laddar om rummet.");
  }
  const v = validatePlacedItems(placedItems, { lada });
  if (!v.ok) return v;
  const version = fore + 1;
  return { ok: true, version, slot: historikSlot(version), placedItems: v.placedItems, uid };
}

/**
 * En historikslot → layouten som ska bli nästa version. Föremål som inte
 * (längre) finns i lådan tas bort i stället för att stoppa återställningen.
 */
export function planRestore(historySlot, { lada } = {}) {
  if (!historySlot || typeof historySlot !== "object" || !historySlot.placedItems) {
    return fel("tom-slot", "Den sparningen finns inte.");
  }
  const pi = lasPlacerade(historySlot.placedItems);
  const antal = lada === undefined ? null : ladaAntal(lada);
  const ut = {};
  for (const [nyckel, pos] of Object.entries(pi)) {
    if (pokalIdFranNyckel(nyckel)) {
      ut[nyckel] = pos; // pokalen tillhör klassen – aldrig i lådan
      continue;
    }
    const [, id, n] = NYCKEL.exec(nyckel);
    if (!antal || (antal.get(id) || 0) >= (n === undefined ? 1 : Number(n))) ut[nyckel] = pos;
  }
  return { ok: true, placedItems: ut, version: Math.max(0, heltal(historySlot.version)) };
}

/**
 * De två skrivningarna (set UTAN merge – placedItems ersätts helt, annars
 * skulle Firestore slå ihop de nästlade kartorna med den gamla layouten).
 * fv = { serverTimestamp }.
 */
export function planSaveWrites({ classId, plan, fv }) {
  return [
    {
      path: ["classCenters", classId, "layout", "current"],
      data: { placedItems: plan.placedItems, version: plan.version, updatedBy: plan.uid, updatedAt: fv.serverTimestamp() },
    },
    {
      path: ["classCenters", classId, "layoutHistory", String(plan.slot)],
      data: { placedItems: plan.placedItems, savedBy: plan.uid, savedAt: fv.serverTimestamp(), version: plan.version },
    },
  ];
}

/** Elevens/lärarens rätt att inreda (samma villkor som firestore.rules; rollen: kc-behorighet.js). */
export function kanInredaFor(o = {}) {
  return rollKanInreda(kcRoll(o));
}

/**
 * Spara placedItems som nästa version: EN transaktion (läs current → skriv
 * current + historikslot). Krockar med en samtidig sparning körs om
 * (kc-omforsok.js); oförändrad version + nekad = verkligt nekad (spärrad).
 */
export function korSparning(sdk, db, { classId, uid, placedItems, lada, forvantadVersion, forsok = KROCK_FORSOK } = {}) {
  return medKrockOmforsok((ctx) => transaktion(sdk, db, classId, ctx, (current) =>
    planSave({ current, placedItems, uid, lada, forvantadVersion })), { forsok });
}

/**
 * Återställ historikslot `slot`: läses i SAMMA transaktion och skrivs som en
 * NY version (hamnar själv i historiken → kan ångras). historikVersion =
 * versionen som listan visade för slotten: har ringbufferten skrivit över
 * slotten sedan dess → kod "historik-andrad" och ingenting skrivs (#493).
 */
export function korAterstallning(sdk, db, { classId, uid, slot, historikVersion, lada, forvantadVersion, forsok = KROCK_FORSOK } = {}) {
  const s = Number(slot);
  if (!Number.isInteger(s) || s < 0 || s >= KC_HISTORIK) return Promise.resolve(fel("ogiltig-slot", "Den sparningen finns inte."));
  return medKrockOmforsok((ctx) => transaktion(sdk, db, classId, ctx, (current, tx) =>
    tx.get(sdk.doc(db, "classCenters", classId, "layoutHistory", String(s))).then((snap) => {
      const data = snap.exists() ? snap.data() : null;
      if (historikVersion !== undefined && historikVersion !== null && heltal(data && data.version) !== heltal(historikVersion)) {
        return fel("historik-andrad", "Historiken har ändrats – listan laddas om.");
      }
      const r = planRestore(data, { lada });
      if (!r.ok) return r;
      const plan = planSave({ current, placedItems: r.placedItems, uid, forvantadVersion });
      return plan.ok ? { ...plan, aterstalldFran: r.version } : plan;
    })), { forsok });
}

function transaktion(sdk, db, classId, ctx, planera) {
  const curRef = sdk.doc(db, "classCenters", classId, "layout", "current");
  return sdk.runTransaction(db, async (tx) => {
    const snap = await tx.get(curRef);
    const current = snap.exists() ? snap.data() : null;
    if (sammaSomNekat(ctx, heltal(current && current.version))) return SAMMA_LAGE;
    const plan = await planera(current, tx);
    if (!plan.ok) return plan;
    const fv = { serverTimestamp: sdk.serverTimestamp };
    for (const w of planSaveWrites({ classId, plan, fv })) tx.set(sdk.doc(db, ...w.path), w.data);
    return plan;
  });
}
