// ============================================================================
// Klasscentret – statistiktavlan: siffror, text och tavlans värden (#498,
// epic #474 Klasscentret 3/4 E). REN logik (ingen DOM, ingen Firebase) →
// test/kc-statistik.test.js. Laddas bara dynamiskt (via kc-rum-statistik.js).
// ----------------------------------------------------------------------------
// Tavlan visar tre tal – alla ur data som REDAN finns aggregerad per klass
// (incident #114: aldrig ett dokument per elev eller svar):
//   EXP            summan av expShards/{0..4}.exp   (kc-exp-data subscribeClassExp)
//   lösta uppgifter summan av members.{uid}.plays i classProjections/{classId}
//                  (ETT dokument) = antal avklarade spelomgångar i övnings-
//                  lägena (progress[area][mode].plays, awardExercise). Entries
//                  utan plays (skrivna före #498) räknas med completed = minst
//                  en körning per avklarad övning → historiken finns från start.
//                  Bara klassens NUVARANDE elever (classes.studentIds) räknas.
//   progress       progressTillNasta(exp, antalElever) (kc-niva.js)
//
// API
//   lostaUppgifter(members, studentIds?) → heltal ≥ 0
//   statistikModell({ exp, antalElever, losta }) → Modell
//   talText(n) "12 345"          talKort(n) "12 345" / "123k" / "1,2M" (tavlans rutor)
//   panelHtml(modell, { klassNamn? }) → panelens innehåll (sträng)
//   tavlaVarden(modell) → SVG-markup ovanpå kc-statistiktavla (KC_STATISTIK_FALT)
//   Modell = { exp, losta, antalElever, progress, laddad }
// ============================================================================

import { progressTillNasta, MAX_NIVA } from "./kc-niva.js";
import { KC_STATISTIK_FALT } from "../art-klasscenter-pokaler.js";

