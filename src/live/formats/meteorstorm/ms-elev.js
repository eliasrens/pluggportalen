// ============================================================================
// Meteorstormen ☄️ (#823, spec §5): ELEVSKÄRMENS LOGIK – ren (ingen DOM,
// ingen Firebase), testas i test/live-meteorstorm-elev.test.js. Vyn
// (ms-elev-vy.js) och slutskärmen (ms-skarmar.js) ritar bara det som räknas
// ut här.
//
// Källorna (Elias 2026-10-21): eleven läser bara msPublic/status (stationerna,
// som projektorn ser dem ~1,5 s bakåt – ur varje msAgera-svar, annars högst
// var 20:e s) och sitt eget svar från msAgera (kvittensen). Eleven lyssnar
// aldrig på msEvents. Energin efter handlingen räknar servern; före valet
// uppskattas den här (förra energin + svarets vinst, ☀️ ×2 / ✨ +1) bara för
// att gråa knapparna – servern avgör alltid.
//
// INGEN PLACERING SOM NUMMER: slutskärmen säger "Ni vann! 🚀" / "Bra kämpat –
// 4D vann den här gången", aldrig "2:a".
//
// API
//   KNAPPAR                        [{ typ, ikon, namn, tangent }] 🛡️ 🔫 🌀
//   stageAction(phase)             → "spel" | "lobby" | "slut" | null
//   decimal(x, n=1)                → "0,6" (svensk decimal, utan ",0")
//   dragFinns(session)             → dragstrålen i matchen? (Klass mot klass, attacker ≠ av)
//   minStation(status, classId)    → stationen | null
//   andraStationer(status, classId, session) → [{ classId, namn, skrov, flyter }]
//   planCfg(session)               → motorns indata utan handlingar (fröet, start, speltid)
//                                  | null före start – händelserna och energin räknas
//                                  ur fröet (samma som servern), utan läsningar
//   energiVinst(status, now, cfg?) → 1 | 2 (☀️ Solstorm ×2, ✨ Kometsvans +1)
//   knappar({ energi, vinst, status, classId, session, now }) → [{ typ, ikon, namn,
//                                  tangent, kostnad, kan, info }] (dragstrålen bara
//                                  om den finns i matchen)
//   tangentTyp(e)                  → "skold" | "laser" | "drag" | "spara" | null
//   valTangent(e, { lage, shownAt, nu }) → typen om valet visas (och inte nyss
//                                  öppnades), annars null. Bryr sig INTE om
//                                  defaultPrevented: flervalets dolda knappar
//                                  (choice-answer.js) tar också 1–4 (#823 F1)
//   medKvitto(status, res, classId) → status med den egna stationens sköld/
//                                  laddning efter handlingen (samma tal som kvittensen)
//   kvittens(res, { classId, session })  → { text, ton } ur msAgera-svaret
//   handelseRad(status, now, cfg?) → { typ, text } | null (banderollen)
//   stationRad(station)            → "Skrov 82 · Sköld 34/60" (skärmläsare/text)
//   lagesRad(station, classNamn)   → hjälp/flyter-raden | ""
//   slutet(result, classId, session) → { titel, rad, vann }
//   bidragText(row)                → "Du sköt ner 7 meteorer och laddade skölden 5 gånger."
//   myntRader(entry, lage)         → [{ label, coins }] (utan placering som nummer)
// ============================================================================

import { KOSTNAD, SKOLD_TAK, LADDNING_TAK, ENERGI_TAK, HANDELSE } from "./delat/ms-balans.js";
import { energiEffekt, stormPlan } from "./delat/ms-agera.js";
import { toMs } from "../../live-time.js";

export const KNAPPAR = [
  { typ: "skold", ikon: "🛡️", namn: "Sköld", tangent: "1" },
  { typ: "laser", ikon: "🔫", namn: "Laser", tangent: "2" },
  { typ: "drag", ikon: "🌀", namn: "Dragstråle", tangent: "3" },
];

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const klassNamn = (s, id) => s?.classNames?.[id] || id || "";

export function stageAction(phase) {
  if (phase === "live") return "spel";
  if (phase === "lobby" || phase === "countdown") return "lobby";
  if (phase === "ended" || phase === "finished" || phase === "cancelled") return "slut";
  return null;
}

