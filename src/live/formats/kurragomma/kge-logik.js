// ============================================================================
// Kurragömma 🙈 – elevskärmens RENA LOGIK (#839, spec §1.2–§1.6, §6). Ingen
// DOM, ingen Firebase – testas i test/live-kurragomma-format.test.js. Texterna
// är exakt specens: "Göm dig! Ingen annan ser var du går.", "🙈 Du blundar –
// räkna till 30!", "Du är gömd i buskaget", "Leo hittade dig! Nu letar du
// också.", "Fel svar – det visslade där du gömmer dig!", "Det visslar vid
// ladan", "Svara rätt för att ladda ficklampan". Ikonerna är SVG (inga
// emojier från Emoji 13+; 🙈 🔒 🔦 är Emoji 1.0).
//
// API
//   elevLage({ roll, fas })     → "gom-gomd" | "gom-sokare" | "leta-gomd" | "leta-sokare"
//   scenLage(lage, harLast)     → scenens läge: elev-gom | elev-gomd | elev-sokare
//   TEXT                        alla fasta texter
//   gomdText(namn) · hittadText(namn) · andraVisslingText(plats) · blundText(gomtid)
//   nedrakning(gomSlutMs, now)  → "0:24"
//   laddningarHtml(n, max)      → tre ficklampor som SVG (tända/släckta)
//   skyddPrickSvg(niva)         → färgad prick (SVG) till mätaren
//   startplats(uid, karta)      → gömmarens start i kanten, deterministisk ur uid
//   posNyckel(sid) · sparaPos(storage, sid, p) · lasPos(storage, sid) · glomPos(storage, sid)
//   letaTangent(e)              → sant för mellanslag/E (inte med Ctrl/Alt/Meta)
//   panelLage(bredd)            → "sida" (> 1100 px) | "kort"
//   letaFel(err)                → elevens text för ett nekat kgLeta
//   mittenText({ lage, fas, laddningar }) → raden under knappen
// ============================================================================

import { ON } from "./delat/kg-karta.js";
import { LADDNING_MAX, SKYDD_TEXT } from "./delat/kg-config.js";

export const TEXT = Object.freeze({
  gom: "Göm dig! Ingen annan ser var du går.",
  las: "🔒 Lås gömstället här",
  last: "Låst – nu står du still",
  blund: "🙈 Du blundar",
  leta: "🔦 Leta",
  ladda: "Svara rätt för att ladda ficklampan",
  egenVissling: "Fel svar – det visslade där du gömmer dig!",
  sokareLeta: "Leta efter de gömda – tryck på marken för att gå dit",
  vantaFragor: "Frågorna kommer när sökarna börjar leta.",
  hittadeIngen: "Ingen här – leta vidare!",
});
export const PANEL_SIDA_PX = 1100;
export const SKYDD_FARG = ["#EF6F6C", "#F7C948", "#8FCB74", "#27AE60"];

export function elevLage({ roll, fas }) {
  const r = roll === "sokare" ? "sokare" : "gomd";
  return `${fas === "leta" ? "leta" : "gom"}-${r}`;
}

/** Scenens läge ur elevens: gömmaren går fritt tills den låst, sedan stilla; sökaren går fritt. */
export function scenLage(lage, harLast = false) {
  if (lage === "gom-gomd") return harLast ? "elev-gomd" : "elev-gom";
  if (lage === "leta-gomd") return "elev-gomd";
  return "elev-sokare";
}

export const gomdText = (namn) => `Du är gömd ${namn || "ute på ängen"}`;
export const hittadText = (namn) => `${namn || "Någon"} hittade dig! Nu letar du också.`;
export const andraVisslingText = (plats) => `Det visslar ${plats || "ute på ängen"}`;
export const blundText = (gomtid) => `${TEXT.blund} – räkna till ${Number(gomtid) || 30}!`;
export const hittadeText = (namn) => (namn ? `Du hittade ${namn}!` : "Du hittade någon!");
export const skyddText = (niva) => SKYDD_TEXT[Math.max(0, Math.min(3, niva | 0))];

/** "0:24" – aldrig under 0. */
export function nedrakning(gomSlutMs, now) {
  const s = Math.max(0, Math.ceil(((gomSlutMs ?? now) - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const FICKLAMPA = (pa) => `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
  <path d="M5 4h8l2 4v3l-2 2v7H7v-7L5 11V8z" fill="${pa ? "#F7C948" : "#cfd5e3"}" stroke="#3B3350" stroke-width="1.6" stroke-linejoin="round"/>
  ${pa ? '<path d="M15 6l5-2M15 9h5M15 12l5 2" stroke="#F7C948" stroke-width="1.8" stroke-linecap="round"/>' : ""}</svg>`;

/** Laddningarna som tre ficklampor (tända = laddade). */
export function laddningarHtml(n, max = LADDNING_MAX) {
  const k = Math.max(0, Math.min(max, n | 0));
  return Array.from({ length: max }, (_, i) => `<span class="kge-lampa${i < k ? " kge-lampa-pa" : ""}">${FICKLAMPA(i < k)}</span>`).join("");
}

export function skyddPrickSvg(niva) {
  const f = SKYDD_FARG[Math.max(0, Math.min(3, niva | 0))];
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="${f}" stroke="#3B3350" stroke-width="1.5"/></svg>`;
}

/** Gömmarens start (§1.2): en av kartans platser i kanten, samma för samma uid. */
export function startplats(uid, karta = ON) {
  let h = 0;
  for (const c of String(uid || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { ...karta.gomStart[h % karta.gomStart.length] };
}

export const posNyckel = (sid) => `pp:kg:pos:${sid}`;
export function sparaPos(storage, sid, p) {
  try { storage?.setItem(posNyckel(sid), JSON.stringify({ x: p.x, z: p.z, yaw: p.yaw })); } catch { /* privat läge */ }
}
export function lasPos(storage, sid) {
  try {
    const p = JSON.parse(storage?.getItem(posNyckel(sid)) || "null");
    return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z, yaw: Number(p.yaw) || 0 } : null;
  } catch { return null; }
}
export function glomPos(storage, sid) {
  try { storage?.removeItem(posNyckel(sid)); } catch { /* inget */ }
}

/** Mellanslag eller E letar (§1.4) – även när frågefältet har fokus (siffror och 1–4 rör dem inte). */
export function letaTangent(e) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return false;
  return e.key === " " || e.key === "e" || e.key === "E";
}

export const panelLage = (bredd) => (bredd > PANEL_SIDA_PX ? "sida" : "kort");

const LETA_FEL = {
  "ingen-laddning": TEXT.ladda,
  sparr: "Vänta lite mellan sökningarna.",
  orimlig: "Du kan inte ha hunnit dit – gå lugnare.",
  utanfor: "Platsen ligger utanför ön.",
  "inte-sokare": "Bara sökare letar.",
};
export const letaFel = (err) => LETA_FEL[err?.details?.skal] || err?.message || "Sökningen kom inte fram – försök igen.";

/** Raden under knappen: sökare utan laddning uppmanas att svara rätt. */
export function mittenText({ lage, laddningar = 0 }) {
  if (lage === "leta-sokare") return laddningar > 0 ? TEXT.sokareLeta : TEXT.ladda;
  if (lage === "gom-sokare") return "Svara rätt – varje rätt svar laddar ficklampan.";
  if (lage === "gom-gomd") return TEXT.gom;
  return "";
}
