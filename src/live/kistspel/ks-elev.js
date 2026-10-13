// ============================================================================
// Kistspel 🎁 – ELEVSKÄRMENS LOGIK (#651, utbruten ur Guldrushens gr-elev.js
// #564/#577/#588). Ren (ingen DOM/Firebase). Saldot kommer ur formatets
// spelardokument (bara servern skriver); kistans utseende/ljud slås upp ur
// kisttabellen med det id servern svarade – eleven räknar aldrig själv ut vad
// en kista innehåller.
//
// INGEN PLACERING SOM NUMMER (Elias 2026-10-10): toppraden visar läget mot
// närmaste elev FRAMFÖR; bara topp 3 ser sin pallplats på slutskärmen.
//
// API (rena)
//   formatGold(n)            → "1 240" (hårt mellanslag)
//   goldStanding(grPlayers, uid) → { gold, rel }   rel = relativeStanding
//   protectionText(ms)       → "0:42" (uppåt avrundad)
//   myProtection(me, now)    → "🛡️ Skyddad 0:42" | ""
//   endStanding(result, uid) → { podium: 1|2|3|null, row, rel }
//   stageAction(phase)       → "spel" | "lobby" | "slut" | null
//   countUp(from, to, t)     → värdet vid t ∈ [0,1] (mjuk inbromsning)
//   firstName(name)
//
// TEMAT
//   createKistElev({ regler, rules, eventTexts, keyPrefix, jubelChests?, texts })
//     texts = {
//       lead, leadTie(n), tie(n), behind(belopp, n)          toppraden
//       why: { [orsak]: kort text }                          gråad i offerlistan
//       gain(belopp), lose(belopp), loseEmpty, empty, shield(sek), steal, swap
//                                                            kistans rad
//       fallback(belopp), swapped(who), stole(belopp, who)   offrets utfall
//     }
//   → { standingText(rel), victimRows(kind, me, grPlayers, now),
//       pendingLeftMs(pending, now), chestView(result), victimView(res, names?),
//       createHitWatcher(), chestKey(sid, uid) }
// ============================================================================

import { relativeStanding, firstName } from "../formats/snilleblixt/snilleblixt-elev.js";
import { fill, protectedLeftMs, toMs } from "./delat/ks-regler.js";

export { firstName };

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const NAMNLOS = "en klasskompis";

export function formatGold(n) {
  return Math.round(Number(n) || 0).toLocaleString("sv-SE").replace(/\s/g, "\u202f");
}

/** Mitt saldo + läget mot närmaste framför (aldrig ett placeringsnummer). */
export function goldStanding(grPlayers, uid) {
  const list = (grPlayers || []).filter((p) => p?.uid).map((p) => ({ uid: p.uid, points: int(p.gold), name: firstName(p.name) }));
  if (!list.some((p) => p.uid === uid)) list.push({ uid, points: 0, name: "" });
  const gold = list.find((p) => p.uid === uid).points;
  return { gold, rel: relativeStanding(list, uid) };
}