/** Svensk decimal: 0.64 → "0,6", 3 → "3". */
export function decimal(x, n = 1) {
  const v = Math.round((Number(x) || 0) * 10 ** n) / 10 ** n;
  return String(v).replace(".", ",");
}

export function dragFinns(session) {
  const inst = session?.msInstallningar || {};
  return inst.lage === "klass-mot-klass" && inst.attacker !== "av" && (session?.participatingClassIds || []).length > 1;
}

export function minStation(status, classId) {
  return (status?.stationer || []).find((x) => x.classId === classId) || null;
}

export function andraStationer(status, classId, session) {
  const ids = (session?.participatingClassIds || []).filter((id) => id !== classId);
  return ids.map((id) => {
    const x = minStation(status, id);
    return { classId: id, namn: klassNamn(session, id), skrov: x ? int(x.skrov) : null, flyter: !!x?.flyter };
  });
}

/** Motorns indata ur sessionen (som functions/meteorstorm-sess.js cfgFor) | null före start. */
export function planCfg(session) {
  const start = toMs(session?.startedAt);
  if (start == null || session?.msSeed == null) return null;
  return {
    seed: session.msSeed,
    startMs: start + (Number(session.countdownSeconds) || 0) * 1000,
    varaktighetMs: (Number(session.durationSeconds) || 0) * 1000,
    stationer: session.msStationer || (session.participatingClassIds || []).map((classId) => ({ classId, aktiva: 1 })),
    installningar: session.msInstallningar,
  };
}

/** Pågående händelse ur stormplanen (absoluta tider) | null. */
function handelseUrPlan(cfg, now) {
  const rel = now - cfg.startMs;
  if (!(rel >= 0 && rel < cfg.varaktighetMs)) return null;
  const h = stormPlan(cfg).handelser.find((x) => rel >= x.startMs && rel < x.slutMs);
  return h ? { typ: h.typ, slutMs: cfg.startMs + h.slutMs } : null;
}

/** Vad ett rätt svar ger just nu (servern räknar – det här gråar bara knapparna). */
export function energiVinst(status, now, cfg = null) {
  if (cfg) return energiEffekt(cfg, now).energi;
  const h = status?.handelse;
  if (!h || !(Number(h.slutMs) > now)) return 1;
  if (h.typ === "solstorm") return HANDELSE.solstorm.energiFaktor;
  if (h.typ === "kometsvans") return 1 + HANDELSE.kometsvans.energiBonus;
  return 1;
}

/**
 * Knapparna efter ett rätt svar. energi = energin FÖRE svaret (klientens,
 * senaste msAgera), vinst = energiVinst. kan = har råd (och dragstrålen är
 * redo); info = kostnaden eller dragstrålens läge ("om 7 s", "på väg").
 */
export function knappar({ energi = 0, vinst = 1, status = null, classId = null, session = null, now = 0 }) {
  const har = int(energi) + int(vinst);
  const st = minStation(status, classId);
  const drag = dragFinns(session);
  return KNAPPAR.filter((k) => k.typ !== "drag" || drag).map((k) => {
    if (k.typ !== "drag") {
      const kostnad = KOSTNAD[k.typ];
      return { ...k, kostnad, kan: har >= kostnad, info: `⚡ ${kostnad}` };
    }
    const d = st?.drag || {};
    const kostnad = int(d.kostnad) || KOSTNAD.drag;
    if (d.tillaten === false) return { ...k, kostnad, kan: false, info: "inte nu" };
    if (d.armerad) return { ...k, kostnad, kan: false, info: "på väg …" };
    const kvar = Math.ceil((Number(d.redoMs) - now) / 1000);
    if (d.redoMs != null && kvar > 0) return { ...k, kostnad, kan: false, info: `om ${kvar} s`, redoSek: kvar };
    return { ...k, kostnad, kan: har >= kostnad, info: `⚡ ${kostnad}` };
  });
}

/** Genvägarna: 1 2 3 och mellanslag (= Spara energin). */
export function tangentTyp(e) {
  if (!e || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key === " " || e.code === "Space") return "spara";
  const n = /^(?:Digit|Numpad)([1-3])$/.exec(e.code || "")?.[1] ?? (/^[1-3]$/.test(e.key) ? e.key : null);
  return n ? KNAPPAR[Number(n) - 1].typ : null;
}

