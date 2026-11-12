// ============================================================================
// Kurragömma (#836): ALLA tal i spelreglerna – en källa för geometrin
// (kg-geometri.js), reglerna (kg-regler.js), servern (functions/kurragomma/,
// genererad kopia – npm run sync:kurragomma), klienten (B/D) och
// balanssimuleringen (admin/kg-balans-sim.mjs). Justera spelet här, aldrig i
// motorn. Ren data, inga importer. Kontraktet: docs/KURRAGOMMA.md.
//
// Enheter: meter (1 enhet i 3D-scenen = 1 m), millisekunder för tider,
// sekunder bara där läraren väljer (gömtiden). Riktning (yaw) i radianer,
// framåt = (x: sin yaw, z: cos yaw).
// ============================================================================

// ---- Rörelsen (spec §3) ------------------------------------------------------
/** Gångfart (m/s). Används av klientens rörelse OCH serverns rimlighetskontroll. */
export const MAX_FART = 6;
/** Rimlighetskontrollen (§1.6): sökpunkten får ligga högst maxFart·Δt + så här långt bort. */
export const RIMLIG_MARGINAL_M = 2;
/** Knuffen ut ur ett fast föremål lägger till så här mycket, så att punkten hamnar säkert utanför. */
export const KNUFF_MARGINAL_M = 0.01;
/** Figurens radie – minsta passage mellan två fasta föremål (och till strandkanten) är 2× detta. */
export const FIGUR_RADIE_M = 0.5;

// ---- Kameran (spec §3) – B ---------------------------------------------------
export const KAMERA = { bakom: 8.5, upp: 4.5, tittaPaY: 1.8, synfalt: 60 };

// ---- Skyddet (spec §2.3, tabellen i §1.6) -----------------------------------
/** Skydd 2: högst så här långt från ett föremåls kant (r). */
export const SKYDD_BRA_M = 0.6;
/** Skydd 1: högst så här långt från ett föremåls kant (r). */
export const SKYDD_OKEJ_M = 2;
/** Text på skärmen per skyddsnivå 0–3. */
export const SKYDD_TEXT = ["Syns lätt", "Okej gömställe", "Bra gömställe", "Mycket bra gömställe"];

// ---- Platsnamnen (spec §2.2) -------------------------------------------------
/** "vid ladan" när punkten ligger högst så här långt från föremålets kant (yta ?? r). */
export const PLATS_VID_M = 2.5;
/** Texten när inget föremål är nära. */
export const PLATS_ANGEN = "ute på ängen";
/** Gömställe åt en frånkopplad elev (§1.2): avstånd från föremålets mitt, i delar av r. */
export const AUTO_GOM_AVSTAND = { min: 0.4, max: 1.2 };

// ---- Sökningen (spec §1.6) ---------------------------------------------------
/**
 * Sökradie (m) per skyddsnivå 0–3. BALANSERAD (#836, docs/KURRAGOMMA.md §6):
 * specens 3,5/3,0/2,2/1,5 gav att alla hittades inom 2–3 min i simuleringen –
 * sänkt (samma ordning, ungefär ×0,6) så att 15–40 % klarar sig.
 */
export const SOKRADIE = [2.0, 1.7, 1.3, 0.9];
/** Den som visslat de senaste VISSLING_FONSTER_MS har så här mycket större sökradie. */
export const VISSLING_RADIE_FAKTOR = 1.5;
export const VISSLING_FONSTER_MS = 10_000;
/** Spärrtid mellan två sökningar för samma sökare. */
export const LETA_SPARR_MS = 2000;
/** Ficklampan: högst så här många laddningar. */
export const LADDNING_MAX = 3;
/** Laddningar som läggs till när letfasen börjar (utöver det som laddades under blundandet). */
export const LADDNING_START = 1;
/** Laddningar per rätt svar (sökare). */
export const LADDNING_PER_RATT = 1;

// ---- Visslingen (spec §1.3, §1.5) --------------------------------------------
/**
 * Visslingens ungefärliga centrum slumpas inom så här många meter från
 * gömstället. BALANSERAD (#836): specens 2,5 m gjorde att nästan varje vissling
 * ledde till att någon hittades – höjd till 5 m.
 */
export const VISSLING_OSAKERHET_M = 5;
/**
 * Spärrtid per elev: fel svar inom så här lång tid efter förra visslingen ger
 * ingen ny vissling. BALANSERAD (#836): specens 20 s gav 19 visslingar/min vid
 * 60 % rätt (riktmärke ≤ 6) – höjd till 200 s (5,6/min vid 60 % rätt).
 */
