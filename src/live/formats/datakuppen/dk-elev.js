// ============================================================================
// Datakuppen 💾 (#653): ELEVSKÄRMENS LOGIK – ren (ingen DOM/Firebase), testas
// i test/live-datakuppen-elev.test.js. Vyn (dk-elev-vy.js + dk-filer.js +
// dk-offer.js + dk-kodkort.js + dk-kodval.js) ritar bara det som räknas ut här
// (spec docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §1.2–1.7, §4.3).
//
// All data kommer ur dkPlayers (bara servern skriver, #652). Eleven räknar
// aldrig själv ut vad en fil innehåller eller vilken kod som är rätt – filens
// utseende/ljud slås upp ur filtabellen (delat/files-config.js) med det id
// servern svarade, och koderna kommer ur elevens egna dkSelf.
//
// INGEN PLACERING SOM NUMMER (samma regel som Guldrushens elevvy, Elias
// 2026-10-10): toppraden visar läget mot närmaste elev FRAMFÖR ("20 MB bakom
// Alma" / "Du leder!"); bara topp 3 ser sin pallplats på slutskärmen.
//
// Elevlogiken är kistspelsmodulens (#651, src/live/kistspel/ks-elev.js) med
// Datakuppens texter. Dessutom:
//   DK_ELEV                      temat (standingText, victimRows, pendingLeftMs,
//                                chestView, createHitWatcher, chestKey …)
//   fileView(openFile-svar)      → chestView med filens id (svaret heter `file`)
//   targetView(chooseTarget-svar, names?) → { hack?, caption, … }  steg 1:s utfall
//   guessView(guessCode-svar, name) → { tone, title, text, mood, sound }
//   codeChars(kod)               → [{ ch, digit }] – siffrorna ritas tydligt
//                                skilda från bokstäverna (0/o, 1/l)
//   codeSlots(options, struck)   → [{ code, gone }] tre platser: koderna att
//                                välja + strukna (minnet) som "borta"
//   createHackMemory(store?)     → { struck(target), strike(target, kod), seen(target, options) }
//                                vilka koder JAG strukit per mål (bara för att
//                                visa dem som borta – servern avgör alltid)
//   codePickState(self, phase)   → { show, offers, code, lobby } (lobbyns kodval)
//   hackState(self, me, now)     → steg 2 pågår (omladdning) | null
//   tipAt(i)                     → säkerhetstipset nr i (roterar)
//   formatMb(n)                  → "1 240" (= formatGold)
//   firstName, formatGold, goldStanding, protectionText, myProtection,
//   endStanding, stageAction, countUp (kistspelsmodulen)
// ============================================================================

import { DK_EVENT_TEXTS, DK_RULES, DK_TIPS } from "./delat/files-config.js";
import { DK_REGLER } from "./delat/datakuppen-regler.js";
import {
  firstName, formatGold, goldStanding, protectionText, myProtection, endStanding, stageAction, countUp, createKistElev,
} from "../../kistspel/ks-elev.js";
import { toMs } from "../../kistspel/delat/ks-regler.js";

export { firstName, formatGold, goldStanding, protectionText, myProtection, endStanding, stageAction, countUp };
export const formatMb = formatGold;

export const DK_ELEV = createKistElev({
  regler: DK_REGLER,
  rules: DK_RULES,
  eventTexts: DK_EVENT_TEXTS,
  keyPrefix: "pp:dk:fil",
  jubelChests: ["serverhall"],
  texts: {
    lead: "Du leder! 💾",
    leadTie: (n) => `Lika med ${n} – ni leder! 💾`,
    tie: (n) => `Lika med ${n}`,
    behind: (diff, n) => `${diff} MB bakom ${n}`,
    why: { "samma-igen": "Nyss hackad", "for-lite-guld": "För lite data" },
    gain: (x) => `+${x} MB`,
    lose: (x) => `Virus! −${x} MB`,
    loseEmpty: "Viruset hittade ingen data!",
    empty: "Tom mapp …",
    shield: (sek) => `Brandvägg i ${sek} s!`,
    steal: "Hack! Välj vem",
    swap: "Hack! Välj vem",
    fallback: (x) => `Ingen att hacka just nu – +${x} MB`,
    swapped: (who) => `Hack mot ${who}`,
    stole: (x, who) => `💻 +${x} MB från ${who}!`,
  },
});

export const { standingText, victimRows, pendingLeftMs, chestView, createHitWatcher, chestKey } = DK_ELEV;

/** openFile svarar { file, … } – kistmotorns visning vill ha { chest, … }. */
export function fileView(res) {
  return chestView({ ...res, chest: res?.file ?? res?.chest });
}

/**
 * Steg 1:s utfall (chooseTarget): målet valt → { hack } (steg 2 tar över),
 * ingen gick att välja → filens fallback (Mapp) som en vanlig fil.
 */