/** Valets tangent (lyssnas i capture-fasen – före frågekomponentens). */
export function valTangent(e, { lage, shownAt = 0, nu = 0 } = {}) {
  if (lage !== "val" || nu - shownAt < VAL_SPARR_MS) return null;
  return tangentTyp(e);
}
/** Så länge efter att valet visats räknas inte tangenter/klick (samma tryck som svarade). */
export const VAL_SPARR_MS = 400;

const NEKAD = {
  energi: (kostnad) => `🌀 Dragstrålen kostar ${kostnad} ⚡ – energin sparad.`,
  vantetid: () => "🌀 Dragstrålen laddar om – energin sparad.",
  armerad: () => "🌀 Dragstrålen är redan på väg – energin sparad.",
  tid: () => "🌀 För sent för dragstrålen – energin sparad.",
  av: () => "🌀 Ingen dragstråle i den här matchen – energin sparad.",
};
const BONUS = { solstorm: "☀️ Dubbel energi! ", kometsvans: "✨ Extra energi! " };

/** Dragstrålens mål: det angivna, annars den andra stationen med mest skrov som inte flyter (som motorn). */
function dragMal(res, classId, session, status) {
  if (res?.mal) return klassNamn(session, res.mal);
  const andra = andraStationer(status, classId, session);
  const kand = andra.filter((x) => !x.flyter).sort((a, b) => (b.skrov ?? 100) - (a.skrov ?? 100));
  return (kand[0] || andra[0])?.namn || "den andra stationen";
}

/** Statusen med handlingens effekt på den egna stationen (toppraden = kvittensen, #823 F6). */
export function medKvitto(status, res, classId) {
  const plus = res?.correct && !res.nekad ? res.effekt || {} : {};
  if (!status || !(plus.skold || plus.laser)) return status;
  return {
    ...status,
    stationer: (status.stationer || []).map((x) => (x.classId !== classId ? x : {
      ...x,
      skold: Math.min(SKOLD_TAK, (Number(x.skold) || 0) + (Number(plus.skold) || 0)),
      laddning: Math.min(LADDNING_TAK, (Number(x.laddning) || 0) + (Number(plus.laser) || 0)),
    })),
  };
}

/** Kvittensen ur msAgera-svaret (spec §5: "som Guldrushen"). ton: "bra" | "lugn". */
export function kvittens(res, { classId = null, session = null } = {}) {
  if (!res?.correct) return null;
  const status = res.status || null;
  const st = minStation(status, classId);
  const bonus = BONUS[res.handelse] || "";
  const energi = int(res.energi);
  if (res.nekad) {
    const t = (NEKAD[res.nekad] || NEKAD.tid)(int(res.kostnad) || KOSTNAD.drag);
    return { text: `${bonus}${t}`, ton: "lugn" };
  }
  if (res.typ === "skold") {
    const plus = Number(res.effekt?.skold) || 0;
    const nu = Math.min(SKOLD_TAK, Math.round((Number(st?.skold) || 0) + plus));
    return { text: `${bonus}🛡️ +${decimal(plus)} – skölden ${nu}/${SKOLD_TAK}`, ton: "bra" };
  }
  if (res.typ === "laser") {
    const plus = Number(res.effekt?.laser) || 0;
    const redo = Math.min(LADDNING_TAK, (Number(st?.laddning) || 0) + plus);
    return { text: `${bonus}🔫 Lasern laddas – ${decimal(redo)} skott redo`, ton: "bra" };
  }
  if (res.typ === "drag") {
    return { text: `${bonus}🌀 Din dragstråle fångar nästa meteor och slungar den mot ${dragMal(res, classId, session, status)}!`, ton: "bra" };
  }
  return {
    text: energi >= ENERGI_TAK ? `${bonus}⚡ Full energi (${ENERGI_TAK}) – använd den!` : `${bonus}⚡ Energin sparad – du har ${energi}.`,
    ton: "lugn",
  };
}

const HANDELSE_TEXT = {
  solstorm: "☀️ Solstorm! Dubbel energi",
  jattemeteor: "☄️ Jättemeteor på väg – ladda lasern!",
  kometsvans: "✨ Kometsvans! +1 energi per rätt svar",
  lugnet: "🌌 Lugnet – inga meteorer. Andas!",
};

