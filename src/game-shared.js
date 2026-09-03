// ============================================================================
// Pluggportalen – game-shared.js
// Gemensamt verktyg för alla gamemodes: metadata, små hjälpare, belöning
// (grind-skydd), övningsram, resultat-/firande-skärm och frågemotorn som
// Quiz och Läsförståelse delar. Själva spelen ligger i games-*.js.
// ============================================================================

import * as data from "./data.js";
import { app, el, go, renderTopbar } from "./ui.js";
import { confetti, sound, isMuted, toggleMuted } from "./fx.js";
import { addXp } from "./data-xp.js";
import { xpForExercise, xpIntoLevel } from "./leveling.js";
import { coinIcon } from "./icons.js";

export const enc = encodeURIComponent;

// Metadata för gamemodes: ordning, namn, ikon, färg och vilket innehåll de kräver.
export const GAMEMODES = [
  { id: "lasforstaelse", name: "Läsförståelse", emoji: "📖", color: "bla",
    sub: "Läs en text och svara på frågor", needs: "quiz" },
  { id: "para", name: "Para ihop", emoji: "🧩", color: "gron",
    sub: "Matcha begrepp med förklaring", needs: "pairs" },
  { id: "quiz", name: "Quiz", emoji: "❓", color: "orange",
    sub: "Flervalsfrågor med direkt svar", needs: "quiz" },
  { id: "kunskapsjakt", name: "Kunskapsjakt", emoji: "⚡", color: "rosa",
    sub: "Snabba frågor på tid – bygg combo!", needs: "quiz" },
  { id: "memory", name: "Memory", emoji: "🃏", color: "lila",
    sub: "Hitta fakta-paren", needs: "pairs" },
];

// ---------------------------------------------------------------------------
// Små hjälpare
// ---------------------------------------------------------------------------

/** Enkel HTML-escape för att lägga in text säkert i markup. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Blanda en array (kopia, Fisher–Yates). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Stjärnor (1–3) ur en andel rätt (0–1). Den som klarar övningen får minst 1. */
export function starsFromRatio(ratio) {
  if (ratio >= 0.99) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}

/** Rita stjärnrad, t.ex. ★★☆. */
export function starRow(stars, max = 3) {
  let s = "";
  for (let i = 0; i < max; i++) s += i < stars ? "★" : "☆";
  return s;
}

/** Uppmuntrande slutmening – aldrig skamsen, även vid få rätt. */
export function cheer(stars) {
  if (stars >= 3) return "Fantastiskt jobbat! Du är en stjärna! 🌟";
  if (stars >= 2) return "Bra kämpat! Du kan det här! 💪";
  return "Bra att du övar – du blir bättre för varje gång! 🚀";
}

