// ============================================================================
// Guldrushen (#564): ELEVSKÄRMENS LOGIK – ren (ingen DOM/Firebase), testas i
// test/live-guldrush-elev.test.js. Vyn (guldrush-student.js + gr-kistor.js +
// gr-offer.js) ritar bara det som räknas ut här (designspec §6.4–6.6).
//
// Allt guld kommer ur grPlayers (bara servern skriver, #563). Eleven räknar
// aldrig själv ut vad en kista innehåller – kistans utseende/ljud slås upp ur
// kistkonfigen (delat/chests-config.js) med det id servern svarade.
//
// PLACERING ENLIGT SPECEN (Elias 2026-10-10, #577 – Guldrushen följer INTE
// Snilleblixtens regel): toppraden visar diskret "Du ligger 4:a" (funktions-
// spec §6.7, designspec §6.6), ettan "Du leder! 💰"; slutskärmen "Du kom 4:e!"
// för alla (§7.2.4), medalj bara för topp 3. Lika guld = DELAD placering
// (1, 1, 3 – samma som guldrush-core rankByGold): "Du ligger delad 2:a".
// Innan någon har guld finns ingen placering (alla vore delad 1:a).
//
// API
//   goldStanding(grPlayers, uid) → { gold, place }   place = { rank, shared } | null
//   standingText(place) → "Du leder! 💰" | "Ni delar ledningen! 💰"
//       | "Du ligger 4:a" | "Du ligger delad 4:a" | ""
//   victimRows(kind, me, grPlayers, now) → [{ uid, name, first, classId, gold,
//       ok, shield, why }]  offerväljarens knappar: sorterade på guld (mest
//       först), aldrig en själv; byte visar BARA de med mer guld. ok=false =
//       gråad (sköld 🛡️ / stöldskydd 🛡️ / samma igen / för lite guld)
//   pendingLeftMs(pending, now) → ms kvar att välja offer (0 = slut)
//   chestView(result) → { chest, look, sound, icon, label, delta, gold, mood,
//       caption }  kistans visning ur serverns svar (openChest/chooseVictim)
//   victimView(result, names?) → samma för stöldens/bytets utfall
//   createHitWatcher() → { take(me) → notis | null }  "🦝 Leo knyckte 20 guld
//       från dig!" – FÖRSTA anropet är baslinjen (omladdning visar inget gammalt)
//   endStanding(result, uid) → { podium: 1|2|3|null, row, place }
//   endText(place) → "Du kom 2:a!" | "Du kom delad 2:a!" | ""
//   stageAction(phase) → "spel" | "lobby" | "slut" | null
//   formatGold(n) → "1 240"
//   countUp(from, to, t) → värdet vid t ∈ [0,1] (mjuk inbromsning)
//   chestKey(sid, uid) → localStorage-nyckeln för en oöppnad kista
// ============================================================================

import { GR_EVENT_TEXTS, GR_RULES } from "./delat/chests-config.js";
import { chestById, victimProblem, toMs } from "./delat/guldrush-regler.js";
import { firstName } from "../snilleblixt/snilleblixt-elev.js";
import { placeText } from "../../live-rewards.js";

export { firstName };

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

export function formatGold(n) {
  return Math.round(Number(n) || 0).toLocaleString("sv-SE").replace(/\s/g, " ");
}

/** Placering ur allas guld: antal med MER guld + 1, delad vid lika. Ingen har guld → null. */
function placeOf(golds, gold) {
  if (!golds.some((g) => g > 0)) return null;
  const above = golds.filter((g) => g > gold).length;
  const same = golds.filter((g) => g === gold).length;
  return { rank: above + 1, shared: same > 1 };
}

/** Mitt guld + min placering (sen anslutning utan dokument = 0 guld). */
export function goldStanding(grPlayers, uid) {
  const golds = new Map();
  for (const p of grPlayers || []) if (p?.uid) golds.set(p.uid, int(p.gold));
  if (!golds.has(uid)) golds.set(uid, 0);
  const gold = golds.get(uid);
  return { gold, place: placeOf([...golds.values()], gold) };
}

const NAMNLOS = "en klasskompis";

export function standingText(place) {
  if (!place?.rank) return "";
  if (place.rank === 1) return place.shared ? "Ni delar ledningen! 💰" : "Du leder! 💰";
  return `Du ligger ${place.shared ? "delad " : ""}${placeText(place.rank)}`;
}

const WHY = {
  "skyddad": "🛡️ Skyddad",
  "samma-igen": "Nyss vald",
  "for-lite-guld": "För lite guld",
};

/**
 * Offerväljarens rader. Sköld och stöldskydd visas gråade med 🛡️ (designspec
 * §6.5) – servern slumpar heller aldrig fram någon med sköld.
 */
export function victimRows(kind, me, grPlayers, now) {
  const myGold = int(me?.gold);
  return (grPlayers || [])
    .filter((p) => p?.uid && p.uid !== me?.uid)
    .filter((p) => kind !== "swap" || int(p.gold) > myGold)
    .map((p) => {
      const problem = victimProblem(kind, me, p, now);
      const shield = !!p.shield;
      return {
        uid: p.uid, name: String(p.name || ""), first: firstName(p.name), classId: p.classId ?? null, gold: int(p.gold),
        ok: !problem && !shield, shield: shield || problem === "skyddad",
        why: shield ? "🛡️ Sköld" : problem ? WHY[problem] || "Går inte" : "",
      };
    })
    .sort((a, b) => b.gold - a.gold || a.name.localeCompare(b.name, "sv") || a.uid.localeCompare(b.uid));
}

