// ============================================================================
// Pluggportalen – games-jakt.js
// Kunskapsjakt: snabba frågor på tid med combo-multiplikator. Rätt svar i rad
// höjer multiplikatorn (upp till ×5) och ger mer poäng; fel nollställer combon.
// Energisk design, poängräknare, ljudeffekter med mute-knapp. Coins i slutet
// beror på poängen. Innehållet är områdets quiz-frågor (loopas och blandas).
// ============================================================================

import { app, el } from "./ui.js";
import { sound } from "./fx.js";
import { gameFrame, muteButton, showResult, shuffle } from "./game-shared.js";

const ROUND_SECONDS = 40;

export function startKunskapsjakt(ctx) {
  const { subj, area } = ctx;

  const view = gameFrame({ subj, area, title: "Kunskapsjakt", emoji: "⚡" });
  view.querySelector(".game-head-right").appendChild(muteButton());
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // --- Startskärm ---
  const intro = el(`<div class="panel center jakt-intro">
    <div class="big-emoji">⚡</div>
    <h2>Kunskapsjakt!</h2>
    <p>Svara på så många frågor du kan på <b>${ROUND_SECONDS} sekunder</b>.</p>
    <p class="hint">Rätt svar i rad bygger en <b>combo</b> – ju högre combo, desto fler poäng per rätt! Ett fel nollställer combon (men det gör inget, kör bara på!).</p>
    <button class="btn stor gron" id="go">Starta jakten! 🚀</button>
  </div>`);
  intro.querySelector("#go").addEventListener("click", () => {
    sound.click();
    runRound(ctx, body);
  });
  body.replaceChildren(intro);
}

function runRound(ctx, body) {
  const { subj, area, areaData } = ctx;
  const pool = areaData.quiz || [];

  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let correct = 0;
  let timeLeft = ROUND_SECONDS;
  let queue = shuffle(pool);
  let qi = 0;
  let ended = false;

  const arena = el(`<div class="jakt-arena">
    <div class="jakt-stats">
      <div class="jakt-stat">
        <div class="jakt-label">Tid</div>
        <div class="jakt-value" id="time">${timeLeft}</div>
      </div>
      <div class="jakt-stat">
        <div class="jakt-label">Poäng</div>
        <div class="jakt-value" id="score">0</div>
      </div>
      <div class="jakt-stat combo-box" id="combo-box">
        <div class="jakt-label">Combo</div>
        <div class="jakt-value" id="combo">×1</div>
      </div>
    </div>
    <div class="jakt-timebar"><div class="jakt-timebar-fill" id="timefill"></div></div>
    <div class="jakt-question" id="q"></div>
    <div class="jakt-options" id="opts"></div>
    <div class="jakt-float" id="float"></div>
  </div>`);
  body.replaceChildren(arena);

  const timeEl = arena.querySelector("#time");
  const scoreEl = arena.querySelector("#score");
  const comboEl = arena.querySelector("#combo");
  const comboBox = arena.querySelector("#combo-box");
  const qEl = arena.querySelector("#q");
  const optsEl = arena.querySelector("#opts");
  const timeFill = arena.querySelector("#timefill");
  const floatEl = arena.querySelector("#float");

  function multiplier() {
    return Math.min(5, Math.max(1, combo)); // combo 0/1 → ×1, upp till ×5
  }

  function nextQuestion() {
    if (ended) return;
    if (qi >= queue.length) {
      queue = shuffle(pool);
      qi = 0;
    }
    const q = queue[qi++];
    const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answerIndex })));
    qEl.textContent = q.question;
    optsEl.innerHTML = opts
      .map((o, idx) => `<button class="jakt-opt" data-idx="${idx}" data-correct="${o.correct}">${o.text}</button>`)
      .join("");
    optsEl.querySelectorAll(".jakt-opt").forEach((btn) => {
      btn.addEventListener("click", () => answer(btn));
    });
  }

  function floatText(txt, cls) {
    const f = el(`<span class="float-item ${cls}">${txt}</span>`);
    floatEl.appendChild(f);
    setTimeout(() => f.remove(), 800);
  }

  function answer(btn) {
    if (ended) return;
    const isCorrect = btn.dataset.correct === "true";
    if (isCorrect) {
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      correct++;
      const gained = 10 * multiplier();
      score += gained;
      btn.classList.add("hit");
      sound.combo(combo);
      floatText(`+${gained}`, "good");
    } else {
      combo = 0;
      btn.classList.add("miss");
      optsEl.querySelectorAll(".jakt-opt").forEach((b) => {
        if (b.dataset.correct === "true") b.classList.add("show-correct");
      });
      sound.wrong();
      floatText("Miss!", "bad");
    }
    updateHud();
    if (isCorrect) {
      // Puls-animation på combo-rutan (efter updateHud, som annars nollar klassen).
      comboBox.classList.remove("bump");
      void comboBox.offsetWidth; // starta om animationen
      comboBox.classList.add("bump");
    }
    optsEl.querySelectorAll(".jakt-opt").forEach((b) => (b.disabled = true));
    setTimeout(nextQuestion, isCorrect ? 220 : 550);
  }

  function updateHud() {
    scoreEl.textContent = score;
    const mult = multiplier();
    comboEl.textContent = `×${mult}`;
    comboBox.className = "jakt-stat combo-box lvl" + mult;
    if (combo >= 2) comboBox.classList.add("hot");
  }

  const startedAt = Date.now();
  const timer = setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000;
    timeLeft = Math.max(0, ROUND_SECONDS - elapsed);
    timeEl.textContent = Math.ceil(timeLeft);
    timeFill.style.width = (timeLeft / ROUND_SECONDS) * 100 + "%";
    if (timeLeft <= 5) timeFill.classList.add("low");
    if (timeLeft <= 0) endRound();
  }, 100);

  function endRound() {
    if (ended) return;
    ended = true;
    clearInterval(timer);
    const stars = score >= 400 ? 3 : score >= 180 ? 2 : 1;
    const baseCoins = Math.min(25, Math.max(5, 4 + Math.round(score / 45)));
    showResult({
      container: body,
      subj, area, mode: "kunskapsjakt",
      stars,
      scoreLine: `${score} poäng · ${correct} rätt · bästa combo ×${Math.min(5, Math.max(1, bestCombo))}`,
      baseCoins,
      bestScore: score,
      replay: () => startKunskapsjakt(ctx),
    });
  }

  updateHud();
  nextQuestion();
}