/** Yttre ram för en pågående övning: tillbaka-länk + titel + kropp (#game-body). */
export function gameFrame({ subj, area, title, emoji, right = "" }) {
  const view = el(`<div>
    <a class="back-link" id="back">← Till området</a>
    <div class="game-head">
      <div class="game-title"><span class="game-emoji">${emoji}</span> ${title}</div>
      <div class="game-head-right">${right}</div>
    </div>
    <div id="game-body"></div>
  </div>`);
  view.querySelector("#back").addEventListener("click", () =>
    go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`)
  );
  return view;
}

/** Liten mute-knapp (delas av Kunskapsjakt m.fl.). */
export function muteButton() {
  const b = el(
    `<button class="mute-btn" title="Ljud på/av">${isMuted() ? "🔇" : "🔊"}</button>`
  );
  b.addEventListener("click", () => {
    const muted = toggleMuted();
    b.textContent = muted ? "🔇" : "🔊";
    if (!muted) sound.click();
  });
  return b;
}

// ---------------------------------------------------------------------------
// Belöning + framsteg
// ---------------------------------------------------------------------------

/**
 * Dela ut belöning (coins + XP) + spara framsteg för en avklarad övning.
 * Grind-skydd: bara första gången ger full pott, omspel ger ca 30 % (både coins
 * och XP), så det inte lönar sig att grinda samma övning. XP-potten (basXP +
 * stjärnor × perStar) definieras i leveling.js.
 * @returns {Promise<{coins:number, xp:number, totalXp:number, firstTime:boolean}>}
 */
export async function awardExercise(area, mode, { stars, bestScore, baseCoins }) {
  let firstTime = true;
  try {
    const progress = await data.getProgress();
    firstTime = !progress?.[area]?.[mode]?.completed;
  } catch {}
  let coins = Math.max(1, Math.round(baseCoins));
  let xp = xpForExercise(stars);
  if (!firstTime) {
    coins = Math.max(1, Math.round(baseCoins * 0.3));
    xp = Math.max(1, Math.round(xp * 0.3));
  }
  let totalXp = 0;
  try {
    await data.addCoins(coins);
  } catch {}
  try {
    totalXp = await addXp(xp);
  } catch {}
  try {
    await data.saveProgress(area, mode, { completed: true, stars, bestScore });
  } catch {}
  return { coins, xp, totalXp, firstTime };
}

/**
 * Gemensam resultat-/firande-skärm. Delar ut belöning och visar konfetti.
 * @param {object} opts
 * @param {function} opts.replay  startar om samma övning
 */
export async function showResult({ container, subj, area, mode, stars, scoreLine, baseCoins, bestScore, replay }) {
  container.innerHTML = `<div class="spinner">Sparar…</div>`;
  const { coins, xp, totalXp, firstTime } = await awardExercise(area, mode, { stars, bestScore, baseCoins });
  await renderTopbar(); // uppdatera coins-saldo + nivå i sidhuvudet

  // Levlade eleven upp av den här övningen? (jämför nivå före/efter XP-potten)
  const after = xpIntoLevel(totalXp);
  const before = xpIntoLevel(Math.max(0, totalXp - xp));
  const leveledUp = after.level > before.level;

  const view = el(`<div class="result-card panel center">
    <div class="result-emoji">${stars >= 2 ? "🎉" : "😀"}</div>
    <h1>Bra jobbat!</h1>
    <div class="result-stars">${starRow(stars)}</div>
    ${scoreLine ? `<p class="result-score">${scoreLine}</p>` : ""}
    <div class="coin-pop">${coinIcon(22)} +${coins} pluggcoins</div>
    <div class="xp-pop">⭐ +${xp} XP</div>
    ${leveledUp ? `<div class="levelup-pop">🎉 Ny nivå – du är nu <b>nivå ${after.level}</b>!</div>` : ""}
    ${firstTime ? "" : '<p class="hint">Du har spelat den här övningen förut, så du får lite färre coins och XP den här gången.</p>'}
    <p class="cheer">${cheer(stars)}</p>
    <div class="result-actions">
      <button class="btn gron" id="again">Spela igen</button>
      <button class="btn ghost" id="more">Till området</button>
    </div>
  </div>`);
  container.replaceChildren(view);
  if (stars >= 2) confetti();
  sound.finish();

  view.querySelector("#again").addEventListener("click", () => replay());
  view.querySelector("#more").addEventListener("click", () =>
    go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`)
  );
}

// ---------------------------------------------------------------------------
// Frågemotor (delas av Quiz och Läsförståelse)
// ---------------------------------------------------------------------------

// Hur många gånger en felsvarad fråga får komma tillbaka innan vi släpper den.
// Taket gör att en fråga eleven kämpar med inte loopar i all oändlighet.
const MAX_RETURNS = 2;

/**
 * Kör en omgång flervalsfrågor med direkt feedback och repetition inom rundan:
 * en fråga man svarar FEL på köas upp igen ett par frågor senare (med omblandade
 * svarsalternativ) tills den besvaras rätt, dock högst MAX_RETURNS gånger.
 *
 * Anropar onFinish(correct, total) när kön är tom. Både correct och total räknas
 * per UNIK fråga – repetitioner dubbelräknas alltså inte, så stjärnor/coins blir
 * rätt. total = antal unika frågor; correct = antal unika frågor eleven till slut
 * svarade rätt på.
 *
 * Progress-visningen är ärlig trots att kön kan växa: vi räknar unika frågor
 * eleven är klar med (rätt-svarade) av det totala antalet unika frågor, i stället
 * för att räkna varje kö-plats. Det gör att "Fråga X av Y" och progressbaren inte
 * hoppar bakåt eller överstiger Y när en fråga återkommer.
 *
 * reviewButton (valfri) läggs överst på varje fråga – används av Läsförståelse.
 *
 * showPassage (valfri): när sant visas frågans egna korta text (q.passage) i ett
 * lugnt block OVANFÖR just den frågan. Passage följer med i frågeobjektet, så den
 * visas korrekt även när en felsvarad fråga återkommer. Saknar frågan passage
 * visas inget extra block (aldrig hela texten på en gång) – se startLasforstaelse.
 * Quiz-läget skickar inte flaggan och är därför helt oförändrat.
 */