function heltal(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Lösta uppgifter ur klass-projektionens members-map (plays, annars completed). */
export function lostaUppgifter(members, studentIds) {
  const m = members && typeof members === "object" ? members : {};
  const ids = Array.isArray(studentIds) ? studentIds : Object.keys(m);
  let sum = 0;
  for (const id of new Set(ids)) {
    const e = m[id];
    if (!e || typeof e !== "object") continue;
    sum += typeof e.plays === "number" ? heltal(e.plays) : heltal(e.completed);
  }
  return sum;
}

/**
 * Tavlans modell. exp/antalElever saknas (null) = ännu inte laddat → laddad
 * false (tavlan visar "…"). losta null = kunde inte läsas → visas som "–".
 */
export function statistikModell({ exp = null, antalElever = null, losta = null } = {}) {
  const laddad = exp != null && antalElever != null;
  return {
    exp: laddad ? heltal(exp) : null,
    losta: losta == null ? null : heltal(losta),
    antalElever: antalElever == null ? null : Math.max(1, heltal(antalElever)),
    progress: laddad ? progressTillNasta(exp, antalElever) : null,
    laddad,
  };
}

/** Svensk tusentalsavgränsning med hårt mellanslag: 12345 → "12 345". */
export function talText(n) {
  return String(heltal(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Kort form för tavlans små rutor (max ~6 tecken). */
export function talKort(n) {
  const v = heltal(n);
  if (v < 100000) return talText(v);
  if (v < 1000000) return `${Math.floor(v / 1000)}k`;
  const m = Math.floor(v / 100000) / 10;
  return `${String(m).replace(".", ",")}M`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function procent(p) {
  return Math.round((p?.andel ?? 0) * 100);
}

/** Nivåradens text: "Nivå 3 Liten koja → Nivå 4 Timmerstuga" eller maxnivån. */
export function nivaRad(p) {
  if (!p) return "";
  if (p.max) return `Nivå ${p.niva} ${p.namn} – högsta nivån (${MAX_NIVA}) är nådd!`;
  return `Nivå ${p.niva} ${p.namn} → Nivå ${p.nasta} ${p.nastaNamn}`;
}

/** Stapelns text: "50 / 175 EXP · 125 kvar" (max: "Alla nivåer klara 🎉"). */
export function stapelText(p) {
  if (!p) return "";
  if (p.max) return `${talText(p.nuvarande)} EXP · alla nivåer klara 🎉`;
  return `${talText(p.nuvarande)} / ${talText(p.mal)} EXP · ${talText(p.kvar)} kvar`;
}

/** Panelens innehåll (rubriken och ✕ ligger i skalet, kc-rum-vy.js). */
export function panelHtml(m, { klassNamn = "" } = {}) {
  if (!m || !m.laddad) return `<p class="hint">Hämtar klassens statistik…</p>`;
  const p = m.progress;
  const losta = m.losta == null ? "–" : talText(m.losta);
  const vem = klassNamn ? `${esc(klassNamn)} har` : "Ni har";
  return (
    `<p class="hint">${vem} pluggat ihop till allt det här – ${talText(m.antalElever)} ` +
    `${m.antalElever === 1 ? "elev" : "elever"} tillsammans.</p>` +
    `<div class="kc-stat-rutor">` +
    `<div class="kc-stat-ruta"><span class="kc-stat-ikon" aria-hidden="true">⭐</span>` +
    `<b data-kc-stat="exp">${talText(m.exp)}</b><span>EXP totalt</span></div>` +
    `<div class="kc-stat-ruta"><span class="kc-stat-ikon" aria-hidden="true">✅</span>` +
    `<b data-kc-stat="losta">${losta}</b><span>lösta uppgifter tillsammans</span></div>` +
    `</div>` +
    `<div class="kc-stat-niva">` +
    `<div class="kc-stat-niva-rad" data-kc-stat="niva">🏛️ ${esc(nivaRad(p))}</div>` +
    `<div class="kc-stat-stapel${p.max ? " max" : ""}" role="progressbar" aria-valuemin="0" ` +
    `aria-valuemax="100" aria-valuenow="${procent(p)}" aria-label="Framsteg mot nästa nivå">` +
    `<span style="width:${procent(p)}%"></span></div>` +
    `<div class="kc-stat-stapel-text" data-kc-stat="stapel">${esc(stapelText(p))}</div>` +
    `</div>` +
    `<p class="kc-stat-fot">EXP = klassens gemensamma övningspoäng (bygger Klasscentret). ` +
    `Lösta uppgifter = alla avklarade omgångar i övningarna (quiz, memory, räkna …).</p>`
  );
}

/**
 * Siffrorna + stapeln ovanpå tavlans tomma fält (samma viewBox som
 * kc-statistiktavla, 260 × 180). Inte laddat → "…".
 */
export function tavlaVarden(m) {
  const f = KC_STATISTIK_FALT;
  const text = (falt, varde) =>
    `<text x="${falt.x + falt.w / 2}" y="${falt.y + falt.h / 2}" text-anchor="middle" ` +
    `dominant-baseline="central" font-size="${String(varde).length > 5 ? 15 : 19}" font-weight="800" ` +
    `fill="#FFF7DE" font-family="inherit">${esc(varde)}</text>`;
  const laddad = !!m?.laddad;
  const p = f.progress;
  const andel = laddad ? m.progress.andel : 0;
  const fyll = andel > 0
    ? `<rect x="${p.x}" y="${p.y}" width="${(p.w * andel).toFixed(1)}" height="${p.h}" rx="${p.h / 2}" ` +
      `fill="${m.progress.max ? "#F2C14E" : "#7BD389"}"/>`
    : "";
  return (
    text(f.exp, laddad ? talKort(m.exp) : "…") +
    text(f.losta, !laddad ? "…" : m.losta == null ? "–" : talKort(m.losta)) +
    fyll
  );
}
