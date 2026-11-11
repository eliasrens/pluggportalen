// ============================================================================
// Kurragömma 🙈 – projektorns RENA LOGIK (#839, spec §7, §11.1–§11.2, §0.2).
// Ingen DOM, ingen Firebase – testas i test/live-kurragomma-format.test.js.
// Texterna här är de som syns på projektorn: toppraden, händelseflödet (aldrig
// namnet på den som visslade; namn av → "Någon"), finalens lugna rad, pallen
// (centrerad efter placering, utan tomma platser) och lobbyns figurplatser.
//
// API
//   fasAv(session, status)            → "gom" | "leta" | null (sessionens kgFas, annars RTDB status)
//   gomSlutMs(session)                → ms | null
//   toppText({ fas, status, gomSlutMs, now, clock, antal })
//                                     → { timer, rad } – "Göm: 0:24" + "Låsta 12/21" i gömfasen,
//                                        matchklockan + "Gömda 14 · Sökare 6" i letfasen
//   flodesRad(h, { showNames })       → { ikon, text, typ } | null – en rad per realtidshändelse
//   LOBBY_TEXT · FINAL_TITLE          "🏆 Kurragömma – Prispall" (exakt, §0.2)
//   finalModell(result, s)            → { rad, pall: [{ plats, rader: [{ uid, namn, poang, mynt }] }],
//                                        gomstallen: [{ uid, x, z }] }
//   lobbyPlatser(uids, karta)         → [{ uid, x, z, yaw }] på stranden vid bron
//   minutKvar(prevMs, msLeft)         → true när 1:00 just passerats (en rad i flödet)
// ============================================================================

import { toMs } from "../../live-time.js";
import { formatClock } from "../../live-core.js";
import { ON } from "./delat/kg-karta.js";
import { MINUT_KVAR_MS } from "./delat/kg-config.js";

export const FINAL_TITLE = "🏆 Kurragömma – Prispall";
export const LOBBY_TEXT = "Göm dig var du vill och lås platsen. Svara rätt – annars visslar det! Den som hittas blir sökare.";
export const NAGON = "Någon";
const PALL_PLATSER = 3;

export function fasAv(session, status = null) {
  const f = session?.kgFas || status?.fas || null;
  return f === "gom" || f === "leta" ? f : null;
}

export function gomSlutMs(session) {
  return toMs(session?.kgGomSlut);
}

