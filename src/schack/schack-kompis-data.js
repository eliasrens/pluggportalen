// ============================================================================
// Schack mot en kompis – ren logik för lobbyn och partiet (#780, Etapp 2B,
// spec §7–§8). Inget DOM, ingen Firebase: vyerna (schack-lobby-vy.js,
// schack-kompis-vy.js) ritar det här och testerna kör det i node.
//
//   formatTid(ms)                     "9:41" – klockans visning
//   klockor(parti, farg, nu)          båda klockorna för visningen (lokalt räknat)
//   lobbyVy(klass, uid, nu)           väntan, utmaningar, pågående – utgångna bort
//   topplistaRader(tabell, uid, namn) topplistan med egen rad markerad (§8)
//   lamnatLage(parti, uid, nu)        §7.3: varning efter 4 min, kräv vinst efter 5 min / tid slut
//   slutText(parti, uid, lokalOrsak)  slutrutans rubrik och förklaring
//   dragDiff(lokala, serverns)        hur brädet ska följa serverns draglista
// Alla tider är epoch-ms från serverns klocka (`nu` = serverNow()).
// ============================================================================

import {
  KLOCKOR, UTMANING_MS, VANTAN_MS, LAMNAT_MS, LAMNAT_VARNING_MS, klockaNu, rensaLobby, partiFor, topplista,
} from "./schack-server-delat.js";

export { KLOCKOR };

/** Klockvalet i lobbyn: null = ingen klocka. */
export const KLOCK_VAL = KLOCKOR.map((k) => ({ varde: k, text: k ? `${k} min` : "Ingen klocka" }));

/** "10 min" / "ingen klocka" – i väntar-kort, utmaningar och listan över partier. */
export const klockaEtikett = (minuter) => (minuter ? `${minuter} min` : "ingen klocka");

/**
 * Klockans text: m:ss, uppåt till hel sekund (0,4 s kvar visas 0:01 – "0:00"
 * betyder att tiden är slut). Under 10 s visas tiondelar ("0:07,3").
 */
