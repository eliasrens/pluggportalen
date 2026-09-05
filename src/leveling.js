// ============================================================================
// Pluggportalen – erfarenhets-/nivåsystem (leveling.js)
// ----------------------------------------------------------------------------
// Ren logik (inga Firestore-anrop): hur mycket XP en övning ger, hur XP räknas
// om till NIVÅ, och hjälpare för att härleda XP ur befintlig progress
// (migrering för elever som spelat innan xp-fältet fanns).
//
// XP samlas kumulativt i studentData.xp. Nivåkurvan är STIGANDE och HAR INGEN
// MAXNIVÅ – nivåerna fortsätter uppåt hur långt som helst. Evolutionsstegen
// (evolution.js) baseras på nivån, inte längre direkt på stjärnor.
// ============================================================================

// ---------------------------------------------------------------------------
// XP-KÄLLA – hur mycket en avklarad övning ger.
//   basXP  : grundpott bara för att klara övningen
//   perStar: bonus per stjärna (1–3) man fick
// En förstagångs-3-stjärnig övning ger alltså 20 + 3×10 = 50 XP. Vid OMSPEL
// ges 80 % (medvetet produktbeslut, samma mönster som coins) – se game-shared.js.
// Justera dessa två tal för att göra det snabbare/långsammare att levla.
// ---------------------------------------------------------------------------
export const XP_BASE = 20;
export const XP_PER_STAR = 10;

/** Full XP (förstagång) för en avklarad övning med `stars` stjärnor. */
export function xpForExercise(stars = 0) {
  const s = Math.max(0, Math.round(Number(stars) || 0));
  return XP_BASE + s * XP_PER_STAR;
}

// ---------------------------------------------------------------------------
// NIVÅKURVA (obegränsad, stigande)
// ----------------------------------------------------------------------------
// Kostnaden att gå FRÅN nivå L till L+1 ökar linjärt: gap(L) = 40 + 20·(L−1).
// Summan blir en kvadratisk tröskelkurva:
//     xpForLevel(L) = 10 · (L−1) · (L+2)
// dvs den KUMULATIVA XP som krävs för att ha NÅTT nivå L (nivå 1 = 0 XP).
//
// Kommenterad tabell (lätt att justera – ändra bara XP_BASE/XP_PER_STAR ovan
// för potten per övning, eller formeln här för brantheten):
//   Nivå  Kum. XP   ≈ förstagångs-3⭐-övningar (50 XP styck)
//    1        0        start
//    2       40        ~1
//    3      100        ~2
//    4      180        ~4
//    5      280        ~6      ← evolutionssteg 2 (se evolution.js)
//    6      400        ~8
//    7      540       ~11
//    8      700       ~14
//    9      880       ~18
//   10     1080       ~22
//   11     1300       ~26
//   12     1540       ~31      ← evolutionssteg 3 (grenval)
//   13     1800       ~36
//   14     2080       ~42
//   15     2380       ~48
// Kurvan växer utan tak. Talen håller sig långt under Number.MAX_SAFE_INTEGER
// (≈ 9·10¹⁵) för alla rimliga nivåer – 10·L² når inte dit förrän L ≈ 3·10⁷ –
// så inget heltalsspill i praktiken.
// ---------------------------------------------------------------------------

/** Kumulativ XP som krävs för att ha nått nivå L (L ≥ 1). */
export function xpForLevel(L) {
  const n = Math.max(1, Math.floor(Number(L) || 1));
  return 10 * (n - 1) * (n + 2);
}

/** Nivån (≥ 1) som `xp` XP räcker till. */
export function levelForXp(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  // Sluten invers av xpForLevel: x = 10(L−1)(L+2) ⇒ L = (−1 + √(9 + 0.4x)) / 2.
  // Vi startar där och korrigerar ±1 så flyttalsavrundning aldrig ger fel nivå.
  let L = Math.floor((-1 + Math.sqrt(9 + 0.4 * x)) / 2) + 1;
  if (L < 1) L = 1;
  while (xpForLevel(L + 1) <= x) L++;
  while (L > 1 && xpForLevel(L) > x) L--;
  return L;
}

/**
 * Nivån + var i nivån man är.
 * @returns {{level:number, intoLevel:number, neededForNext:number,
 *            progressRatio:number, xp:number}}
 */
export function xpIntoLevel(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelForXp(x);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const neededForNext = ceil - floor;
  const intoLevel = x - floor;
  return {
    level,
    intoLevel,
    neededForNext,
    progressRatio: neededForNext > 0 ? intoLevel / neededForNext : 0,
    xp: x,
  };
}

// ---------------------------------------------------------------------------
// MIGRERING / FALLBACK
// ----------------------------------------------------------------------------
// Elever som spelade innan xp-fältet fanns har bara progress/stjärnor. Härled
// ett start-XP ur progressen med SAMMA formel som en förstagångsövning, så
// ingen nollställs till nivå 1: summa (avklarad övning × basXP + stjärnor ×
// perStar). Robust mot trasiga/tomma objekt.
// ---------------------------------------------------------------------------

/** Härlett XP ur ett progress-objekt (för elever utan sparat xp-fält). */
export function xpFromProgress(progress = {}) {
  let xp = 0;
  for (const modes of Object.values(progress || {})) {
    for (const r of Object.values(modes || {})) {
      if (!r || typeof r !== "object") continue;
      if (r.completed) xp += XP_BASE;
      if (typeof r.stars === "number") xp += Math.max(0, r.stars) * XP_PER_STAR;
    }
  }
  return xp;
}

/**
 * XP för ett studentData-dokument: det sparade xp-fältet om det finns, annars
 * härlett ur progress (fallback/migrering).
 */
export function xpFromStudentData(sd) {
  if (sd && typeof sd.xp === "number" && sd.xp >= 0) return sd.xp;
  return xpFromProgress(sd?.progress);
}