/** "0:24" – gömfasens nedräkning (sekunder, aldrig under 0). */
export function gomKlocka(gomSlutMs, now) {
  const s = Math.max(0, Math.ceil(((gomSlutMs ?? now) - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Toppradens texter (fredad rad, §0.2). antal = anslutna elever (lobbyn/innan status finns). */
export function toppText({ fas, status = null, gomSlutMs = null, now = 0, clock = "", antal = 0 }) {
  const lasta = Number(status?.lasta) || 0;
  const gomda = Number(status?.gomda) || 0;
  const sokare = Number(status?.sokare) || 0;
  if (fas === "gom") return { timer: `Göm: ${gomKlocka(gomSlutMs, now)}`, rad: `Låsta ${lasta}/${Math.max(gomda, lasta, 0)}` };
  if (fas === "leta") return { timer: clock, rad: `Gömda ${gomda} · Sökare ${sokare}` };
  return { timer: clock, rad: antal ? `${antal} elever` : "" };
}

/** Namnet ur händelsen – servern skriver namn bara när namninställningen är på. */
const namnAv = (v, showNames) => (showNames && v ? String(v) : null);

/** En rad i händelseflödet. Visslingen nämner ALDRIG vem (§1.5) – bara platsen. */
export function flodesRad(h, { showNames = true } = {}) {
  if (!h || !h.typ) return null;
  const plats = h.plats || "ute på ängen";
  if (h.typ === "vissling") return { ikon: "🎵", text: `Det visslar ${plats}!`, typ: "vissling" };
  const sok = namnAv(h.namn, showNames);
  if (h.typ === "hittad") {
    const hittad = namnAv(h.hittad, showNames);
    const text = sok && hittad ? `${sok} hittade ${hittad} ${plats}! ${hittad} blir sökare.` : `${NAGON} hittade någon ${plats}!`;
    return { ikon: "🔎", text, typ: "hittad" };
  }
  if (h.typ === "miss") return { ikon: "🔦", text: `${sok || "En sökare"} letade ${plats} men hittade ingen`, typ: "miss" };
  if (h.typ === "nySokare") return { ikon: "🔦", text: sok ? `Ny sökare! ${sok} letar nu.` : "Ny sökare!", typ: "nySokare" };
  return null;
}

export const FAS_LETA_RAD = { ikon: "👀", text: "Alla har gömt sig – nu letar sökarna!", typ: "fas" };
export const MINUT_KVAR_RAD = { ikon: "⏱", text: "1 minut kvar!", typ: "tid" };

/** Sant exakt när klockan passerar 1:00 (prevMs > 60 s ≥ msLeft). */
export function minutKvar(prevMs, msLeft) {
  return Number.isFinite(prevMs) && prevMs > MINUT_KVAR_MS && msLeft <= MINUT_KVAR_MS && msLeft > 0;
}

/** Finalens lugna rad (§11.2). */
export function lugnRad(result) {
  const klarade = Number(result?.klaradeSig) || 0;
  const antal = Array.isArray(result?.ranking) ? result.ranking.length : 0;
  if (!antal) return "Matchen är slut!";
  if (klarade === 0) return "Sökarna hittade alla!";
  return `${klarade} av ${antal} klarade sig gömda hela matchen`;
}

/**
 * Pallen: placeringarna 1–3 ur serverns ranking (rank = delad placering), utan tomma
 * platser – finns bara två elever blir det två steg; delad plats ger flera rader på
 * samma steg. Pluggmynt ur result.rewards (bara om sessionen hade belöningar).
 */
export function finalModell(result, s = null) {
  const ranking = Array.isArray(result?.ranking) ? result.ranking : [];
  const mynt = result?.rewards || null;
  const steg = new Map();
  for (const r of ranking) {
    const plats = Number(r.rank) || 0;
    if (plats < 1 || plats > PALL_PLATSER) continue;
    if (!steg.has(plats)) steg.set(plats, []);
    steg.get(plats).push({ uid: r.uid, namn: String(r.name || NAGON), poang: Number(r.poang) || 0, mynt: mynt?.[r.uid]?.total ?? null, klaradeSig: !!r.klaradeSig });
  }
  const pall = [...steg.entries()].sort((a, b) => a[0] - b[0]).map(([plats, rader]) => ({ plats, rader }));
  const gomstallen = (Array.isArray(result?.gomstallen) ? result.gomstallen : [])
    .filter((g) => g && g.uid && Number.isFinite(g.x) && Number.isFinite(g.z))
    .map((g) => ({ uid: g.uid, x: g.x, z: g.z, hittad: !!g.hittad, namn: g.namn || "" }));
  return { rad: lugnRad(result), pall, gomstallen, visaNamn: s?.showNames !== false };
}

/**
 * Lobbyn (§11.1): figurerna står på stranden vid bron (väster om dammen), i rader
 * längs kanten, vända mot ön. Platserna är deterministiska ur ordningen.
 */
export function lobbyPlatser(uids, karta = ON) {
  const bro = karta.foremal.find((f) => f.typ === "bro") || { x: -10, z: 8 };
  const mitt = Math.atan2(bro.z, bro.x);
  const perRad = 8;
  return (uids || []).map((uid, i) => {
    const rad = Math.floor(i / perRad);
    const k = (i % perRad) - (Math.min(perRad, uids.length - rad * perRad) - 1) / 2;
    const vinkel = mitt + k * 0.075;
    const r = karta.radie - 2.2 - rad * 1.7;
    const x = Math.cos(vinkel) * r;
    const z = Math.sin(vinkel) * r;
    return { uid, x, z, yaw: Math.atan2(-x, -z) };
  });
}

/** Matchklockan som text ur kärnans msLeft (ownTimer). */
export const klocka = (msLeft) => formatClock(msLeft);
