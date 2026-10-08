// ============================================================================
// Klasscentret – EXP-regelregistret (#477, epic #476). REN logik, inga DOM-/
// Firebase-beroenden → testas i Node (test/kc-exp-regler.test.js).
// ----------------------------------------------------------------------------
// Klass-EXP räknas i "avklarade övningar". BESLUT (Elias 2026-10-07): inget
// dagstak – i stället registrerar VARJE modul när något räknas som en
// avklarad övning. En ny modul lägger bara till sin regel här (eller anropar
// registreraRegel från sin egen, dynamiskt laddade modul).
//
// En regel = { beskrivning, exp(resultat, ctx) → heltal ≥ 0,
//              raknare?(resultat, ctx) → { nyckel: nyttVärde } }
//   resultat  modulens utfall av EN omgång (form per regel nedan)
//   ctx       { area?: string, raknare?: { [nyckel]: number } }
//             raknare = elevens per-klass-räknare (expMembers/{uid}.counts,
//             se DATAMODELL.md) – används av "3 första gångerna" och Räkna-
//             lägets "10 rätt = 1" så inget går förlorat mellan omgångar.
//   raknare() returnerar de räknar-värden som ska SPARAS efter omgången (skrivs
//   i SAMMA transaktion som EXP:n, kc-exp-data.js).
//
// Reglerna (spec §2):
//   quiz, lasforstaelse     { ratt, totalt }  → 1 om ratt/totalt ≥ 50 %, annars 0
//   para, memory, kunskapsjakt, sanningsjakt, lastext, aventyr
//                           { klar? }         → 1 de 3 första gångerna per
//                                               område och elev (räknare
//                                               "<modul>|<area>"), sedan 0
//   lasresan                { ratt, totalt=7 } → 1 om ratt/totalt ≥ 5/7
//   mattematchen            { rattFore, rattEfter } (elevens kumulativa rätt i
//                           tävlingen) → antal passerade 20-gränser (var 20:e rätt)
//   rakna                   { ratt } (rätt i omgången) → 1 per 10 rätt, med
//                           rest som sparas i räknaren "rakna|ratt"
//   Live/klassutmaningar ger INGEN elev-EXP här – läraren/flödet delar ut en
//   klassbonus (klassBonusFor + awardClassBonus i kc-exp-data.js).
//
// API
//   registreraRegel(modul, regel)       lägg till/ersätt en modulregel
//   harRegel(modul) → bool              listaRegler() → [{ modul, beskrivning }]
//   modulFor(mode)                      spelläges-id → regelmodul ("aventyr:x" → "aventyr")
//   klassExpFor(modul, resultat, ctx)   → antal (heltal ≥ 0; okänd modul = 0)
//   planKlassExp(modul, resultat, ctx)  → { antal, raknare: {…} | null }
//   klassBonusFor(kalla, antalElever)   → klassbonus (heltal) för en klasshändelse
// ============================================================================

/** Hur många gånger per område och elev "upprepningslägen" ger EXP. */
export const FORSTA_GANGER = 3;
/** Mattematchen: var 20:e rätt svar = 1 avklarad övning. */
export const MM_RATT_PER_EXP = 20;
/** Räkna-läget (generatorn): 10 rätt = 1 avklarad övning. */
export const RAKNA_RATT_PER_EXP = 10;
/** Läsresan: en text räknas vid minst 5 av 7 rätt. */
export const LASRESAN_KRAV = { ratt: 5, av: 7 };

/**
 * Klassbonus (Live/lärarledda klassutmaningar), i övningar PER ELEV – skalas
 * med elevantalet så bonusen flyttar mätaren lika långt i små och stora klasser.
 */
export const KLASSBONUS_PER_ELEV = Object.freeze({
  live: 3, // Live-match avklarad
  "live-vinst": 5, // Live-match vunnen
  klassutmaning: 5, // lärarledd klassutmaning klar
  "mm-vinst": 10, // Klasskampen vunnen när Mattematchen avslutas
});

const REGLER = new Map();