export const VISSLING_SPARR_MS = 200_000;
/** Tystnadsregeln: den gömda som inte svarat på så här länge visslar. */
export const TYSTNAD_MS = 45_000;
/** Frånkopplad: pulsen har inte uppdaterats på så här länge (tystnadsregeln gäller inte då). */
export const FRANKOPPLAD_MS = 30_000;
/** Sökarnas markör för en vissling syns så här länge (även genom dimman). */
export const VISSLING_MARKOR_MS = 4000;
/** Övriga gömmare ser raden "Det visslar vid …" så här länge. */
export const VISSLING_RAD_MS = 3000;
/**
 * Lärarens vissling (kgLarareVissla, #840): VISSLING_SPARR_MS gäller inte den, men
 * samma gömda elev kan inte visslas igen av läraren inom så här lång tid (spamskydd).
 */
export const LARARE_VISSLA_SPARR_MS = 5000;

// ---- Poängen (spec §1.3, §1.4) -----------------------------------------------
export const POANG = {
  /** Rätt svar (gömmare och sökare). */
  ratt: 10,
  /** Sökaren som hittar en gömmare. */
  hittade: 40,
  /** Överlevnad: så här många poäng … */
  overlevnad: 2,
  /** … per hela så här många ms som gömd under letfasen. */
  overlevnadPerMs: 10_000,
  /** Gömd när tiden tar slut. */
  gomdVidSlut: 50,
};

// ---- Lärarens val (spec §1.1, §1.2, §9, §0.2) -------------------------------
/** Gömtidens val (sekunder) och standard. */
export const GOMTIDER_S = [20, 30, 45, 60];
export const GOMTID_STANDARD_S = 30;
/** Speltidens snabbknappar (minuter), rekommendationen och "Egen tid". */
export const SPELTIDER_MIN = [3, 5, 10, 15, 20, 30];
export const SPELTID_REKOMMENDERAD_MIN = 8;
export const SPELTID_EGEN_MIN = { min: 1, max: 60 };
/** Startsökare "Auto": 1 per påbörjat 10-tal elever, minst 1, högst 4. Annars 1–4. */
export const STARTSOKARE = { perElever: 10, min: 1, max: 4 };
export const STARTSOKARE_STANDARD = "auto";
/** Tystnadsregeln är på som standard. */
export const TYSTNAD_STANDARD = true;
/** Kartan (bara "on" i etapp 1). */
export const KARTA_STANDARD = "on";

// ---- Klienten och flödet (spec §1.3, §1.6, §5.3) – B/C/D --------------------
/** Hjärtslaget: en sökare inom så här många meter från den gömda. */
export const HJARTSLAG_M = 6;
/** "X letade vid … men hittade ingen" högst så här ofta per sökare. */
export const FLODE_MISS_SPARR_MS = 15_000;
/** Projektorns händelseflöde: högst så här många rader. */
export const FLODE_MAX_RADER = 4;
/** Servern kör kgTick så här ofta (projektorn). */
export const TICK_MS = 5000;
/** Rörelsekanalen: sökaren skriver högst så här ofta, och bara vid flytt > POS_MIN_FLYTT_M eller vridning. */
export const POS_MIN_INTERVALL_MS = 200;
export const POS_MIN_FLYTT_M = 0.15;
export const POS_MIN_VRID_RAD = 0.05;
/** … men minst så här ofta även när sökaren står stilla – pulsen för regeln "det finns alltid en sökare" (C läser pos.t). */
export const POS_PULS_MS = 10_000;
/** Klienten lyssnar på de så här många senaste realtidshändelserna (limitToLast). */
export const HAND_LIMIT = 20;
/** kgLas tas emot så här länge efter gömfasens slut (klientens automatiska skick vid 0:00 hinner fram). */
export const LAS_MARGINAL_MS = 2000;
/** Klienterna ritar andras positioner så här långt bakåt i tiden (interpolering). */
export const POS_INTERPOLERING_MS = 150;
/** Realtidshändelser äldre än så här struntar klienten i; servern rensar äldre än HAND_RENSA_MS. */
export const HAND_MAX_ALDER_MS = 10_000;
export const HAND_RENSA_MS = 60_000;
/** "1 minut kvar" i flödet. */
export const MINUT_KVAR_MS = 60_000;
/** Hittad-rutan hos eleven visas högst så här länge. */
export const HITTAD_RUTA_MS = 2000;
/** Projektorns kamera glider till en händelse så här länge. */
export const KAMERA_GLID_MS = 3000;
