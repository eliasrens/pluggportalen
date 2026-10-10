// ============================================================================
// Guldrushen (#564): ELEVSKÄRMENS LOGIK – ren (ingen DOM/Firebase), testas i
// test/live-guldrush-elev.test.js. Vyn (guldrush-student.js + gr-kistor.js +
// gr-offer.js) ritar bara det som räknas ut här (designspec §6.4–6.6).
//
// Allt guld kommer ur grPlayers (bara servern skriver, #563). Eleven räknar
// aldrig själv ut vad en kista innehåller – kistans utseende/ljud slås upp ur
// kistkonfigen (delat/chests-config.js) med det id servern svarade.
//
// INGEN PLACERING SOM NUMMER (Elias 2026-10-10, samma regel som
// Snilleblixten): toppraden visar läget mot närmaste elev FRAMFÖR ("20 guld
// bakom Alma" / "Du leder! 💰"); bara topp 3 ser sin pallplats på slutskärmen.
//
// API
//   goldStanding(grPlayers, uid) → { gold, rel }   rel = relativeStanding (guld)
//   standingText(rel) → "20 guld bakom Alma" | "Du leder! 💰" | "Lika med Alma" | ""
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
//   endStanding(result, uid) → { podium: 1|2|3|null, row, rel }
//   stageAction(phase) → "spel" | "lobby" | "slut" | null
//   formatGold(n) → "1 240"
//   countUp(from, to, t) → värdet vid t ∈ [0,1] (mjuk inbromsning)
//   chestKey(sid, uid) → localStorage-nyckeln för en oöppnad kista
// ============================================================================

import { GR_EVENT_TEXTS, GR_RULES } from "./delat/chests-config.js";
import { chestById, victimProblem, toMs } from "./delat/guldrush-regler.js";
import { relativeStanding, firstName } from "../snilleblixt/snilleblixt-elev.js";

export { firstName };

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

export function formatGold(n) {
  return Math.round(Number(n) || 0).toLocaleString("sv-SE").replace(/\s/g, " ");
}

/** Mitt guld + läget mot närmaste framför (aldrig ett placeringsnummer). */
export function goldStanding(grPlayers, uid) {
  const list = (grPlayers || []).filter((p) => p?.uid).map((p) => ({ uid: p.uid, points: int(p.gold), name: firstName(p.name) }));
  if (!list.some((p) => p.uid === uid)) list.push({ uid, points: 0, name: "" });
  const gold = list.find((p) => p.uid === uid).points;
  return { gold, rel: relativeStanding(list, uid) };
}

const NAMNLOS = "en klasskompis";

export function standingText(rel) {
  const n = (rel?.name || "").trim() || NAMNLOS;
  switch (rel?.kind) {
    case "leder": return "Du leder! 💰";
    case "lika-topp": return `Lika med ${n} – ni leder! 💰`;
    case "lika": return `Lika med ${n}`;
    case "bakom": return `${formatGold(rel.diff)} guld bakom ${n}`;
    default: return "";
  }
}

const WHY = {
  "skyddad": "🛡️ Stöldskydd",
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

/** Slutskärmen ur result.ranking: topp 3 (med guld) → pallplats, annars läget mot närmaste framför. */
export function endStanding(result, uid) {
  const ranking = result?.ranking || [];
  const row = ranking.find((p) => p.uid === uid) || null;
  const podium = row && row.gold > 0 && row.rank <= 3 ? row.rank : null;
  const list = ranking.map((p) => ({ uid: p.uid, points: int(p.gold), name: firstName(p.name) }));
  return { podium, row, rel: row ? relativeStanding(list, uid) : { kind: "ingen" } };
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
