// ============================================================================
// Pluggporten – elevens framsteg per kategori (plugga-framsteg.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #447: ELEVVYN av stjärnorna/kategorierna. Ren HTML-byggare
// (ingen DOM, ingen Firestore) ovanpå läs-API:t i plugga-stats.js:
//   • starHelpHtml()        – "Vad betyder stjärnorna?" (inbyggd <details>)
//   • areaProgressHtml()    – "Ditt framsteg" på områdets sida (#/elev/omrade)
//   • resultFeedbackHtml()  – "Så gick det" på resultatskärmen efter ett spel
// Tonen följer Läsresan (src/lasresan/ui-summary.js): ALLTID positiv, aldrig
// "fel"/"dåligt", inga jämförelser med andra elever. Vi lyfter vad eleven blev
// bättre på och föreslår vänligt vad man kan träna på. Stjärn-/coin-/XP-
// ekonomin är orörd – här visas bara det som redan sparas.
//
// ⚠️ BOOTGRAF (#271): NY fil – importeras BARA dynamiskt (gamemodes.js och
// game-shared.js gör await import() med catch → ingen panel om den saknas).
// Testad i test/plugga-framsteg.test.js.
// ============================================================================

import { summarizeStudent, categoryBreakdown, MAX_STARS_PER_MODE } from "./plugga-stats.js";
import { normalizeQuestionCategory } from "./question-categories.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Barnvänlig förklaring per kategori (åk 4) – lärartexten bor i question-categories.js. */
export const KID_HINTS = {
  begrepp: "vad ord betyder",
  fakta: "vem, vad, var och när",
  analys: "varför saker händer",
};

// Gränser för nivå-etiketten (samma 70 %-gräns som 2 stjärnor i starsFromRatio).
const GOOD_PCT = 70;
const GREAT_PCT = 90;

/** Positiv nivå-etikett för en kategori ({t, pct}). Aldrig skuldbeläggande. */
export function categoryLevel(c) {
  if (!c || !c.t) return { icon: "⚪", text: "Inte testat än", key: "ny" };
  if (c.pct >= GREAT_PCT) return { icon: "🌟", text: "Kan det jättebra", key: "topp" };
  if (c.pct >= GOOD_PCT) return { icon: "👍", text: "Kan det bra", key: "bra" };
  return { icon: "🌱", text: "Växer", key: "vaxer" };
}

/**
 * Vilka kategorier områdets innehåll faktiskt har frågor i (quiz + par, som
 * äventyren gör frågor av), i visningsordning.
 * @returns {string[]}
 */
export function areaCategoryKeys(areaData) {
  const found = new Set();
  for (const list of [areaData?.quiz, areaData?.pairs]) {
    if (!Array.isArray(list)) continue;
    for (const q of list) {
      const k = normalizeQuestionCategory(q?.category);
      if (k) found.add(k);
    }
  }
  return Object.keys(KID_HINTS).filter((k) => found.has(k));
}

/**
 * Plocka ut vad som ska lyftas fram: starkaste kategorin (minst GOOD_PCT) och
 * en att träna på (lägst under GOOD_PCT, annars en otestad som finns i området).
 * @param {Array} rows  categoryBreakdown-rader
 * @returns {{best: object|null, practice: object|null, untested: object|null}}
 */
export function pickHighlights(rows) {
  const tried = rows.filter((c) => c.t > 0);
  const byPct = [...tried].sort((a, b) => b.pct - a.pct || b.t - a.t);
  const best = byPct[0] && byPct[0].pct >= GOOD_PCT ? byPct[0] : null;
  const low = [...byPct].reverse().find((c) => c.pct < GOOD_PCT && c !== best) || null;
  const untested = rows.find((c) => c.t === 0) || null;
  return { best, practice: low, untested };
}

