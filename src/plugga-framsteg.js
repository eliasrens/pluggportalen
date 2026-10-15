// ============================================================================
// Pluggporten – elevens framsteg per kategori (plugga-framsteg.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #447: ELEVVYN av stjärnorna/kategorierna. Ren HTML-byggare
// (ingen DOM, ingen Firestore) ovanpå läs-API:t i plugga-stats.js:
//   • starHelpHtml()        – "Vad betyder stjärnorna?" (inbyggd <details>)
//   • areaProgressHtml()    – "Ditt framsteg" på områdets sida (#/elev/omrade)
//   • resultFeedbackHtml()  – "Så gick det" på resultatskärmen efter ett spel
//   • areaStarCount(), subjectColor(), isAreaNew() – korten på Plugga-
//     startsidan (#702); areaStarCount delas med areaProgressHtml()
//   • continueHereMode() – "Fortsätt här" på områdessidan (#703)
// Tonen följer Läsresan (src/lasresan/ui-summary.js): ALLTID positiv, aldrig
// "fel"/"dåligt", inga jämförelser med andra elever. Vi lyfter vad eleven blev
// bättre på och föreslår vänligt vad man kan träna på. Stjärn-/coin-/XP-
// ekonomin är orörd – här visas bara det som redan sparas.
//
// ⚠️ BOOTGRAF (#271): NY fil – importeras BARA dynamiskt (gamemodes.js,
// game-shared.js och pages-elev.js gör await import() med catch → ingen panel
// om den saknas; startsidans kort faller då tillbaka på orange utan stapel).
// Testad i test/plugga-framsteg.test.js.
// ============================================================================

import { summarizeStudent, categoryBreakdown, MAX_STARS_PER_MODE, toDate } from "./plugga-stats.js";
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

/** Svensk listfogning: ["A"] → "A", ["A","B"] → "A och B", ["A","B","C"] → "A, B och C". */
export function joinSv(items) {
  const list = (items || []).filter((x) => x != null && x !== "");
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} och ${list[list.length - 1]}`;
}

// Lägen där en felbesvarad fråga kommer tillbaka (runQuestions): stjärnorna och
// "x av y rätt" räknar rätt TILL SLUT, kategorierna det FÖRSTA svaret. Övriga
// lägen (Kunskapsjakt, äventyr) räknar kategorierna på alla svar.
const RETRY_MODES = new Set(["quiz", "lasforstaelse"]);

/** Fel på något FÖRSTA svar i ett läge där frågorna kommer tillbaka? (#467 F3) */
export function hadFirstTryMisses(catStats, mode) {
  return RETRY_MODES.has(mode) && categoryBreakdown(catStats).some((c) => c.t > c.r);
}
const name = (c) => `${c.icon} <b>${esc(c.short)}</b>`;

/**
 * "X av Y ★" för ett område – EN uträkning för korten på Plugga-startsidan och
 * "Ditt framsteg" inne i området (#702), så siffrorna alltid stämmer.
 * Y = stjärn-lägena × 3, X = sparade stjärnor i de lägena (högst 3 per läge).
 * @param {object} o
 * @param {string} o.areaId
 * @param {object} o.progress    studentData.progress
 * @param {string[]} o.starModes lägen som ger stjärnor (areaStarModes → id)
 * @returns {{stars:number, maxStars:number, pct:number}}
 */
export function areaStarCount({ areaId, progress, starModes = [] }) {
  const areaProgress = progress?.[areaId] || {};
  const stars = starModes.reduce((sum, m) => {
    const s = areaProgress[m]?.stars;
    return sum + (typeof s === "number" && s > 0 ? Math.min(MAX_STARS_PER_MODE, s) : 0);
  }, 0);
  const maxStars = starModes.length * MAX_STARS_PER_MODE;
  return { stars, maxStars, pct: maxStars ? Math.round((100 * stars) / maxStars) : 0 };
}

/**
 * "Ditt framsteg" för ett område.
 * @param {object} o
 * @param {string} o.areaId
 * @param {object} o.areaData   områdets innehåll (för vilka kategorier som finns)
 * @param {object} o.progress   studentData.progress
 * @param {string[]} o.starModes  lägen på sidan som ger stjärnor (för "X av Y")
 */
export function areaProgressHtml({ areaId, areaData, progress, starModes = [] }) {
  const { stars, maxStars, pct: starPct } = areaStarCount({ areaId, progress, starModes });

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
 * @param {string} [o.mode]              spelläget – quiz/läsförståelse räknar första
 *   svaret per fråga, övriga alla svar (rubriken säger vilket, #467 F3)
 * @param {number} [o.stars]             sessionens stjärnor (för ★★★-men-missar-raden)
 */
export function resultFeedbackHtml({ catStats, prevAreaProgress, noStars = false, mode = "", stars = 0 } = {}) {
  const help = noStars ? "" : starHelpHtml();
  const session = categoryBreakdown(catStats).filter((c) => c.t > 0);
  if (session.length === 0) return help ? `<div class="pf-resultat pf-resultat-tom">${help}</div>` : "";

  const before = summarizeStudent({ a: prevAreaProgress || {} }).perCategory;
  const beforeCat = Object.fromEntries(before.map((c) => [c.key, { r: c.r, t: c.t }]));
  const better = improvedCategories(beforeCat, catStats);
  const { best, practice } = pickHighlights(session);
  const allRight = session.every((c) => c.r === c.t);

  const lines = [];
  // Stjärnorna räknar rätt TILL SLUT (frågan kommer tillbaka), kategorierna det
  // första svaret – säg det rakt ut så kortet inte säger emot sig självt (#467 F3).
  if (stars >= 3 && hadFirstTryMisses(catStats, mode)) {
    lines.push("🌟 Alla rätt till slut! Här ser du hur det gick första gången du svarade.");
  }
  if (better.length) {
    lines.push(`📈 Du blev bättre på ${joinSv(better.map(name))} sedan förra gången!`);
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
    <p class="pf-resultat-sub">${RETRY_MODES.has(mode) ? "Rätt på första försöket" : "Räknat på alla dina svar"}</p>
    <ul class="pf-kat-lista">${session.map((c) => categoryRowHtml(c, rattText(c))).join("")}</ul>
    <ul class="pf-tips">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
    ${help}
  </div>`;
}

