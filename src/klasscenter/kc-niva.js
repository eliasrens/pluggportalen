// ============================================================================
// Klasscentret – nivåtrappan (#477, epic #476). REN logik, inga DOM-/Firebase-
// beroenden → testas i Node (test/kc-niva.test.js). Spec: docs/spec-klasscentret.md §2–3.
// ----------------------------------------------------------------------------
// NORMALISERING (beslut Elias 2026-10-07: "per elev, som Klasskampen"):
//   Vi SKALAR TRÖSKLARNA med elevantalet: nivå n kräver
//     ceil(TROSKLAR_PER_ELEV[n-1] × antalElever)  avklarade övningar (klass-EXP).
//   Matematiskt samma sak som att jämföra EXP / antalElever mot trösklarna per
//   elev – men mätaren kan då visa HELA klassens tal ("50 / 175 övningar till
//   Nivå 2"), vilket är begripligare för barn än "2,1 / 7 per elev". En klass
//   med 14 elever och en med 28 som pluggar i samma takt per elev når alltså
//   varje nivå samma vecka. antalElever = classes/{id}.studentIds.length (≥ 1).
//   Byts elevantalet mitt i läsåret flyttas trösklarna med (nivån härleds alltid
//   ur nuvarande antal – se DATAMODELL.md "Klasscentret" om ev. golvnivå).
//
// TRÖSKLARNA (exponentiella, ska räcka ETT läsår):
//   Antagande: en genomsnittlig elev ger ~8 klass-EXP/vecka (2–3 pluggpass à
//   ~3 räknande omgångar: quiz-omgång ≥ 50 %, Läsresan-text, 10 rätt i Räkna,
//   första Memory-gångerna …) × ~36 läsårsveckor ≈ 290 per elev och år.
//   Stegkostnaden växer med faktorn R = 1,35 per nivå från S1 = 6,8 per elev:
//     steg:     7   9  12  17  23  30  41  56  75   (per elev)
//     kumulativt: 0, 7, 16, 28, 45, 68, 98, 139, 195, 270
//   Med 8/vecka: Nivå 2 efter ~1 vecka (snabb första belöning), Nivå 5 ~v. 6,
//   Nivå 7 ~v. 12, Nivå 9 ~v. 24 och Nivå 10 (270/elev) först ~v. 34 – alltså
//   i slutet av läsåret. En klass i halva takten (4/vecka) når Nivå 8–9.
//
// API
//   NIVAER                              → [{ niva, id, namn, beskrivning }] (10 st)
//   TROSKLAR_PER_ELEV                   → number[10] (kumulativt, nivå 1 = 0)
//   troskelFor(niva, antalElever)       → klass-EXP som krävs för nivån
//   nivaFor(exp, antalElever)           → 1..10
//   progressTillNasta(exp, antalElever) → { niva, namn, nuvarande, mal, kvar,
//                                           nasta, nastaNamn, andel, max }
//   matarText(progress)                 → "50 / 175 övningar till Nivå 2"
// ============================================================================

export const NIVAER = Object.freeze([
  { niva: 1, id: "lagereld", namn: "Lägereld", beskrivning: "Lägereld med stockar" },
  { niva: 2, id: "talt", namn: "Tält", beskrivning: "Tält av grenar och tyg" },
  { niva: 3, id: "trakoja", namn: "Träkoja", beskrivning: "Liten enkel träkoja" },
  { niva: 4, id: "timmerstuga", namn: "Timmerstuga", beskrivning: "Stabil timmerstuga med rykande skorsten" },
  { niva: 5, id: "stenbyhus", namn: "Stenbyhus", beskrivning: "Byhus i sten med tegelpannor och en liten anslagstavla" },
  { niva: 6, id: "radhus", namn: "Rådhus", beskrivning: "Rådhus med pelare och klocktorn" },
  { niva: 7, id: "borg", namn: "Borg", beskrivning: "Mindre borg med stenmurar och klassens fana" },
  { niva: 8, id: "slott", namn: "Slott", beskrivning: "Ståtligt slott med tinnar och torn" },
  { niva: 9, id: "hogkvarter", namn: "Högkvarter", beskrivning: "Modernt skinande högkvarter i glas och stål" },
  { niva: 10, id: "kristallpalats", namn: "Kristallpalats", beskrivning: "Episkt futuristiskt kristallpalats" },
].map(Object.freeze));

export const MAX_NIVA = NIVAER.length;

/** Första stegets kostnad per elev och tillväxtfaktorn per nivå (se huvudet). */
export const STEG1_PER_ELEV = 6.8;
export const TILLVAXT = 1.35;

/** Kumulativa trösklar per elev: [0, 7, 16, 28, 45, 68, 98, 139, 195, 270]. */
export const TROSKLAR_PER_ELEV = Object.freeze(
  NIVAER.map((_, i) => Math.round((STEG1_PER_ELEV * (TILLVAXT ** i - 1)) / (TILLVAXT - 1)))
);

function elever(antalElever) {
  const n = Math.floor(Number(antalElever) || 0);
  return Math.max(1, n);
}

function expAv(exp) {
  const n = Math.floor(Number(exp) || 0);
  return Math.max(0, n);
}

/** Klass-EXP som krävs för att NÅ nivån (nivå 1 = 0). */
export function troskelFor(niva, antalElever) {
  const i = Math.min(MAX_NIVA, Math.max(1, Math.floor(Number(niva) || 1))) - 1;
  return Math.ceil(TROSKLAR_PER_ELEV[i] * elever(antalElever));
}

/** Klassens nivå (1..10) för en given klass-EXP och elevantal. */
export function nivaFor(exp, antalElever) {
  const e = expAv(exp);
  let niva = 1;
  for (let n = 2; n <= MAX_NIVA; n++) {
    if (e >= troskelFor(n, antalElever)) niva = n;
    else break;
  }
  return niva;
}

/**
 * Underlag för mätaren över byggnaden.
 * nuvarande/mal är HELA klassens kumulativa tal (mal = tröskeln till nästa
 * nivå); andel = hur långt klassen kommit INOM nuvarande nivå (0..1, för
 * stapeln). På högsta nivån: mal = null, kvar = 0, max = true, andel = 1.
 */
export function progressTillNasta(exp, antalElever) {
  const e = expAv(exp);
  const niva = nivaFor(e, antalElever);
  const namn = NIVAER[niva - 1].namn;
  if (niva >= MAX_NIVA) {
    return { niva, namn, nuvarande: e, mal: null, kvar: 0, nasta: null, nastaNamn: null, andel: 1, max: true };
  }
  const fran = troskelFor(niva, antalElever);
  const mal = troskelFor(niva + 1, antalElever);
  const andel = mal > fran ? Math.min(1, Math.max(0, (e - fran) / (mal - fran))) : 0;
  return {
    niva,
    namn,
    nuvarande: e,
    mal,
    kvar: mal - e,
    nasta: niva + 1,
    nastaNamn: NIVAER[niva].namn,
    andel,
    max: false,
  };
}

/** Tusentalsavgränsning med hårt mellanslag ("12 345"), som svensk text. */
function tal(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Mätartexten: "50 / 175 övningar till Nivå 2" (eller högsta nivån nådd). */
export function matarText(p) {
  if (!p) return "";
  if (p.max) return `${tal(p.nuvarande)} övningar – högsta nivån nådd!`;
  return `${tal(p.nuvarande)} / ${tal(p.mal)} övningar till Nivå ${p.nasta}`;
}