/** Skyddets nedräkning: 4 200 ms → "0:05" (når 0:00 först när skyddet är slut). */
export function protectionText(ms) {
  const s = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Elevens egen rad: bara medan skyddet gäller. */
export function myProtection(me, now) {
  const left = protectedLeftMs(me, now);
  return left > 0 ? `🛡️ Skyddad ${protectionText(left)}` : "";
}

/** Slutskärmen ur result.ranking: topp 3 (med saldo) → pallplats, annars läget mot närmaste framför. */
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

// Stämning per effekt → avatarens reaktion (live-reactions.js).
const MOOD = { gold: "glad", double: "glad", shield: "skyddad", lose: "aj", empty: null, steal: "glad", swap: "glad" };

export function createKistElev({ regler, rules, eventTexts, keyPrefix, jubelChests = [], texts: T }) {
  const { chestById, victimProblem } = regler;

  function standingText(rel) {
    const n = (rel?.name || "").trim() || NAMNLOS;
    switch (rel?.kind) {
      case "leder": return T.lead;
      case "lika-topp": return T.leadTie(n);
      case "lika": return T.tie(n);
      case "bakom": return T.behind(formatGold(rel.diff), n);
      default: return "";
    }
  }

  /**
   * Offerväljarens rader: sorterade på saldo (mest först), aldrig en själv;
   * byte visar BARA de med mer. Skyddade gråade med "🛡️ 0:04" – valbara när
   * nedräkningen når noll (servern prövar samma regel i valets ögonblick).
   */
  function victimRows(kind, me, grPlayers, now) {
    const myGold = int(me?.gold);
    return (grPlayers || [])
      .filter((p) => p?.uid && p.uid !== me?.uid)
      .filter((p) => kind !== "swap" || int(p.gold) > myGold)
      .map((p) => {
        const problem = victimProblem(kind, me, p, now);
        const leftMs = problem === "skyddad" ? protectedLeftMs(p, now) : 0;
        return {
          uid: p.uid, name: String(p.name || ""), first: firstName(p.name), classId: p.classId ?? null, gold: int(p.gold),
          ok: !problem, shield: leftMs > 0, leftMs,
          why: leftMs > 0 ? `🛡️ ${protectionText(leftMs)}` : problem ? T.why[problem] || "Går inte" : "",
        };
      })
      .sort((a, b) => b.gold - a.gold || a.name.localeCompare(b.name, "sv") || a.uid.localeCompare(b.uid));
  }

  function pendingLeftMs(pending, now) {
    const end = pending?.expiresAtMs ?? toMs(pending?.expiresAt);
    if (end == null) return rules.victimPickMs;
    return Math.max(0, end - now);
  }

  function caption(chest, delta) {
    const k = chest?.effect?.kind;
    if (k === "gold" || k === "double") return T.gain(formatGold(delta));
    if (k === "lose") return delta ? T.lose(formatGold(-delta)) : T.loseEmpty;
    if (k === "empty") return T.empty;
    if (k === "shield") return T.shield(Math.round(rules.shieldMs / 1000));
    if (k === "steal") return T.steal;
    if (k === "swap") return T.swap;
    return chest?.label || "";
  }

  /** Kistans visning ur openChest-svaret: { chest, kind, delta, gold, protectedUntil, pending? }. */
  function chestView(result) {
    const chest = chestById(result?.chest);
    const delta = Number(result?.delta) || 0;
    let mood = MOOD[chest?.effect?.kind] ?? null;
    if (jubelChests.includes(chest?.id)) mood = "jubel";
    return {
      chest, look: chest?.look || "", sound: chest?.sound || "", icon: chest?.icon || "🎁", label: chest?.label || "",
      delta, gold: int(result?.gold), mood, caption: caption(chest, delta), pending: result?.pending || null,
    };
  }

  /** Stöldens/bytets utfall ur chooseVictim: { result, chest, victimUid?, amount, delta, gold }. */
  function victimView(res, names = {}) {
    const who = names[res?.victimUid] || NAMNLOS;
    const delta = Number(res?.delta) || 0;
    if (res?.result === "fallback") return { ...chestView(res), caption: T.fallback(formatGold(delta)) };
    const chest = chestById(res?.chest);
    const base = { chest, look: chest?.look || "", sound: chest?.sound || "", icon: chest?.icon || "", delta, gold: int(res?.gold) };
    if (res?.result === "swap") return { ...base, mood: delta > 0 ? "glad" : null, caption: T.swapped(who), run: true };
    return { ...base, mood: delta > 0 ? "glad" : null, caption: T.stole(formatGold(delta), who), run: true };
  }

  /**
   * Notisen till den som blev bestulen (spelardokumentets lastHit, skrivet av
   * servern). Första take() = baslinjen: en omladdning visar aldrig en gammal
   * stöld igen.
   */
  function createHitWatcher() {
    let seen;
    const keyOf = (h) => (h ? `${toMs(h.at) ?? ""}|${h.byUid || ""}|${h.kind || ""}` : "");
    return {
      take(me) {
        const hit = me?.lastHit || null;
        const key = keyOf(hit);
        if (seen === undefined) { seen = key; return null; }
        if (!hit || key === seen) return null;
        seen = key;
        const tpl = { steal: eventTexts.victimSteal, swap: eventTexts.victimSwap }[hit.kind];
        if (!tpl) return null;
        const name = firstName(hit.byName) || "Någon";
        return {
          kind: hit.kind, byUid: hit.byUid || null, name,
          text: fill(tpl, { namn: name, belopp: formatGold(Math.abs(Number(hit.amount) || 0)) }),
          mood: "aj",
        };
      },
    };
  }

  const chestKey = (sid, uid) => `${keyPrefix}:${sid}:${uid}`;

  return { standingText, victimRows, pendingLeftMs, chestView, victimView, createHitWatcher, chestKey };
}