/**
 * Kategorier där sessionen gick tydligt bättre än elevens tidigare snitt i
 * området (minst 2 svar i båda och +10 procentenheter).
 * @param {object} beforeCat   { [kat]: {r,t} } före spelet
 * @param {object} sessionCat  { [kat]: {r,t} } detta spel
 * @returns {Array} categoryBreakdown-rader (sessionens)
 */
export function improvedCategories(beforeCat, sessionCat) {
  const before = categoryBreakdown(beforeCat);
  return categoryBreakdown(sessionCat).filter((s) => {
    const b = before.find((x) => x.key === s.key);
    return s.t >= 2 && b && b.t >= 2 && s.pct >= b.pct + 10;
  });
}

// ---------------------------------------------------------------------------
// HTML-byggare
// ---------------------------------------------------------------------------

/** "Vad betyder stjärnorna?" – stängd ruta som öppnas med ett tryck. */
export function starHelpHtml() {
  return `<details class="pf-hjalp">
    <summary>⭐ Vad betyder stjärnorna?</summary>
    <div class="pf-hjalp-body">
      <ul class="pf-hjalp-lista">
        <li><span class="pf-hjalp-stj" aria-label="1 stjärna">★☆☆</span> Du klarade övningen 🎉</li>
        <li><span class="pf-hjalp-stj" aria-label="2 stjärnor">★★☆</span> Du kunde det mesta</li>
        <li><span class="pf-hjalp-stj" aria-label="3 stjärnor">★★★</span> Du kunde allt – toppen!</li>
      </ul>
      <p>Varje övning kan ge <b>3 stjärnor</b>. Din bästa gång sparas, så du tappar aldrig stjärnor.
        Spela igen för att samla fler!</p>
    </div>
  </details>`;
}

function categoryRowHtml(c, countText) {
  const lvl = categoryLevel(c);
  return `<li class="pf-kat pf-kat-${lvl.key}" style="--kat:${esc(c.hex)}">
    <span class="pf-kat-ikon" aria-hidden="true">${c.icon}</span>
    <span class="pf-kat-namn"><b>${esc(c.short)}</b><small>${esc(KID_HINTS[c.key] || "")}</small></span>
    <span class="pf-kat-niva">${lvl.icon} ${lvl.text}</span>
    <span class="pf-kat-bar" aria-hidden="true"><i style="width:${c.pct || 0}%"></i></span>
    <span class="pf-kat-tal">${countText}</span>
  </li>`;
}

const rattText = (c) => (c.t ? `${c.r} av ${c.t} rätt` : "Spela för att se");
const name = (c) => `${c.icon} <b>${esc(c.short)}</b>`;

/**
 * "Ditt framsteg" för ett område.
 * @param {object} o
 * @param {string} o.areaId
 * @param {object} o.areaData   områdets innehåll (för vilka kategorier som finns)
 * @param {object} o.progress   studentData.progress
 * @param {string[]} o.starModes  lägen på sidan som ger stjärnor (för "X av Y")
 */