export function pendingLeftMs(pending, now) {
  const end = pending?.expiresAtMs ?? toMs(pending?.expiresAt);
  if (end == null) return GR_RULES.victimPickMs;
  return Math.max(0, end - now);
}

// Stämning per effekt → avatarens reaktion (live-reactions.js).
const MOOD = { gold: "glad", double: "glad", shield: "skyddad", lose: "aj", empty: null, steal: "glad", swap: "glad" };

function caption(chest, delta) {
  const k = chest?.effect?.kind;
  if (k === "gold" || k === "double") return `+${formatGold(delta)} guld`;
  if (k === "lose") return delta ? `−${formatGold(-delta)} guld` : "Puh, fickan var tom!";
  if (k === "empty") return "Bara ett löv …";
  if (k === "shield") return "Sköld!";
  if (k === "steal") return "Stöld! Välj vem";
  if (k === "swap") return "Byte! Välj vem";
  return chest?.label || "";
}

/** Kistans visning ur openChest-svaret: { chest, kind, delta, gold, shield, pending? }. */
export function chestView(result) {
  const chest = chestById(result?.chest);
  const delta = Number(result?.delta) || 0;
  let mood = MOOD[chest?.effect?.kind] ?? null;
  if (chest?.id === "skattkammare") mood = "jubel";
  return {
    chest, look: chest?.look || "", sound: chest?.sound || "", icon: chest?.icon || "🎁", label: chest?.label || "",
    delta, gold: int(result?.gold), mood, caption: caption(chest, delta), pending: result?.pending || null,
  };
}

/** Stöldens/bytets utfall ur chooseVictim: { result, chest, victimUid?, amount, delta, gold }. */
export function victimView(res, names = {}) {
  const who = names[res?.victimUid] || NAMNLOS;
  const delta = Number(res?.delta) || 0;
  if (res?.result === "fallback") return { ...chestView(res), caption: `Ingen att välja – +${formatGold(delta)} guld` };
  const chest = chestById(res?.chest);
  const base = { chest, look: chest?.look || "", sound: chest?.sound || "", icon: chest?.icon || "", delta, gold: int(res?.gold) };
  if (res?.result === "blocked") return { ...base, mood: null, caption: `🛡️ ${who}s sköld stoppade dig!`, run: false };
  if (res?.result === "swap") return { ...base, mood: delta > 0 ? "glad" : null, caption: `🔄 Du bytte guld med ${who}!`, run: true };
  return { ...base, mood: delta > 0 ? "glad" : null, caption: `🦝 +${formatGold(delta)} guld från ${who}!`, run: true };
}

const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

/**
 * Notisen till den som blev bestulen (grPlayers.lastHit, skrivet av servern).
 * Första take() = baslinjen: en omladdning visar aldrig en gammal stöld igen.
 */
export function createHitWatcher() {
  let seen;
  const keyOf = (h) => (h ? `${toMs(h.at) ?? ""}|${h.byUid || ""}|${h.kind || ""}` : "");
  return {
    take(me) {
      const hit = me?.lastHit || null;
      const key = keyOf(hit);
      if (seen === undefined) { seen = key; return null; }
      if (!hit || key === seen) return null;
      seen = key;
      const tpl = { steal: GR_EVENT_TEXTS.victimSteal, swap: GR_EVENT_TEXTS.victimSwap, blocked: GR_EVENT_TEXTS.victimBlocked }[hit.kind];
      if (!tpl) return null;
      const name = firstName(hit.byName) || "Någon";
      return {
        kind: hit.kind, byUid: hit.byUid || null, name,
        text: fill(tpl, { namn: name, belopp: formatGold(Math.abs(Number(hit.amount) || 0)) }),
        mood: hit.kind === "blocked" ? "skyddad" : "aj",
      };
    },
  };
}

/** Slutskärmen ur result.ranking (rank satt av servern, delad vid lika): placering för alla, pall för topp 3 med guld. */
export function endStanding(result, uid) {
  const ranking = result?.ranking || [];
  const row = ranking.find((p) => p.uid === uid) || null;
  const anyGold = ranking.some((p) => int(p.gold) > 0);
  const place = row && anyGold && row.rank ? { rank: row.rank, shared: ranking.filter((p) => p.rank === row.rank).length > 1 } : null;
  const podium = place && int(row.gold) > 0 && place.rank <= 3 ? place.rank : null;
  return { podium, row, place };
}

export function endText(place) {
  if (!place?.rank) return "";
  return `Du kom ${place.shared ? "delad " : ""}${placeText(place.rank)}!`;
}

export function stageAction(phase) {
  if (phase === "live") return "spel";
  if (phase === "lobby") return "lobby";
  if (phase === "ended" || phase === "finished" || phase === "cancelled") return "slut";
  return null;
}

export function countUp(from, to, t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return Math.round(from + (to - from) * (1 - (1 - x) ** 3));
}

export const chestKey = (sid, uid) => `pp:gr:kista:${sid}:${uid}`;
