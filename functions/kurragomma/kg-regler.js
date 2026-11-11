// ============================================================================
// Kurragömma (#836): SPELREGLERNA – sökningen, rimlighetskontrollen,
// visslingarna (spärrtid, tystnadsregeln, frånkopplad), poängen, överlevnaden,
// placeringen, startsökarna och lärarens inställningar (spec §1, §9).
// Rena funktioner: tider är tal i ms (serverns klocka) som SKICKAS IN, slump
// är en funktion som ger [0, 1) eller tal som skickas in. Ingen Date.now(),
// ingen Math.random() – servern (C) och demot (D) ger dem. Alla tal: kg-config.js.
// API-översikten: docs/KURRAGOMMA.md §2.
// ============================================================================

import {
  MAX_FART, RIMLIG_MARGINAL_M, SOKRADIE, VISSLING_RADIE_FAKTOR, VISSLING_FONSTER_MS, LETA_SPARR_MS,
  LADDNING_MAX, LADDNING_START, LADDNING_PER_RATT, VISSLING_OSAKERHET_M, VISSLING_SPARR_MS, TYSTNAD_MS,
  FRANKOPPLAD_MS, POANG, GOMTIDER_S, GOMTID_STANDARD_S, STARTSOKARE, STARTSOKARE_STANDARD, TYSTNAD_STANDARD,
  KARTA_STANDARD, HJARTSLAG_M, FLODE_MISS_SPARR_MS, SPELTID_EGEN_MIN,
} from "./kg-config.js";
import { ON, KARTOR } from "./kg-karta.js";
import { skydd as skyddVid, innanforOn } from "./kg-geometri.js";

const tid = (v) => (Number.isFinite(v) ? v : null);

// ---- Sökningen (spec §1.6) ---------------------------------------------------

/** Har eleven visslat inom VISSLING_FONSTER_MS? */
export function harVisslatNyligen(senastVisslingAt, nu) {
  const t = tid(senastVisslingAt);
  return t != null && nu - t >= 0 && nu - t < VISSLING_FONSTER_MS;
}

/** Sökradien för en gömmare: tabellen i §1.6, ×1,5 om den visslat de senaste 10 s. */
export function sokradie(skyddNiva, { senastVisslingAt = null, nu = 0 } = {}) {
  const bas = SOKRADIE[Math.max(0, Math.min(SOKRADIE.length - 1, skyddNiva | 0))];
  return harVisslatNyligen(senastVisslingAt, nu) ? bas * VISSLING_RADIE_FAKTOR : bas;
}

/**
 * Vilka gömmare hittas av en sökning i (x, z) vid tiden nu? Deterministiskt:
 * alla inom sin sökradie (≤). gomda: [{ uid, x, z, skydd?, senastVisslingAt? }]
 * – saknas skydd räknas det ur kartan. Ger uid:erna i indatans ordning.
 */
export function sok({ x, z, nu }, gomda, karta = ON) {
  return gomda.filter((g) => {
    const niva = Number.isInteger(g.skydd) ? g.skydd : skyddVid(g.x, g.z, karta);
    return Math.hypot(g.x - x, g.z - z) <= sokradie(niva, { senastVisslingAt: g.senastVisslingAt, nu });
  }).map((g) => g.uid);
}

/**
 * Rimlighetskontrollen: avståndet från förra sökningen (eller startpunkten)
 * får vara högst MAX_FART × förfluten tid + RIMLIG_MARGINAL_M. fran = { x, z, at }.
 */
export function rimligPlats({ x, z, nu }, fran) {
  if (!fran) return true;
  const sek = Math.max(0, nu - fran.at) / 1000;
  return Math.hypot(x - fran.x, z - fran.z) <= MAX_FART * sek + RIMLIG_MARGINAL_M;
}

/**
 * Allt servern kontrollerar i kgLeta innan sökningen görs (spec §1.6).
 *   senasteSok  { x, z, at } förra sökningen, null om ingen
 *   startpunkt  { x, z, at } där och när eleven blev sökare (används när senasteSok saknas)
 * → { ok: true } | { ok: false, skal: "inte-sokare"|"ingen-laddning"|"sparr"|"utanfor"|"orimlig" }
 * Nekad sökning kostar ingen laddning (servern drar laddningen bara vid ok).
 */
export function kontrolleraSokning({ roll, laddningar, x, z, nu, senasteSok = null, startpunkt = null, karta = ON }) {
  if (roll !== "sokare") return { ok: false, skal: "inte-sokare" };
  if (!(laddningar >= 1)) return { ok: false, skal: "ingen-laddning" };
  if (senasteSok && nu - senasteSok.at < LETA_SPARR_MS) return { ok: false, skal: "sparr" };
  if (!innanforOn(x, z, karta)) return { ok: false, skal: "utanfor" };
  if (!rimligPlats({ x, z, nu }, senasteSok || startpunkt)) return { ok: false, skal: "orimlig" };
  return { ok: true };
}