export function areaProgressHtml({ areaId, areaData, progress, starModes = [] }) {
  const areaProgress = progress?.[areaId] || {};
  const stars = starModes.reduce((sum, m) => {
    const s = areaProgress[m]?.stars;
    return sum + (typeof s === "number" && s > 0 ? Math.min(MAX_STARS_PER_MODE, s) : 0);
  }, 0);
  const maxStars = starModes.length * MAX_STARS_PER_MODE;
  const starPct = maxStars ? Math.round((100 * stars) / maxStars) : 0;

  const summary = summarizeStudent(progress, { areaIds: [areaId] });
  const keys = areaCategoryKeys(areaData);
  // Visa områdets kategorier – plus ev. sådana eleven har svar i (om läraren
  // tagit bort taggarna efteråt), så sparade framsteg aldrig "försvinner".
  const rows = summary.perCategory.filter((c) => keys.includes(c.key) || c.t > 0);

  let body;
  if (rows.length === 0) {
    // Fallback (område utan kategorier): bara stjärnorna, tydligt förklarade.
    body = `<p class="pf-text">Här ser du hur många stjärnor du har samlat i området.
      Varje övning ovanför kan ge upp till 3 ★.</p>`;
  } else {
    const { best, practice, untested } = pickHighlights(rows);
    const tips = [];
    if (best) tips.push(`<li>💪 Det här kan du bäst: ${name(best)}!</li>`);
    if (practice) {
      tips.push(`<li>💡 Träna gärna mer på ${name(practice)} – ${esc(KID_HINTS[practice.key])}.</li>`);
    } else if (untested) {
      tips.push(`<li>🔎 Testa frågor om ${esc(KID_HINTS[untested.key])} (${name(untested)}).</li>`);
    }
    if (!summary.hasCategoryData) {
      tips.push(`<li>🚀 Spela Quiz, Kunskapsjakt eller ett äventyr – då ser du här vad du kan!</li>`);
    }
    body = `<p class="pf-text">Frågorna här tränar olika saker. Så här går det för dig:</p>
      <ul class="pf-kat-lista">${rows.map((c) => categoryRowHtml(c, rattText(c))).join("")}</ul>
      ${tips.length ? `<ul class="pf-tips">${tips.join("")}</ul>` : ""}`;
  }

  return `<section class="panel pf-panel" aria-label="Ditt framsteg">
    <div class="pf-topp">
      <h2>⭐ Ditt framsteg</h2>
      ${maxStars ? `<span class="pf-stj-tal"><b>${stars}</b> av ${maxStars} ★</span>` : ""}
    </div>
    ${maxStars ? `<div class="pf-stj-bar" aria-hidden="true"><i style="width:${starPct}%"></i></div>` : ""}
    ${body}
    ${starHelpHtml()}
  </section>`;
}

/**
 * "Så gick det" på resultatskärmen. Tom sträng om spelet inte gav någon
 * kategori-räkning (lägen/områden utan kategorier) – då visas bara hjälpen.
 * @param {object} o
 * @param {object} [o.catStats]          sessionens { [kat]: {r,t} }
 * @param {object} [o.prevAreaProgress]  progress[areaId] FÖRE spelet
 * @param {boolean} [o.noStars]          lägen utan stjärnor (Memory) → ingen hjälp
 */
export function resultFeedbackHtml({ catStats, prevAreaProgress, noStars = false } = {}) {
  const help = noStars ? "" : starHelpHtml();
  const session = categoryBreakdown(catStats).filter((c) => c.t > 0);
  if (session.length === 0) return help ? `<div class="pf-resultat pf-resultat-tom">${help}</div>` : "";

  const before = summarizeStudent({ a: prevAreaProgress || {} }).perCategory;
  const beforeCat = Object.fromEntries(before.map((c) => [c.key, { r: c.r, t: c.t }]));
  const better = improvedCategories(beforeCat, catStats);
  const { best, practice } = pickHighlights(session);
  const allRight = session.every((c) => c.r === c.t);

  const lines = [];
  if (better.length) {
    lines.push(`📈 Du blev bättre på ${better.map(name).join(" och ")} sedan förra gången!`);
  } else if (allRight) {
    lines.push("🌟 Allt rätt – du kan det här!");
  } else if (best) {
    lines.push(`🌟 Du var extra bra på ${name(best)}!`);
  } else {
    lines.push("💪 Bra kämpat! Varje gång du övar lär du dig mer.");
  }
  if (practice && !allRight) {
    lines.push(`💡 Nästa gång: träna lite mer på ${name(practice)} – ${esc(KID_HINTS[practice.key])}.`);
  }

  return `<div class="pf-resultat">
    <h3>Så gick det</h3>
    <ul class="pf-kat-lista">${session.map((c) => categoryRowHtml(c, rattText(c))).join("")}</ul>
    <ul class="pf-tips">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
    ${help}
  </div>`;
}