function heltal(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Lägg till (eller ersätt) en modulregel. */
export function registreraRegel(modul, regel) {
  if (!modul || typeof modul !== "string") throw new Error("registreraRegel: modul-id saknas");
  if (!regel || typeof regel.exp !== "function") throw new Error(`registreraRegel(${modul}): exp() saknas`);
  REGLER.set(modul, Object.freeze({ beskrivning: "", ...regel }));
}

export function harRegel(modul) {
  return REGLER.has(modul);
}

export function listaRegler() {
  return [...REGLER].map(([modul, r]) => ({ modul, beskrivning: r.beskrivning }));
}

/** Spellägets id → regelmodul. Äventyrsbanor heter "aventyr:<id>" (gamemodes.js). */
export function modulFor(mode) {
  const m = String(mode || "");
  return m.startsWith("aventyr:") ? "aventyr" : m;
}

function raknareAv(ctx) {
  return ctx && ctx.raknare && typeof ctx.raknare === "object" ? ctx.raknare : {};
}

/** Antal klass-EXP som omgången ger (heltal ≥ 0). Okänd modul → 0. */
export function klassExpFor(modul, resultat, ctx = {}) {
  return planKlassExp(modul, resultat, ctx).antal;
}

/** Antal klass-EXP + räknarvärden att spara efter omgången. */
export function planKlassExp(modul, resultat, ctx = {}) {
  const regel = REGLER.get(modulFor(modul));
  if (!regel) return { antal: 0, raknare: null };
  const r = resultat && typeof resultat === "object" ? resultat : {};
  const antal = heltal(regel.exp(r, ctx || {}));
  const raknare = regel.raknare ? regel.raknare(r, ctx || {}) || null : null;
  return { antal, raknare };
}

/** Klassbonus för en klasshändelse (okänd källa = 0). */
export function klassBonusFor(kalla, antalElever) {
  const perElev = KLASSBONUS_PER_ELEV[kalla] || 0;
  return perElev * Math.max(1, Math.floor(Number(antalElever) || 0));
}

// ---------------------------------------------------------------------------
// Regelfabriker + de inbyggda reglerna
// ---------------------------------------------------------------------------

/** ≥ andel rätt på omgången. Jämförs i heltal (ratt·av ≥ krav·totalt) → inga flyttalsfel. */
function andelRegel(beskrivning, krav, av, standardTotalt) {
  return {
    beskrivning,
    exp({ ratt, totalt = standardTotalt }) {
      const r = Math.max(0, Number(ratt) || 0);
      const t = Number(totalt) || 0;
      if (t <= 0 || r > t) return 0;
      return r * av >= krav * t ? 1 : 0;
    },
  };
}

/** EXP bara de FORSTA_GANGER första avklarade gångerna per område och elev. */
function forstaGangerRegel(modul, beskrivning) {
  const nyckel = (ctx) => `${modul}|${ctx.area || "-"}`;
  const tidigare = (ctx) => Math.max(0, Math.floor(Number(raknareAv(ctx)[nyckel(ctx)]) || 0));
  return {
    beskrivning,
    exp(r, ctx) {
      if (r.klar === false) return 0;
      return tidigare(ctx) < FORSTA_GANGER ? 1 : 0;
    },
    raknare(r, ctx) {
      if (r.klar === false) return null;
      const n = tidigare(ctx);
      // Räknaren slutar växa vid taket – mer behövs aldrig.
      return n < FORSTA_GANGER ? { [nyckel(ctx)]: n + 1 } : null;
    },
  };
}

/** Antal passerade "steg"-gränser mellan två kumulativa tal (var N:e = 1). */
function passeradeGranser(fore, efter, steg) {
  const f = Math.max(0, Math.floor(Number(fore) || 0));
  const e = Math.max(0, Math.floor(Number(efter) || 0));
  if (e <= f) return 0;
  return Math.floor(e / steg) - Math.floor(f / steg);
}

registreraRegel("quiz", andelRegel("Quiz: varje omgång med minst 50 % rätt", 1, 2));
registreraRegel(
  "lasforstaelse",
  andelRegel("Läsförståelse: varje omgång med minst 50 % rätt", 1, 2)
);
for (const [modul, namn] of [
  ["para", "Para ihop"],
  ["memory", "Memory"],
  ["kunskapsjakt", "Kunskapsjakten"],
  ["sanningsjakt", "Fånga sanningar"],
  ["lastext", "Lästext"],
  ["aventyr", "Äventyr"],
]) {
  registreraRegel(
    modul,
    forstaGangerRegel(modul, `${namn}: de ${FORSTA_GANGER} första gångerna per område`)
  );
}
registreraRegel(
  "lasresan",
  andelRegel(
    `Läsresan: en text med minst ${LASRESAN_KRAV.ratt}/${LASRESAN_KRAV.av} rätt`,
    LASRESAN_KRAV.ratt,
    LASRESAN_KRAV.av,
    LASRESAN_KRAV.av
  )
);
registreraRegel("mattematchen", {
  beskrivning: `Mattematchen: var ${MM_RATT_PER_EXP}:e rätt svar`,
  exp: ({ rattFore, rattEfter }) => passeradeGranser(rattFore, rattEfter, MM_RATT_PER_EXP),
});
registreraRegel("rakna", {
  beskrivning: `Räkna: ${RAKNA_RATT_PER_EXP} rätt = 1 (resten sparas till nästa omgång)`,
  exp({ ratt }, ctx) {
    const fore = Number(raknareAv(ctx)["rakna|ratt"]) || 0;
    return passeradeGranser(fore, fore + heltal(ratt), RAKNA_RATT_PER_EXP);
  },
  raknare({ ratt }, ctx) {
    const n = heltal(ratt);
    if (!n) return null;
    // Bara resten behöver sparas (räknaren växer inte obegränsat).
    const fore = Math.max(0, Math.floor(Number(raknareAv(ctx)["rakna|ratt"]) || 0));
    return { "rakna|ratt": (fore + n) % RAKNA_RATT_PER_EXP };
  },
});