/** "X letade vid … men hittade ingen" i flödet: högst var 15:e s per sökare. */
export function missFlodeTillats(senastMissFlodeAt, nu) {
  const t = tid(senastMissFlodeAt);
  return t == null || nu - t >= FLODE_MISS_SPARR_MS;
}

// ---- Visslingen (spec §1.3, §1.5) --------------------------------------------

/** Fel svar → vissling? Bara gömda, bara i letfasen, och inte inom spärrtiden. */
export function visslarVidFel({ roll, fas = "leta", senastVisslingAt = null, nu }) {
  if (roll !== "gomd" || fas !== "leta") return false;
  const t = tid(senastVisslingAt);
  return t == null || nu - t >= VISSLING_SPARR_MS;
}

/** Frånkopplad: pulsen (players.lastSeen) är äldre än FRANKOPPLAD_MS, eller saknas. */
export function arFrankopplad(pulsAt, nu) {
  const t = tid(pulsAt);
  return t == null || nu - t >= FRANKOPPLAD_MS;
}

/**
 * Tystnadsregeln: den gömda som inte svarat på TYSTNAD_MS visslar. Tiden räknas
 * från det senaste av: svaret, visslingen, letfasens början – så en tyst elev
 * visslar högst var 45:e s och aldrig de första 45 s av letfasen. Gäller inte en
 * frånkopplad elev, och inte när läraren stängt av regeln.
 */
export function tystnadVisslar({ roll, fas = "leta", tystnadPa = TYSTNAD_STANDARD, senastSvarAt = null,
  senastVisslingAt = null, letStartAt = null, pulsAt, nu }) {
  if (!tystnadPa || roll !== "gomd" || fas !== "leta") return false;
  if (arFrankopplad(pulsAt, nu)) return false;
  const ref = Math.max(tid(senastSvarAt) ?? -Infinity, tid(senastVisslingAt) ?? -Infinity, tid(letStartAt) ?? -Infinity);
  if (ref === -Infinity) return false;
  return nu - ref >= TYSTNAD_MS;
}

/**
 * Visslingens UNGEFÄRLIGA plats: ett centrum likformigt slumpat inom
 * VISSLING_OSAKERHET_M från gömstället, hållet inom ön (projektionen flyttar
 * aldrig punkten längre från gömstället). u1, u2 ∈ [0, 1) från servern.
 */
export function visslingsplats(x, z, u1, u2, karta = ON) {
  const r = VISSLING_OSAKERHET_M * Math.sqrt(u1);
  const a = u2 * 2 * Math.PI;
  let px = x + Math.cos(a) * r;
  let pz = z + Math.sin(a) * r;
  const d = Math.hypot(px, pz);
  if (d > karta.radie) {
    px = (px / d) * karta.radie;
    pz = (pz / d) * karta.radie;
  }
  return { x: px, z: pz };
}

/** Hjärtslaget hos den gömda: någon sökare inom HJARTSLAG_M. sokare: [{ x, z }]. */
export function hjartslag(gom, sokare) {
  return sokare.some((s) => Math.hypot(s.x - gom.x, s.z - gom.z) <= HJARTSLAG_M);
}

// ---- Svaren och laddningarna (spec §1.3, §1.4) -------------------------------

/**
 * Vad ett svar ger. Gömd: rätt +10, fel → vissling (om spärren tillåter).
 * Sökare: rätt +10 och +1 laddning (tak LADDNING_MAX), fel → ingenting.
 * → { poang, laddningar, vissling }
 */
export function svarsEffekt({ roll, ratt, fas = "leta", laddningar = 0, senastVisslingAt = null, nu }) {
  if (roll === "sokare") {
    return {
      poang: ratt ? POANG.ratt : 0,
      laddningar: ratt ? Math.min(LADDNING_MAX, laddningar + LADDNING_PER_RATT) : laddningar,
      vissling: false,
    };
  }
  return {
    poang: ratt ? POANG.ratt : 0,
    laddningar,
    vissling: !ratt && visslarVidFel({ roll, fas, senastVisslingAt, nu }),
  };
}

/** Startsökarnas laddningar när letfasen börjar: 1 + det som laddades under blundandet, tak 3. */
export function laddningarVidLetStart(laddadeUnderBlund = 0) {
  return Math.min(LADDNING_MAX, LADDNING_START + Math.max(0, laddadeUnderBlund | 0));
}

/** En ny sökare (hittad, eller ansluten under letfasen) börjar med så här många laddningar. */
export function laddningarNySokare() {
  return LADDNING_START;
}

// ---- Poängen (spec §1.3, §1.7) -----------------------------------------------

/** Överlevnad: +2 per HELA 10 s som gömd under letfasen. */
export function overlevnadsPoang(gomdMs) {
  return Math.floor(Math.max(0, gomdMs) / POANG.overlevnadPerMs) * POANG.overlevnad;
}

/** Poängen den gömda får när den hittas: överlevnaden från letfasens början. */
export function poangVidHittad({ letStartAt, hittadAt }) {
  return overlevnadsPoang(hittadAt - letStartAt);
}

