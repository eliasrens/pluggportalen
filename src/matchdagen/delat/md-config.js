// ============================================================================
// Matchdagen (#868, Etapp 1b): ALLA tal i spelreglerna – en källa för motorn
// (md-motor.js), ligan (md-liga.js), klienten (Etapp 1c), servern (Etapp 4,
// functions/matchdagen/ blir en kopia av delat/) och balanssimuleringen
// (admin/md-balans-sim.mjs). Justera spelet här, aldrig i motorn. Ren data,
// inga importer. Kontraktet: docs/MATCHDAGEN.md (där står också vilka tal
// balansen har ändrat mot specen, docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §12).
//
// Planen: x 0–100 (0 = vårt mål, 100 = deras mål), y 0–68. "Fram" för oss är +x.
// Sannolikheter 0–1. Matchminuter i speltid, sekunder i verklig tid.
// ============================================================================

// ---- Matchklockan (spec §3.1) -----------------------------------------------
/** En halvlek är så här många matchminuter, och matchen har två. */
export const HALVLEK_MIN = 45;
export const HALVLEKAR = 2;
/** Varje läge flyttar klockan fram så här många matchminuter (likformigt). */
export const STEG_MIN = { min: 1.8, max: 2.9 };
/** Planens mått (x längs planen, y tvärs över). */
export const PLAN = { langd: 100, bredd: 68 };
/** Avspark från mitten (efter mål och i varje halvlek). */
export const AVSPARK = { x: 50, y: 34 };
/** Bollen hålls innanför planen (x), och y slumpas så här mycket per förflyttning. */
export const X_GRANS = { min: 2, max: 98 };
export const Y_GRANS = { min: 8, max: 60 };
export const Y_SVAJ = 12;

// ---- När vi har bollen (spec §3.2) ------------------------------------------
/**
 * Passen: chans vid rätt / fel svar och hur långt bollen går (fram, likformigt).
 * Chansen justeras med + lagbonus (mittfältet) − motståndarstyrka × PASS_STYRKA.
 */
export const PASS = {
  kort: { ratt: 0.9, fel: 0.6, fram: { min: 17, max: 23 } },
  lang: { ratt: 0.72, fel: 0.25, fram: { min: 25, max: 35 } },
  dribbla: { ratt: 0.68, fel: 0.3, fram: { min: 18, max: 23 } },
};
/** "− motståndarens styrka × faktor" för passen (skissen: 0,18). */
export const PASS_STYRKA = 0.18;
/** Ett brutet pass: motståndaren tar bollen där den är, några meter fram. */
export const BRUTET_FRAM = { min: 2, max: 6 };

/** Skott: bara när d = 100 − x är högst så här långt. */
export const SKOTT_MAX_D = 45;
/** Knappens text: d > langt → "Långt skott – liten chans", d > bra → "Bra läge", annars "Jätteläge!". */
export const SKOTT_LAGE = { langt: 28, bra: 15 };
/**
 * Målchansen vid rätt svar: kl(bas − d × perMeter; min; max) × (1 − styrka × styrka-faktor) + anfallsbonus.
 * Vid fel svar: fel. Från Division 3 (två frågor): fel på den första (finten) ger fintFel (§7.3).
 */
export const SKOTT = { bas: 1, perMeter: 0.023, min: 0.03, max: 0.8, styrka: 0.35, fel: 0.15, fintFel: 0.03 };
/** Inte mål: vikterna för hur skottet slutar (rätt svar / fel svar). */
export const SKOTT_MISS = {
  ratt: { raddning: 1, stolpe: 1, utanfor: 1 },
  fel: { raddning: 1, utanfor: 1 },
};
/** Efter en räddning efter rätt svar blir det hörna så här ofta: ett nytt skottläge nära mål. */
export const HORNA_CHANS = 0.45;
export const HORNA = { x: 92, y: 6 };
/** Från den här divisionen (div 3 = Division 3) kräver ett skott två rätt i rad (spec §7.3). */
export const DUBBEL_SKOTT_FRAN_DIV = 3;

// ---- Straffar (spec §7.4) ------------------------------------------------------
/**
 * Straffläggningen efter ett oavgjort kval (och i Etapp 2c–3 cup och Mästarcupen):
 * antal straffar var, sedan sudden death. Vi skjuter först i varje omgång.
 * egen = vår straff går in vid rätt / fel svar; deras = deras straff går in när
 * eleven svarar rätt / fel på "Kan målvakten rädda?". Efter max omgångar i
 * sudden death (praktiskt taget omöjligt) vinner vi – ingen ändlös straffläggning.
 */