/** Banderollen för en pågående händelse, med sekunder kvar. */
export function handelseRad(status, now, cfg = null) {
  const h = cfg ? handelseUrPlan(cfg, now) : status?.handelse;
  if (!h || !HANDELSE_TEXT[h.typ]) return null;
  const kvar = Math.ceil((Number(h.slutMs) - now) / 1000);
  if (!(kvar > 0)) return null;
  return { typ: h.typ, text: `${HANDELSE_TEXT[h.typ]} · ${kvar} s` };
}

export function stationRad(st) {
  if (!st) return "Stationen startar …";
  return `Skrov ${int(st.skrov)} · Sköld ${Math.round(Number(st.skold) || 0)}/${SKOLD_TAK}`;
}

export function lagesRad(st, namn = "") {
  if (!st) return "";
  if (st.flyter) return "🛰️ Stationen flyter i rymden – fortsätt skjuta, den tar ingen mer skada!";
  if (st.hjalp) return `🚀 ${namn ? `${namn} får` : "Ni får"} extra kraft – starkare sköld och billigare dragstråle!`;
  return "";
}

const STJARNA = (n) => "⭐".repeat(int(n)) + "☆".repeat(Math.max(0, 3 - int(n)));

/** Slutrubriken – ingen placering som nummer. */
export function slutet(result, classId, session) {
  if (!result) return { titel: "⏰ Stormen är över!", rad: "Stationerna räknas ihop …", vann: false };
  if (result.lage === "en-klass") {
    const n = int(result.stjarnor);
    return result.overlevde !== false && n > 0
      ? { titel: "Stationen överlevde stormen! 🚀", rad: STJARNA(n), vann: true, stjarnor: n }
      : { titel: "Bra kämpat! 🛰️", rad: "Stationen flyter i rymden – nästa storm klarar ni!", vann: false, stjarnor: 0 };
  }
  const skrov = (result.placering || []).map((p) => `${klassNamn(session, p.classId)} ${int(p.skrov)} %`).join(" · ");
  if (result.draw || !result.winner) return { titel: "Oavgjort! 🤝", rad: `Båda stationerna klarade sig lika bra. ${skrov}`, vann: false };
  if (result.winner === classId) return { titel: "Ni vann! 🚀", rad: `Skrov kvar: ${skrov}`, vann: true };
  return { titel: `Bra kämpat – ${klassNamn(session, result.winner)} vann den här gången`, rad: `Skrov kvar: ${skrov}`, vann: false };
}

const ggr = (n) => (n === 1 ? "en gång" : `${n} gånger`);
const lista = (d) => (d.length > 1 ? `${d.slice(0, -1).join(", ")} och ${d[d.length - 1]}` : d[0]);

/** Elevens eget bidrag ur result.ranking-raden (motorns bidrag + handlingar). */
export function bidragText(row) {
  if (!row) return "";
  const b = row.bidrag || {};
  const h = row.handlingar || {};
  const delar = [];
  if (int(b.nedskjutna)) delar.push(`sköt ner ${int(b.nedskjutna)} ${int(b.nedskjutna) === 1 ? "meteor" : "meteorer"}`);
  else if (int(h.laser)) delar.push(`laddade lasern ${ggr(int(h.laser))}`);
  if (int(h.skold)) delar.push(`laddade skölden ${ggr(int(h.skold))}`);
  if (int(b.kast)) delar.push(`slungade ${int(b.kast)} ${int(b.kast) === 1 ? "meteor" : "meteorer"} med dragstrålen`);
  if (delar.length) return `Du ${lista(delar)}.`;
  if (int(row.correct)) return `Du svarade rätt ${ggr(int(row.correct))} och sparade energin.`;
  return "Svara rätt nästa gång – varje rätt svar ger stationen energi!";
}

/** Myntens rader – placeringspriset heter stationens pris (aldrig "2:a"). */
export function myntRader(entry, lage) {
  if (!entry) return [];
  const rader = [];
  if (int(entry.prize)) rader.push({ label: lage === "en-klass" ? "⭐ Stjärnpris" : "🚀 Stationens pris", coins: int(entry.prize) });
  if (int(entry.correctCoins)) rader.push({ label: `${int(entry.correct)} rätt svar`, coins: int(entry.correctCoins) });
  return rader;
}