/** Poängen den gömda får när matchen tar slut: överlevnaden + 50. */
export function poangGomdVidSlut({ letStartAt, slutAt }) {
  return overlevnadsPoang(slutAt - letStartAt) + POANG.gomdVidSlut;
}

/** Poängen till sökaren per hittad gömmare. */
export function poangForHittad() {
  return POANG.hittade;
}

/**
 * Placering efter poäng, lika poäng → delad placering (1, 1, 3).
 * rader: [{ uid, poang, … }] → nya rader { …, plats }, högst poäng först
 * (lika poäng i uid-ordning, så att alla klienter visar samma ordning).
 */
export function placering(rader) {
  const sorterade = [...rader].sort((a, b) => (b.poang - a.poang) || String(a.uid).localeCompare(String(b.uid)));
  let plats = 0;
  return sorterade.map((r, i) => {
    if (i === 0 || r.poang !== sorterade[i - 1].poang) plats = i + 1;
    return { ...r, plats };
  });
}

/** Raderna till live-rewards (spec §10): [{ uid, score, correct, answered }]. */
export function rewardRader(spelare) {
  return spelare.map((p) => ({ uid: p.uid, score: p.poang | 0, correct: p.ratt | 0, answered: p.besvarade | 0 }));
}

/** Slutar matchen? Speltiden är ute, eller (i letfasen) alla gömmare är hittade. */
export function arSlut({ fas, nu, slutAt, gomdaKvar }) {
  if (Number.isFinite(slutAt) && nu >= slutAt) return true;
  return fas === "leta" && gomdaKvar === 0;
}

// ---- Rollerna (spec §1.1) ----------------------------------------------------

/**
 * Antal startsökare. "auto": 1 per påbörjat 10-tal elever, minst 1, högst 4.
 * Ett tal: 1–4. Aldrig fler än antal elever − 1 (minst en gömmare); en ensam
 * elev får 0 (regeln "det finns alltid en sökare" tar över i letfasen).
 */
export function antalStartsokare(antalElever, val = STARTSOKARE_STANDARD) {
  const n = Math.max(0, antalElever | 0);
  const onskat = val === "auto" || val == null
    ? Math.ceil(n / STARTSOKARE.perElever)
    : Number(val);
  const klamt = Math.max(STARTSOKARE.min, Math.min(STARTSOKARE.max, Number.isFinite(onskat) ? Math.round(onskat) : 1));
  return Math.max(0, Math.min(klamt, n - 1));
}

/** Drar `antal` uid ur listan (utan återläggning). slump: () → [0, 1). */
export function valjSlumpade(uids, antal, slump) {
  const kvar = [...uids];
  const valda = [];
  while (valda.length < antal && kvar.length) {
    valda.push(kvar.splice(Math.min(kvar.length - 1, Math.floor(slump() * kvar.length)), 1)[0]);
  }
  return valda;
}

/** Roll för en elev som ansluter: under gömfasen gömmare, annars sökare (spec §1.1). */
export function rollVidAnslutning(fas) {
  return fas === "gom" ? "gomd" : "sokare";
}

/**
 * Behövs en ny sökare? I letfasen när ingen sökare är ansluten (ingen puls på
 * FRANKOPPLAD_MS) och det finns gömda kvar. sokare: [{ pulsAt }].
 */
export function behoverNySokare({ fas, sokare, gomdaKvar, nu }) {
  if (fas !== "leta" || !(gomdaKvar > 0)) return false;
  return sokare.every((s) => arFrankopplad(s.pulsAt, nu));
}

// ---- Lärarens inställningar (spec §9) och klockan (spec §0.1) ----------------

/** Normaliserar kgInstallningar: { gomtid (s), startsokare ("auto"|1–4), tystnad, karta }. */
export function normInstallningar(inst = {}) {
  const g = Number(inst.gomtid);
  const s = inst.startsokare;
  const sTal = Number(s);
  return {
    gomtid: GOMTIDER_S.includes(g) ? g : GOMTID_STANDARD_S,
    startsokare: Number.isInteger(sTal) && sTal >= STARTSOKARE.min && sTal <= STARTSOKARE.max ? sTal : "auto",
    tystnad: typeof inst.tystnad === "boolean" ? inst.tystnad : TYSTNAD_STANDARD,
    karta: KARTOR[inst.karta] ? inst.karta : KARTA_STANDARD,
  };
}

/** Speltiden i minuter, klämd till "Egen tid" 1–60 hela minuter. */
export function normSpeltidMin(min) {
  const m = Math.round(Number(min));
  if (!Number.isFinite(m)) return null;
  return Math.max(SPELTID_EGEN_MIN.min, Math.min(SPELTID_EGEN_MIN.max, m));
}

/** Kärnans matchklocka (durationSeconds) = gömtid + speltid – gömfasen räknas inte in i speltiden. */
export function matchSekunder({ gomtid, speltidMin }) {
  return gomtid + speltidMin * 60;
}