export const STRAFFAR = { antal: 5, max: 30, egen: { ratt: 0.82, fel: 0.2 }, deras: { ratt: 0.45, fel: 0.85 } };
/** Inte mål på straff: vikterna för hur den slutar (vår straff vid rätt / fel svar, deras straff vid rätt / fel). */
export const STRAFF_MISS = {
  egen: { ratt: { raddning: 2, stolpe: 1, utanfor: 1 }, fel: { raddning: 1, utanfor: 1 } },
  deras: { ratt: { raddning: 3, stolpe: 1 }, fel: { raddning: 1, utanfor: 1 } },
};
/** Straffpunkten: så här många meter från mållinjen (planens meter, 2D och 3D). */
export const STRAFFPUNKT_M = 11;

// ---- När motståndarna har bollen (spec §3.3) --------------------------------
/** På deras planhalva (x ≥ detta) spelar de framåt automatiskt. */
export const DERAS_HALVA_X = 50;
/** Raden före valet: x > nara → "Nu är vi nära målet!", x > derasHalva → "… på deras planhalva". */
export const LAGE_X = { derasHalva: 50, nara: 70 };
/** Hur långt de spelar: fram × (bas + styrka × perStyrka). */
export const DERAS_PASS = { fram: { min: 10, max: 18 }, bas: 0.7, perStyrka: 0.6 };
/** Chansen att deras pass går snett: bas − styrka × perStyrka + mittfältsbonus. */
export const SNETT = { bas: 0.25, perStyrka: 0.1 };
/** Tackla / Täck: vinner bollen vid rätt / fel svar, + försvarsbonus − styrka × FORSVAR_STYRKA. */
export const TACKLA = { ratt: 0.61, fel: 0.15 };
export const TACK = { ratt: 0.38, fel: 0.08 };
export const FORSVAR_STYRKA = 0.2;
/** Vunnen boll: vi tar den några meter fram. */
export const VUNNEN_FRAM = 4;
/** De tar sig förbi: så här långt mot vårt mål – bara TACK_STOPP vid Täck med rätt svar. */
export const FORBI = { min: 12, max: 18 };
export const TACK_STOPP = 5;
/** De skjuter när de är inom så här många meter från vårt mål (x ≤ detta). */
export const DERAS_SKOTT_X = 24;
/** Chansen att de gör mål: (bas + styrka × perStyrka) × (1 − räddning). */
export const DERAS_SKOTT = { bas: 0.44, perStyrka: 0.3 };
/** Räddningen: kl(bas + målvaktsbonus × bonus − styrka × perStyrka; min; max) vid rätt svar, fel vid fel. */
export const RADDNING = { bas: 0.53, bonus: 2, perStyrka: 0.3, min: 0.2, max: 0.9, fel: 0.2 };

// ---- Efter mål och inspark (spec §3.4) ---------------------------------------
/** Inspark från det egna målområdet: deras vid x = INSPARK_DERAS, vår vid INSPARK_VAR. */
export const INSPARK_DERAS = 88;
export const INSPARK_VAR = 12;

// ---- Lagbonus (spec §8.1, används fullt ut i Etapp 2b) ------------------------
/** Lagbonus per lagdel: (snittstjärnor − bas) × perStjarna. Startlaget (2★) har 0. */
export const LAGBONUS = { bas: 2, perStjarna: 0.05 };
export const LAGDELAR = ["MV", "FÖR", "MIT", "ANF"];

// ---- Truppen, marknaden och träningslägret (Etapp 2b, spec §8) -----------------
/** Högst så många reserver (grundpelare som ersatts, §8.2). */
export const RESERVER_MAX = 5;
/**
 * Marknaden (§8.3): antal spelare till salu (nya efter varje match), stjärnorna
 * kl(avrunda(slump(min; bas + div × perDiv)); min; max) och priset
 * avrunda(bas × st^exponent; avrunda). En köpt spelare som ersätts säljs för salj × priset.
 * Tröjnumret (nr) lottas bland de lediga.
 */
