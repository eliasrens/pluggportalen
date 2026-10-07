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
//   Stegkostnaden växer med faktorn R = 1,5 per nivå från S1 = 6,8 per elev
//   (brantare trappa, beslut Elias 2026-10-07 – första steget oförändrat):
//     steg:     7  10  15  23  35  51  78 116 174   (per elev)
//     kumulativt: 0, 7, 17, 32, 55, 90, 141, 219, 335, 509
//   Med 8/vecka: Nivå 2 efter ~1 vecka (snabb första belöning), Nivå 5 ~v. 7,
//   Nivå 7 ~v. 18 och Nivå 8 ~v. 28. Nivå 10 (509/elev) kräver ~64 veckor i
//   den takten – hela läsåret och mer, medvetet svårt. Aktiva klasser (som
//   pluggar mycket mer än snittet) når toppen under läsåret; mindre aktiva
//   stannar runt Nivå 7–8.
//
//   Trösklarna räknas med formeln per index i NIVAER, så en ny nivå får sin
//   tröskel automatiskt (nivå 11 ≈ 770/elev, nivå 12 ≈ 1 160/elev).
//
// SÅ LÄGGER DU TILL EN NIVÅ (11, 12 …) – bara två ändringar:
//   1. En ny post sist i NIVAER nedan ({ niva, id, namn, emoji, beskrivning }).
//   2. En ny rit-funktion för nivån i art-modulen (art-klasscenter-sen.js eller
//      en ny del-modul som art-klasscenter.js sprider in i MARKUP).
//   Allt annat (trösklar, nivaFor, mätare, "Maxnivå", art-listan, preview-
//   knappar, tester) följer listans längd. test/art-klasscenter.test.js
//   failar om en nivå saknar rit-funktion. Ingen nivågräns finns i
//   firestore.rules – nivån härleds i klienten ur expTotal.
//
// API
//   NIVAER                              → [{ niva, id, namn, emoji, beskrivning }]
//   MAX_NIVA                            → NIVAER.length
//   TROSKLAR_PER_ELEV                   → number[MAX_NIVA] (kumulativt, nivå 1 = 0)
//   troskelFor(niva, antalElever)       → klass-EXP som krävs för nivån
//   nivaFor(exp, antalElever)           → 1..MAX_NIVA
//   skapaNivatrappa(nivaer)             → samma API för en godtycklig lista
//   progressTillNasta(exp, antalElever) → { niva, namn, nuvarande, mal, kvar,
//                                           nasta, nastaNamn, andel, max }
//   matarText(progress)                 → "50 / 175 övningar till Nivå 2"
// ============================================================================

export const NIVAER = Object.freeze([
  { niva: 1, id: "lagereld", namn: "Lägereld", emoji: "🔥", beskrivning: "Lägereld med stockar" },
  { niva: 2, id: "talt", namn: "Tält", emoji: "⛺", beskrivning: "Tält av grenar och tyg" },
  { niva: 3, id: "trakoja", namn: "Träkoja", emoji: "🛖", beskrivning: "Liten enkel träkoja" },
  { niva: 4, id: "timmerstuga", namn: "Timmerstuga", emoji: "🏡", beskrivning: "Stabil timmerstuga med rykande skorsten" },
  { niva: 5, id: "stenbyhus", namn: "Stenbyhus", emoji: "🏠", beskrivning: "Byhus i sten med tegelpannor och en liten anslagstavla" },
  { niva: 6, id: "radhus", namn: "Rådhus", emoji: "🏛️", beskrivning: "Rådhus med pelare och klocktorn" },
  { niva: 7, id: "borg", namn: "Borg", emoji: "🛡️", beskrivning: "Mindre borg med stenmurar och klassens fana" },
  { niva: 8, id: "slott", namn: "Slott", emoji: "🏰", beskrivning: "Ståtligt slott med tinnar och torn" },
  { niva: 9, id: "hogkvarter", namn: "Högkvarter", emoji: "🏢", beskrivning: "Modernt skinande högkvarter i glas och stål" },
  { niva: 10, id: "kristallpalats", namn: "Kristallpalats", emoji: "💎", beskrivning: "Episkt futuristiskt kristallpalats" },
].map(Object.freeze));

/** Första stegets kostnad per elev och tillväxtfaktorn per nivå (se huvudet). */
export const STEG1_PER_ELEV = 6.8;
export const TILLVAXT = 1.5;

function elever(antalElever) {
  const n = Math.floor(Number(antalElever) || 0);
  return Math.max(1, n);
}

function expAv(exp) {
  const n = Math.floor(Number(exp) || 0);
  return Math.max(0, n);
}

/**
 * Bygger hela trappan ur en nivålista – inget antar ett visst antal nivåer.
 * Exporteras så testerna kan prova en längre lista (t.ex. 11 nivåer).
 */
export function skapaNivatrappa(nivaer) {
  const maxNiva = nivaer.length;
  const trosklar = Object.freeze(
    nivaer.map((_, i) => Math.round((STEG1_PER_ELEV * (TILLVAXT ** i - 1)) / (TILLVAXT - 1)))
  );

  /** Klass-EXP som krävs för att NÅ nivån (nivå 1 = 0). */
  function troskelFor(niva, antalElever) {
    const i = Math.min(maxNiva, Math.max(1, Math.floor(Number(niva) || 1))) - 1;
    return Math.ceil(trosklar[i] * elever(antalElever));
  }

  /** Klassens nivå (1..MAX_NIVA) för en given klass-EXP och elevantal. */
  function nivaFor(exp, antalElever) {
    const e = expAv(exp);
    let niva = 1;
    for (let n = 2; n <= maxNiva; n++) {
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
  function progressTillNasta(exp, antalElever) {
    const e = expAv(exp);
    const niva = nivaFor(e, antalElever);
    const namn = nivaer[niva - 1].namn;
    if (niva >= maxNiva) {
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
      nastaNamn: nivaer[niva].namn,
      andel,
      max: false,
    };
  }

  return { MAX_NIVA: maxNiva, TROSKLAR_PER_ELEV: trosklar, troskelFor, nivaFor, progressTillNasta };
}

const TRAPPA = skapaNivatrappa(NIVAER);

export const MAX_NIVA = TRAPPA.MAX_NIVA;
/** Kumulativa trösklar per elev: [0, 7, 17, 32, 55, 90, 141, 219, 335, 509]. */
export const TROSKLAR_PER_ELEV = TRAPPA.TROSKLAR_PER_ELEV;
export const { troskelFor, nivaFor, progressTillNasta } = TRAPPA;

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
