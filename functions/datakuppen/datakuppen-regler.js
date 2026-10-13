// ============================================================================
// Datakuppen 💾 – SPELREGLERNA som ren logik (#652, epic Datakuppen). Delas
// med servern (functions/datakuppen/ = genererad kopia, se files-config.js)
// så att Cloud Functionen och elevens målväljare avgör EXAKT samma sak.
// Servern är ändå den enda som skriver data, koder och hack.
//
// FILERNA, SKYDDET OCH TRYGGHETEN = den gemensamma kistmotorn (#651,
// src/live/kistspel/delat/ks-regler.js) med Datakuppens filtabell: virus
// ≤ 10 %, hack ≤ 15 %, ingen förlorar allt, skyddad (brandvägg 60 s, hackad
// 30 s) går inte att välja, inte samma mål två gånger i rad.
//
// KODERNA (§1.2, §1.4) – bara ur listan (koder.json), aldrig något eleven
// skriver. Rena hjälpare; servern (functions/datakuppen-core.js) väljer vad
// som räknas som "tagna" koder och skickar in slumpen:
//   codeOk(kod)                 → bool: gemener a–z + siffror, ≥ 1 siffra,
//                                 ≥ 3 bokstäver (inga å/ä/ö)
//   codeList(json)              → ["f0tb01l", …] giltiga, unika, i listans ordning
//   codeOffers(list, avoid, rng, n?, own?) → n kodförslag, olika varandra.
//                               avoid = [Set, …] i prioritetsordning: först
//                               utan alla, sedan släpps de sista – listan tar
//                               aldrig slut (då får en kod återanvändas)
//   pickDecoys(list, right, { strict, soft? }, rng, n?) → n lockkoder:
//                               aldrig `right`, aldrig i strict (spelarnas
//                               aktuella koder), helst inte i soft, helst
//                               ungefär samma längd som right (±1, ±2, …)
//   hackOptions(right, decoys, struck, rng, prev?) → koderna i slumpad ordning
//                               (rätt + lockkoder minus de strukna). prev =
//                               förra visningen → ordningen blir aldrig samma
//   shuffle(list, rng)          → ny blandad lista (Fisher–Yates)
// ============================================================================

import { DK_FILES, DK_EVENT_TEXTS, DK_ANON, DK_RULES } from "./files-config.js";
import { createKistRegler } from "../kistspel/ks-regler.js";

// Målväljarens/serverns förklaring när ett val nekas ({namn} = målets förnamn).
const MESSAGES = {
  "saknas": "Den eleven är inte med i matchen.",
  "sig-sjalv": "Du kan inte hacka dig själv.",
  "skyddad": "🛡️ {namn} hann starta en brandvägg!",
  "samma-igen": "Du kan inte hacka samma elev två gånger i rad.",
  "for-lite-guld": "Den eleven har för lite data att hacka.",
};

export const DK_REGLER = createKistRegler({
  chests: DK_FILES,
  rules: DK_RULES,
  eventTexts: DK_EVENT_TEXTS,
  anon: DK_ANON,
  messages: MESSAGES,
});

export const {
  toMs, chestById, isVictimKind, chestTable, rollChest, applySelfEffect, isProtected, protectedLeftMs,
  shieldUntil, hitProtectionUntil, victimProblem, victimMessage, eligibleVictims, resolveVictim, eventText,
} = DK_REGLER;

// --- Koderna ----------------------------------------------------------------------

const CODE_RE = /^[a-z0-9]+$/;

export function codeOk(kod) {
  return typeof kod === "string" && CODE_RE.test(kod) && /[0-9]/.test(kod) &&
    (kod.match(/[a-z]/g) || []).length >= 3;
}

/** Listans koder ({ koder: [{ kod, ord }] } eller ["kod", …]) – giltiga och unika. */
export function codeList(json) {
  const raw = Array.isArray(json) ? json : json?.koder || [];
  const out = [];
  for (const k of raw) {
    const kod = typeof k === "string" ? k : k?.kod;
    if (codeOk(kod) && !out.includes(kod)) out.push(kod);
  }
  return out;
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor((Number(rng()) || 0) * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const has = (set, x) => !!set && (set instanceof Set ? set.has(x) : set.includes(x));

/**
 * n slumpade koder ur listan, olika varandra och aldrig `own` (elevens
 * nuvarande kod). avoid = mängder i prioritetsordning; tar koderna slut släpps
 * den sista mängden, sedan nästa … och till sist återanvänds valfri kod.
 */
export function codeOffers(list, avoid = [], rng = Math.random, n = DK_RULES.codeOffers, own = null) {
  const out = [];
  for (let k = avoid.length; k >= 0 && out.length < n; k--) {
    const sets = avoid.slice(0, k);
    const free = list.filter((c) => c !== own && !out.includes(c) && !sets.some((s) => has(s, c)));
    for (const c of shuffle(free, rng)) {
      if (out.length >= n) break;
      out.push(c);
    }
  }
  return out;
}

/**
 * Lockkoder till rätt kod `right`: ALDRIG right och ALDRIG en kod i strict
 * (någon spelares aktuella kod). Helst inte i soft (utestående kodförslag),
 * helst ungefär samma längd (±1, sedan ±2 …). Färre än n bara om listan
 * verkligen tagit slut.
 */
export function pickDecoys(list, right, { strict = [], soft = [] } = {}, rng = Math.random, n = DK_RULES.codeOptions - 1) {
  const base = list.filter((c) => c !== right && !has(strict, c));
  const len = String(right || "").length;
  const out = [];
  for (const pool of [base.filter((c) => !has(soft, c)), base]) {
    for (let d = 1; out.length < n && d <= 20; d++) {
      const tier = pool.filter((c) => !out.includes(c) && Math.abs(c.length - len) <= d);
      for (const c of shuffle(tier, rng)) {
        if (out.length >= n) break;
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * Koderna eleven ser i ett hackförsök: rätt + lockkoderna minus de strukna,
 * i slumpad ordning – aldrig samma ordning som förra visningen (prev) när det
 * finns mer än en kod.
 */
export function hackOptions(right, decoys, struck = [], rng = Math.random, prev = null) {
  const codes = [right, ...(decoys || []).filter((d) => d !== right && !has(struck, d))];
  let order = shuffle(codes, rng);
  const before = (prev || []).filter((c) => codes.includes(c));
  if (codes.length > 1 && before.length === codes.length && before.every((c, i) => order[i] === c)) {
    order = [...order.slice(1), order[0]];
  }
  return order;
}