// ---------------------------------------------------------------------------
// Plugga-startsidan (#702): ämnesfärg och "Ny!"-märke på områdeskorten
// ---------------------------------------------------------------------------

/** .big-card-färgerna, i den ordning okända ämnen får dem (efter plats i listan). */
export const SUBJECT_COLORS = ["bla", "gron", "lila", "rosa", "orange"];

// Ämnets id ELLER namn (gemener) → färgklass (spec §2.2).
const SUBJECT_COLOR_TABLE = {
  so: "bla", "samhällskunskap": "bla", historia: "bla", geografi: "bla", religion: "bla",
  ma: "orange", matematik: "orange", matte: "orange",
  no: "gron", biologi: "gron", fysik: "gron", kemi: "gron", teknik: "gron",
  sv: "lila", svenska: "lila",
  en: "rosa", engelska: "rosa",
};

/**
 * Kortfärgen för ett ämne. Ett färgfält på ämnesdokumentet (`color`, en av
 * SUBJECT_COLORS) vinner, annars tabellen på id/namn, annars platsen i listan.
 * @param {object|string} subject  ämnesdokumentet ({ id, name, color? }) eller id/namn
 * @param {number} [index]         ämnets plats i listan (för okända ämnen)
 */
export function subjectColor(subject, index = 0) {
  const s = typeof subject === "string" ? { id: subject } : subject || {};
  const own = String(s.color || "").trim().toLowerCase();
  if (SUBJECT_COLORS.includes(own)) return own;
  for (const key of [s.id, s.name]) {
    const hit = SUBJECT_COLOR_TABLE[String(key ?? "").trim().toLowerCase()];
    if (hit) return hit;
  }
  const i = Number.isInteger(index) && index >= 0 ? index : 0;
  return SUBJECT_COLORS[i % SUBJECT_COLORS.length];
}

export const NEW_AREA_DAYS = 7;

/** Firestore-Timestamp, {seconds}, Date eller millisekunder → ms (annars null). */
function toMillis(t) {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return null;
}

/**
 * "Ny!" på ett områdeskort: området skapades (`area.createdAt`) eller
 * tilldelades (`assignment.assignedAt`) de senaste 7 dagarna OCH eleven har
 * inte spelat något i det än. Ingen tidsstämpel → aldrig nytt.
 * @param {object} o
 * @param {object} o.area          områdesdokumentet
 * @param {object} [o.assignment]  klassens rad i assignedAreas (om tilldelat)
 * @param {object} [o.progress]    studentData.progress
 * @param {number} [o.now]
 */
export function isAreaNew({ area, assignment = null, progress = null, now = Date.now() }) {
  const played = progress?.[area?.id];
  if (played && typeof played === "object" && Object.keys(played).length > 0) return false;
  const times = [toMillis(area?.createdAt), toMillis(assignment?.assignedAt)].filter((t) => t != null);
  if (times.length === 0) return false;
  const newest = Math.max(...times);
  return newest <= now && now - newest < NEW_AREA_DAYS * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Områdessidan (#703): markeringen "Fortsätt här"
// ---------------------------------------------------------------------------

/**
 * Vilket kort som får "Fortsätt här" (spec §3.3): läget eleven SENAST spelade
 * bland korten på sidan (`progress[areaId][mode].lastPlayed`). Har det läget
 * redan 3 stjärnor, eller är det låst, blir det ingen markering alls – vi
 * hoppar inte vidare till näst senaste. Aldrig spelat → null.
 * @param {object} areaProgress  progress[areaId]
 * @param {Array<{id:string, locked?:boolean}>} cards  korten i visningsordning
 * @returns {string|null}  lägets id
 */
export function continueHereMode(areaProgress, cards = []) {
  let latest = null;
  let latestMs = -Infinity;
  for (const c of cards) {
    const ms = toDate(areaProgress?.[c.id]?.lastPlayed)?.getTime();
    if (Number.isFinite(ms) && ms > latestMs) {
      latest = c;
      latestMs = ms;
    }
  }
  if (!latest || latest.locked) return null;
  const stars = areaProgress[latest.id]?.stars;
  return typeof stars === "number" && stars >= MAX_STARS_PER_MODE ? null : latest.id;
}