export function targetView(res, names = {}) {
  if (res?.result === "fallback") return { ...fileView(res), caption: `Ingen att hacka just nu – +${formatGold(res.delta)} MB` };
  const name = firstName(res?.targetName) || names[res?.targetUid] || "en klasskompis";
  return {
    hack: {
      targetUid: res?.targetUid ?? null, targetName: name, options: [...(res?.options || [])],
      expiresAtMs: Number(res?.expiresAtMs) || null,
    },
    caption: `💻 Knäck ${name}s kod!`, mood: null, run: false, delta: 0, gold: null,
  };
}

/** Steg 2:s utfall (guessCode) → vad kodkorten visar. */
export function guessView(res, name = "") {
  const who = firstName(name) || "kompisen";
  switch (res?.result) {
    case "hacked":
      return { tone: "ratt", title: "Rätt kod! 🔓", text: `+${formatGold(res.amount)} MB från ${who}`, mood: "jubel", sound: "access" };
    case "wrong":
      return { tone: "fel", title: "Fel kod!", text: `Koden stryks. Nästa gång mot ${who} är det lättare.`, mood: "aj", sound: "nekad" };
    case "timeout":
      return { tone: "tid", title: "⏰ Tiden tog slut", text: "Hacket misslyckades – ingen fara.", mood: null, sound: "nekad" };
    case "changed":
      return { tone: "tid", title: "🔑 Ny kod!", text: `${who} hann byta kod.`, mood: null, sound: "nekad" };
    case "protected":
      return { tone: "tid", title: "🛡️ Skyddad", text: res?.message || `${who} hann starta en brandvägg!`, mood: null, sound: "nekad" };
    default:
      return { tone: "tid", title: "Hacket misslyckades", text: "", mood: null, sound: "nekad" };
  }
}

/** "f0tb01l" → tecken med siffrorna märkta (ritas i en annan färg, 0 med snedstreck). */
export function codeChars(kod) {
  return [...String(kod || "")].map((ch) => ({ ch, digit: /[0-9]/.test(ch) }));
}

/**
 * Kodkortens platser: alltid DK_RULES.codeOptions (3). Koderna att välja i
 * serverns ordning, sist de strukna som "borta" (med koden om jag minns den).
 */
export function codeSlots(options = [], struck = [], n = DK_RULES.codeOptions) {
  const opts = (options || []).slice(0, n);
  const gone = (struck || []).filter((c) => !opts.includes(c));
  const slots = opts.map((code) => ({ code, gone: false }));
  for (let i = 0; slots.length < n; i++) slots.push({ code: gone[i] ?? "", gone: true });
  return slots;
}

/**
 * Minnet av MINA strukna koder per mål (bara visning). Tre alternativ igen =
 * målet har bytt kod (servern nollställde) → glöm. store = { get(key), set(key, v) }.
 */
export function createHackMemory(store = null) {
  let map = {};
  try { map = JSON.parse(store?.get() || "{}") || {}; } catch { map = {}; }
  const save = () => { try { store?.set(JSON.stringify(map)); } catch {} };
  return {
    struck: (target) => [...(map[target] || [])],
    strike(target, kod) {
      if (!target || !kod) return;
      map[target] = [...new Set([...(map[target] || []), kod])];
      save();
    },
    seen(target, options = []) {
      if (target && map[target] && options.length >= DK_RULES.codeOptions) {
        delete map[target];
        save();
      }
    },
  };
}

/**
 * Lobbyns kodval ur dkSelf: förslagen visas tills eleven har en kod. Koden
 * gäller sedan hela matchen (#719) – i spelet finns inget kodval.
 */
export function codePickState(self, phase = "lobby") {
  const offers = Array.isArray(self?.offers) ? self.offers.filter(Boolean) : [];
  const code = self?.code || null;
  const lobby = phase !== "live";
  return { show: lobby && offers.length > 0 && !code, offers, code, lobby };
}

/** Ett påbörjat steg 2 (omladdning mitt i hacket): dkSelf.hack + dkPlayers.pending. */
export function hackState(self, me, now) {
  const h = self?.hack;
  const p = me?.pending;
  if (!h?.targetUid || !Array.isArray(h.options) || !h.options.length) return null;
  if (p && (p.chest !== "hack" || p.stage !== "guess" || p.targetUid !== h.targetUid)) return null;
  if (!p) return null;
  const end = toMs(h.expiresAt);
  return {
    targetUid: h.targetUid, targetName: firstName(h.targetName) || "", options: [...h.options],
    expiresAtMs: end, leftMs: end == null ? DK_RULES.codeGuessMs : Math.max(0, end - now),
  };
}

export function tipAt(i) {
  const n = DK_TIPS.length;
  return n ? DK_TIPS[((Math.floor(Number(i) || 0) % n) + n) % n] : "";
}
