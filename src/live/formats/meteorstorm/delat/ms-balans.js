// ============================================================================
// Meteorstormen (#820): ALLA tal i spelreglerna – en källa för motorn
// (ms-motor.js), stormplanen (ms-storm.js), servern (functions/meteorstorm/,
// genererad kopia) och balanssimuleringen (admin/ms-balans-sim.mjs). Justera
// spelet här, aldrig i motorn. Ren data + små rena hjälpare, inga importer.
//
// "PER ELEV" (samma tanke som Klassmatchens rätt ÷ nämnare):
//   Ett tryck på 🛡️/🔫 ger   effekt = KLASSVARV × 1 / aktiva
//   där KLASSVARV är effekten när VARJE aktiv elev i klassen tryckt en gång
//   (SKOLD_KLASSVARV sköld, LASER_KLASSVARV laserskott) och aktiva = stationens
//   antal aktiva elever (minst 1, fast för matchen – servern sätter det vid
//   start). En klass på 19 och en på 23 med samma andel rätt fyller alltså
//   mätarna lika fort per sekund. Dragstrålen skalas INTE: den begränsas per
//   station (en i taget + väntetid), så klassens storlek spelar ingen roll där.
//   Internt räknar motorn i heltal (tusendelar, MILLI) så att node och
//   webbläsare får exakt samma tal – perElevMilli() avrundar en gång.
//
// Tider i ms, skada/skrov/sköld i hela enheter (skrov 100, sköld tak 60).
// ============================================================================

/** Motorns fasta steg. Allt händer på stegtider startMs + n·STEG_MS. */
export const STEG_MS = 100;

/**
 * Projektorn ritar tillståndet för nu − RENDER_FORDROJNING_MS (Elias 2026-10-21):
 * handlingar som når projektorn sent (nät, Firestore-lyssnare) hinner in i
 * loggen innan deras tid ritas, så bilden behöver nästan aldrig "ångras".
 */
export const RENDER_FORDROJNING_MS = 1500;

/** Heltalsenheter: 1 sköld = 1000 milli, 1 laserskott = 1000 milli. */
export const MILLI = 1000;

// ---- Stationen (§2.1) ------------------------------------------------------
export const SKROV_START = 100;
export const SKOLD_START = 0;
export const SKOLD_TAK = 60;
export const LADDNING_TAK = 10; // laserskott

// ---- Energi och handlingar (§2.3) -------------------------------------------
export const ENERGI_PER_RATT = 1;
export const ENERGI_TAK = 5;
export const KOSTNAD = { skold: 1, laser: 1, drag: 3 };
/** Handlingstyper i loggen. "spara" påverkar inte stormen (energin är serverns). */
export const HANDLINGAR = ["skold", "laser", "drag", "spara"];

/** Klassens referensstorlek – bara för texter/sim ("en klass på 25"). */
export const REFERENS_ELEVER = 25;
/** Sköld när varje aktiv elev tryckt 🛡️ en gång (25 elever → 0,64 per tryck). */
export const SKOLD_KLASSVARV = 16;
/** Laserskott när varje aktiv elev tryckt 🔫 en gång (25 elever → 0,077 skott per tryck ≈ 13 tryck/skott). */
export const LASER_KLASSVARV = 1.92;

// ---- Stormen (§2.2) --------------------------------------------------------
/** Storlekar: skada och antal laserskott som krävs. */
export const STORLEKAR = {
  liten: { skada: 5, skott: 1 },
  mellan: { skada: 10, skott: 1 },
  stor: { skada: 20, skott: 2 },
  jatte: { skada: 30, skott: 6 },
};
/** En storlek större (Vilda attacker). Stor förblir stor. */
export const STORRE = { liten: "mellan", mellan: "stor", stor: "stor" };
/** Stormens storleksvikter (summa 1) – tidigt i matchen → sent. */
export const STORLEK_VIKTER_START = { liten: 0.72, mellan: 0.24, stor: 0.04 };
export const STORLEK_VIKTER_SLUT = { liten: 0.5, mellan: 0.35, stor: 0.15 };
/** Flygtid från kanten till stationen. */
export const METEOR_FLYGTID_MS = 8000;
/** Lasern avfyras mot en meteor först när den kommit så här långt (0–1). */
export const LASER_RACKVIDD = 0.3;
/** Högst så här många laserskott per station och steg (ett skott/100 ms). */
export const SKOTT_PER_STEG = 1;

/**
 * Intensiteten: meteorer per sekund (per station) som funktion av andel av
 * speltiden, styckvis linjär. Spegelvänd: alla stationer får samma lista.
 * Formen kommer ur balanssimuleringen (admin/ms-balans-sim.mjs, §2.3.2):
 * en lugn storm som växer till en topp strax före mitten (där en klass som
 * nästan inte svarar går under), ett andrum, och en kort, hård final de sista
 * ~35 s som avgör hur mycket skrov som är kvar. Finalen måste vara kort: en
 * full sköld + laddning (~145 skada) tar annars hela skillnaden mellan klasserna.
 */