export const MARKNAD = { antal: 6, nr: { min: 11, max: 99 }, st: { min: 2, bas: 3.2, perDiv: 0.3, max: 5 }, pris: { bas: 150, exponent: 1.9, avrunda: 10 }, salj: 0.5 };
/** Träningslägret (§8.4): frågor per läger, träningspoäng per rätt svar, poäng per stjärna, taket. */
export const TRANING = { fragor: 8, xpPerRatt: 12, xpPerStjarna: 100, maxSt: 5 };

// ---- Ligan (spec §5, §7.1) ---------------------------------------------------
/** styrka(div) = kl(bas + div × perDiv ± spridning; min; max), div 0 = Division 6. */
export const STYRKA = { bas: 0.2, perDiv: 0.09, spridning: 0.05, min: 0.12, max: 0.92 };
export const DIVISIONER = ["Division 6", "Division 5", "Division 4", "Division 3", "Division 2", "Division 1", "Elitligan", "Superligan"];
export const LAGANTAL = [6, 6, 8, 8, 10, 10, 12, 12];
/** Den högsta divisionen (Superligan): ligavinnaren där kvalar inte – Mästarcupen kommer i Etapp 3. */
export const TOPP_DIV = DIVISIONER.length - 1;
export const POANG = { vinst: 3, oavgjort: 1, forlust: 0 };
/**
 * simMal(styrka, motståndarstyrka) för omgångens övriga matcher: varje lag gör
 * Poisson(bas × (1 + (egen − deras) × skillnad)) mål, högst max. Ett snitt nära
 * elevens egna matcher (balansen, §12).
 */
export const SIM_MAL = { bas: 1.25, skillnad: 2.5, min: 0.2, max: 8 };

// ---- Statistiken (spec §3.6) -------------------------------------------------
/** Ett läge räknas som högst så här många sekunder speltid (en elev som går ifrån räknas inte). */
export const MAX_LAGE_S = 120;

// ---- Tidsmodellen för balansen (spec §12) ------------------------------------
/**
 * Verklig tid i simuleringen (sekunder): ett svar 8–12 s, ett val (knapparna) och
 * animationerna per händelse. 1c:s animationer ska rymmas i de här talen.
 */
export const TID = {
  svar: { min: 8, max: 12 },
  val: 2,
  anim: { pass: 1.5, bruten: 1.5, skott: 2, mal: 4.5, raddning: 2.5, horna: 2.5, derasPass: 1.5, tackling: 1.5, avspark: 1 },
  halvtid: 12,
  slut: 4,
};

// ---- Säsongen, klubben och sparningen (Etapp 1c, spec §5, §6, §8.3) ----------
/** Lagnamnet: 1–24 tecken (§5, §14). */
export const LAGNAMN_MAX = 24;
/**
 * Klubbkassan (§8.3): startar på start. Varje match ger grundbelopp (vinst /
 * oavgjort / förlust) + perRatt per rätt svar + perMal per mål, × (1 + div × perDiv).
 * Ett vunnet kval (uppflyttning, §7.2) ger dessutom uppflyttning × (1 + div × perDiv).
 */
export const KASSA = { start: 600, vinst: 150, oavgjort: 75, forlust: 40, perRatt: 8, perMal: 12, perDiv: 0.25, uppflyttning: 300 };
// ---- Silverpokalen och rekorden (Etapp 2c, spec §9) --------------------------
/**
 * Silverpokalen (§9.1): en utslagsturnering per säsong med rundorna nedan, inlagda jämnt
 * mellan ligaomgångarna (md-cup.js cupSchema). Motståndarna lottas från divisioner inom
 * ±spridning från elevens egen. Vinner man finalen: pokalen och seger × (1 + div × KASSA.perDiv)
 * – specens 400 kr halverade som alla inkomster i Etapp 2b (KASSA).
 */
export const CUP = { namn: "Silverpokalen", rundor: ["Sextondelsfinal", "Kvartsfinal", "Semifinal", "Final"], spridning: 2, seger: 200 };
/** Rekorden (§9.2): bästa andel rätt på en säsong räknas från så här många matcher. */
export const REKORD = { minMatcher: 3 };

/** Karriärdokumentet: de senaste matcherna (Statistik) och dagarna (lärarens 7 dagar / veckolinje). */
export const SENASTE_MAX = 20;
export const DAGAR_MAX = 70;