export function formatTid(ms) {
  if (ms == null || !Number.isFinite(ms)) return "";
  const t = Math.max(0, ms);
  if (t > 0 && t < 10_000) return `0:0${Math.floor(t / 1000)},${Math.floor((t % 1000) / 100)}`;
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Båda klockorna för visningen, räknade lokalt ur `senastDragAt` + `nu` (ingen
 * skrivning per sekund, §7.2). null utan klocka.
 * @returns {null | { w:{ms,text,aktiv,lite}, b:{…}, slutFor: "w"|"b"|null }}
 */
export function klockor(parti, nu) {
  if (!parti?.klocka) return null;
  const pagar = parti.status === "pagar";
  const k = pagar ? klockaNu(parti.klocka, parti.tur, nu) : { vitMs: parti.klocka.vitMs, svartMs: parti.klocka.svartMs, slut: false };
  const en = (farg, ms) => ({ ms, text: formatTid(ms), aktiv: pagar && parti.tur === farg, lite: ms < 30_000 });
  return { w: en("w", k.vitMs), b: en("b", k.svartMs), slutFor: pagar && k.slut ? parti.tur : null };
}

/** Elevens färg i partiet, eller null om eleven inte spelar. */
export function fargFor(parti, uid) {
  if (parti?.vit === uid) return "w";
  if (parti?.svart === uid) return "b";
  return null;
}

/** Motståndarens uid och namn. */
export function motstandare(parti, uid) {
  const vit = parti?.vit === uid;
  return { uid: vit ? parti.svart : parti?.vit, namn: (vit ? parti?.svartNamn : parti?.vitNamn) || "Kompisen" };
}

/**
 * Lobbyn som eleven ska se den just nu: utgångna väntan (10 min) och utmaningar
 * (2 min, räknat från `sedan`) är borta – även utan någon skrivning.
 * @returns {{ minVantan, vantar, inkommande, utgaende, pagaende, mittParti, spelar:Set, nastaUtgang:number|null }}
 *   nastaUtgang = ms tills nästa post går ut (vyn ritar om då), null om ingen.
 */
export function lobbyVy(klass, uid, nu) {
  const r = rensaLobby(klass, nu);
  const vantarAlla = Object.entries(r.vantar).map(([id, v]) => ({ uid: id, namn: v.namn || "Kompisen", klocka: v.klocka ?? null, sedan: v.sedan }));
  const utm = Object.entries(r.utmaningar).map(([id, u]) => ({ id, ...u, klocka: u.klocka ?? null, kvarMs: UTMANING_MS - (nu - u.sedan) }));
  const pagaende = Object.entries(klass?.partier || {})
    .filter(([, p]) => p && p.vit && p.svart)
    .map(([id, p]) => ({ id, vit: p.vit, svart: p.svart, text: `${p.vitNamn || "?"} – ${p.svartNamn || "?"}`, klocka: p.klocka ?? null, start: p.start || 0 }))
    .sort((a, b) => a.start - b.start);
  const spelar = new Set(pagaende.flatMap((p) => [p.vit, p.svart]));
  const utgangar = [
    ...vantarAlla.map((v) => v.sedan + VANTAN_MS - nu),
    ...utm.map((u) => u.kvarMs),
  ].filter((ms) => ms > 0);
  return {
    minVantan: vantarAlla.find((v) => v.uid === uid) || null,
    vantar: vantarAlla.filter((v) => v.uid !== uid && !spelar.has(v.uid)).sort((a, b) => a.sedan - b.sedan),
    inkommande: utm.filter((u) => u.till === uid && u.fran !== uid).sort((a, b) => a.sedan - b.sedan),
    utgaende: utm.find((u) => u.fran === uid) || null,
    pagaende,
    mittParti: partiFor(klass?.partier, uid),
    spelar,
    nastaUtgang: utgangar.length ? Math.min(...utgangar) : null,
  };
}

/**
 * Klasslistan för "Utmana en kompis": alla utom eleven själv, sorterade på namn,
 * med läget per kompis (spelar redan / väntar / redan utmanad av dig).
 * @param {Array<{uid, namn}>} klasslista  ur classProjections (en läsning)
 */
export function utmanaLista(klasslista, uid, vy) {
  return (klasslista || [])
    .filter((k) => k && k.uid && k.uid !== uid)
    .map((k) => ({
      ...k,
      spelar: vy.spelar.has(k.uid),
      vantar: vy.vantar.some((v) => v.uid === k.uid),
      utmanad: vy.utgaende?.till === k.uid,
    }))
    .sort((a, b) => String(a.namn).localeCompare(String(b.namn), "sv"));
}

/**
 * Topplistan (§8): placering, namn, poäng, V/F/R, egen rad markerad. Sortering
 * som servern (poäng, vinster, namn). Elever utan spelade partier står inte med.
 */
export function topplistaRader(tabell, uid, namnFor = () => "") {
  return topplista(tabell, (id) => namnFor(id) || "Okänd")
    .filter((r) => r.partier > 0)
    .map((r, i) => ({ ...r, plats: i + 1, egen: r.uid === uid }));
}

/**
 * §7.3 och tiden: vad ska eleven se just nu?
 *  - varning   utan klocka, min tur och ≥ 4 min sedan senaste draget
 *  - kanKrava  motståndaren på tur och (klocka: tiden slut | utan klocka: ≥ 5 min)
 *  - minTidSlut  min tid är slut (servern avgör när någon drar eller kräver)
 *  - kravOm    ms tills kanKrava/varning ändras (vyn räknar om då), null = aldrig
 */
export function lamnatLage(parti, uid, nu) {
  const tom = { varning: false, kanKrava: false, minTidSlut: false, kravOm: null };
  const farg = fargFor(parti, uid);
  if (!parti || parti.status !== "pagar" || !farg) return tom;
  const minTur = parti.tur === farg;
  if (parti.klocka) {
    const k = klockaNu(parti.klocka, parti.tur, nu);
    const kvar = parti.tur === "w" ? k.vitMs : k.svartMs;
    return { ...tom, kanKrava: !minTur && k.slut, minTidSlut: minTur && k.slut, kravOm: k.slut ? null : kvar };
  }
  const sedan = nu - (Number(parti.senastDragAt) || nu);
  if (minTur) return { ...tom, varning: sedan >= LAMNAT_VARNING_MS, kravOm: sedan >= LAMNAT_VARNING_MS ? null : LAMNAT_VARNING_MS - sedan };
  return { ...tom, kanKrava: sedan >= LAMNAT_MS, kravOm: sedan >= LAMNAT_MS ? null : LAMNAT_MS - sedan };
}

const vinnareFor = (resultat) => (resultat === "1-0" ? "w" : resultat === "0-1" ? "b" : null);
const genitiv = (namn) => (/[sxz]$/i.test(namn) ? namn : `${namn}s`);

/** Remi-orsaken som brädet räknat ut lokalt (servern säger bara "remi"). */
const REMI_TEXT = {
  upprepning: "Samma ställning har kommit tre gånger.",
  femtio: "50 drag i rad utan att någon bonde har flyttats eller någon pjäs har tagits.",
  material: "Ingen har tillräckligt med pjäser kvar för att kunna göra schack matt.",
};

/**
 * Slutrutans text (§7.2) ur serverns resultat/orsak, sett från eleven.
 * @param {string} [lokalOrsak]  brädets egen remi-orsak ("upprepning"|"femtio"|"material")
 * @returns {{ titel, text, resultat, orsak, vinnare: "w"|"b"|null }}
 */
export function slutText(parti, uid, lokalOrsak = null) {
  const egen = fargFor(parti, uid);
  const m = motstandare(parti, uid).namn;
  const { resultat = null, orsak = null } = parti || {};
  const vinnare = vinnareFor(resultat);
  const vann = vinnare && vinnare === egen;
  const ut = (titel, text = "") => ({ titel, text, resultat: resultat || "½-½", orsak: orsak || "avbrutet", vinnare });
  switch (orsak) {
    case "matt": return vann ? ut("Schack matt – du vann! 🎉", "Kungen står i schack och kan inte räddas.") : ut(`Schack matt – ${m} vann.`, "Kungen står i schack och kan inte räddas.");
    case "gav-upp": return vann ? ut(`Du vann! ${m} gav upp. 🎉`, `${m} tryckte på Ge upp.`) : ut(`Du gav upp – ${m} vann.`, "Du tryckte på Ge upp.");
    case "tid": return vann ? ut(`Du vann! ${genitiv(m)} tid tog slut. 🎉`, "Tiden tog slut.") : ut(`Din tid tog slut – ${m} vann.`, "Tiden tog slut.");
    case "lamnade": return vann ? ut(`Du vann! ${m} verkar ha gått. 🎉`, "Ingen hade dragit på fem minuter.") : ut(`${m} avslutade partiet och vann.`, "Du hade inte dragit på fem minuter.");
    case "patt": return ut("Patt – remi!", "Den som är på tur kan inte flytta, men kungen står inte i schack.");
    case "remi": return ut("Remi – ingen vann", REMI_TEXT[lokalOrsak] || "Ni kom överens om remi.");
    case "avbrutet": return ut("Partiet avbröts", "Ingen vann, och topplistan påverkas inte.");
    default: return ut(vann ? "Du vann! 🎉" : vinnare ? `${m} vann.` : "Partiet är slut");
  }
}

/**
 * Hur brädet följer serverns draglista: "lika" (inget), "ett" (motståndarens
 * nya drag – spela det med animation) eller "ladda" (allt annat: ladda om partiet).
 */
export function dragDiff(lokala = [], serverns = []) {
  const lika = (n) => lokala.slice(0, n).every((d, i) => d === serverns[i]);
  if (lokala.length === serverns.length && lika(lokala.length)) return { typ: "lika" };
  if (serverns.length === lokala.length + 1 && lika(lokala.length)) return { typ: "ett", san: serverns[serverns.length - 1] };
  return { typ: "ladda" };
}