export function runQuestions({ body, questions, onFinish, reviewButton, showPassage }) {
  // Bygg ett frågeobjekt per unik fråga (med stabilt id för unik-räkningen).
  const built = shuffle(questions).map((q, id) => {
    const opts = q.options.map((text, i) => ({ text, correct: i === q.answerIndex }));
    return { id, question: q.question, explanation: q.explanation, passage: q.passage, options: shuffle(opts), returns: 0 };
  });

  const totalUnique = built.length;
  const resolved = new Set(); // id:n på frågor som till slut besvarats rätt

  // Kön av frågor att visa. Kan växa när fel-svarade frågor köas om.
  const queue = built.slice();
  let pos = 0;

  function renderQ() {
    const q = queue[pos];
    // Ärlig progress: hur många unika frågor är klara (rätt) av totalen.
    const doneUnique = resolved.size;
    const wrap = el(`<div class="quiz-wrap">
      <div class="quiz-progress">
        <div class="quiz-progress-bar" style="width:${(doneUnique / totalUnique) * 100}%"></div>
      </div>
      <p class="quiz-count">Fråga ${Math.min(doneUnique + 1, totalUnique)} av ${totalUnique}</p>
      ${showPassage && q.passage ? `<div class="lasf-passage"><span class="lasf-passage-emoji">📖</span><p>${esc(q.passage)}</p></div>` : ""}
      <div class="quiz-question">${q.question}</div>
      <div class="quiz-options">
        ${q.options
          .map((o, idx) => `<button class="quiz-opt" data-idx="${idx}">${o.text}</button>`)
          .join("")}
      </div>
      <div class="quiz-feedback" id="fb"></div>
      <div class="quiz-next" id="nextwrap"></div>
    </div>`);

    if (reviewButton) wrap.prepend(reviewButton());

    const fb = wrap.querySelector("#fb");
    const nextWrap = wrap.querySelector("#nextwrap");
    const optButtons = [...wrap.querySelectorAll(".quiz-opt")];

    optButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const chosen = q.options[Number(btn.dataset.idx)];
        optButtons.forEach((b, idx) => {
          b.disabled = true;
          if (q.options[idx].correct) b.classList.add("correct");
        });
        if (chosen.correct) {
          resolved.add(q.id); // unik fråga klar (räknas bara en gång)
          btn.classList.add("chosen-correct");
          sound.correct();
          fb.innerHTML = `<div class="msg ok">Rätt! ✅ ${q.explanation || ""}</div>`;
        } else {
          btn.classList.add("chosen-wrong");
          sound.wrong();
          fb.innerHTML = `<div class="msg soft">Inte riktigt – men bra försök! 💡 ${q.explanation || ""}</div>`;
          // Köa om frågan ett par frågor senare (om vi inte nått taket).
          if (q.returns < MAX_RETURNS) {
            q.returns++;
            q.options = shuffle(q.options); // blanda om alternativen till återkomsten
            const gap = 2 + Math.floor(Math.random() * 2); // 2–3 frågor senare
            const insertAt = Math.min(pos + gap, queue.length); // sist om vi är nära slutet
            queue.splice(insertAt, 0, q);
          }
        }
        const last = pos >= queue.length - 1;
        const next = el(`<button class="btn gron">${last ? "Se resultat" : "Nästa fråga →"}</button>`);
        next.addEventListener("click", () => {
          pos++;
          if (pos >= queue.length) onFinish(resolved.size, totalUnique);
          else renderQ();
        });
        nextWrap.replaceChildren(next);
      });
    });

    body.replaceChildren(wrap);
  }

  renderQ();
}