export const INTENSITET = [
  [0.0, 0.05],
  [0.45, 0.062],
  [0.55, 0.055],
  [0.9, 0.055],
  [0.94, 0.72],
  [1.0, 0.72],
];
/** Inga nya meteorer de första ms (de sista släpps så att de hinner fram före slutet). */
export const STORM_FORDROJNING_MS = 4000;
/** Spridning i avståndet mellan meteorer (0 = jämnt, 1 = mycket ojämnt). */
export const STORM_SPRIDNING = 0.35;

// ---- Händelser (§2.4) --------------------------------------------------------
export const HANDELSE_TYPER = ["solstorm", "jattemeteor", "kometsvans", "lugnet"];
export const HANDELSE = {
  solstorm: { langdMs: 20_000, energiFaktor: 2, vikt: 1 },
  jattemeteor: { langdMs: 20_000, vikt: 1 }, // = jättemeteorns flygtid (nedräkningen)
  kometsvans: { langdMs: 10_000, energiBonus: 1, vikt: 1 },
  lugnet: { langdMs: 15_000, vikt: 1 },
};
/** Ungefär en händelse per 90 s: första start, avstånd start→start, marginal före slutet. */
export const HANDELSE_FORSTA_MS = [50_000, 80_000];
export const HANDELSE_AVSTAND_MS = [70_000, 110_000];
export const HANDELSE_PAUS_MS = 10_000; // minst så här länge mellan två händelser
/** Händelser bara före toppen (andel av speltiden) – annars avgör en händelse precis
 *  före finalen matchen och två frön blir olika svåra. */
export const HANDELSE_SENAST_ANDEL = 0.78;
/** Ingen jättemeteor innan klasserna hunnit bygga upp något försvar. */
export const JATTEMETEOR_TIDIGAST_MS = 150_000;

// ---- Dragstrålen (§2.3, §2.6) -------------------------------------------------
export const ATTACKER = {
  av: { drag: false },
  milda: { drag: true, kostnad: 3, vantetidMs: 10_000, storre: false },
  vilda: { drag: true, kostnad: 2, vantetidMs: 6000, storre: true },
};
export const ATTACKER_STANDARD = "milda";
export const KAST_FLYGTID_MS = 6000;
/** Ingen dragstråle de sista ms – en slungad meteor ska hinna fram före slutet. */
export const DRAG_STOPP_FORE_SLUT_MS = KAST_FLYGTID_MS;
export const LAGEN = ["en-klass", "klass-mot-klass"];
export const LAGE_STANDARD = "klass-mot-klass";

// ---- Hjälp till den som ligger efter (§2.5) ------------------------------------
export const HJALP_SKILLNAD = 20;
export const HJALP_DRAG_KOSTNAD = 2;
export const HJALP_SKOLD_FAKTOR = 1.25;

// ---- Speltid och slut (§2.6, §2.7) ------------------------------------------
export const SPELTID_MIN_MS = 5 * 60_000;
export const SPELTID_MAX_MS = 20 * 60_000;
export const SPELTID_STANDARD_MS = 10 * 60_000;
/** En klass: ⭐ med skrovet kvar, ⭐⭐ ≥ 50, ⭐⭐⭐ ≥ 80. */
export const STJARNOR = [
  [80, 3],
  [50, 2],
  [0.001, 1],
];
/** Arkitekturen klarar 1–4 stationer; formatet erbjuder 1–2 än så länge. */
export const MAX_STATIONER = 4;

// ---- Rena hjälpare ---------------------------------------------------------

/** Aktiva elever → heltal ≥ 1. */
export function aktivaElever(n) {
  const v = Math.floor(Number(n) || 0);
  return v >= 1 ? v : 1;
}

/** "Per elev"-formeln i heltal: klassvarv × MILLI / aktiva, avrundat. */
export function perElevMilli(klassvarv, aktiva) {
  return Math.round((klassvarv * MILLI) / aktivaElever(aktiva));
}

/** Lärarens inställningar → normaliserade (okänt → standard). */
export function normInstallningar(inst = {}) {
  const lage = LAGEN.includes(inst?.lage) ? inst.lage : LAGE_STANDARD;
  const attacker = lage === "en-klass" ? "av" : (ATTACKER[inst?.attacker] ? inst.attacker : ATTACKER_STANDARD);
  return { lage, attacker };
}

/** Stjärnor i läget En klass för ett skrov (0–100). */
export function stjarnorFor(skrov) {
  for (const [grans, n] of STJARNOR) if (skrov >= grans) return n;
  return 0;
}
