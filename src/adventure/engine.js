// ============================================================================
// Pluggportalen – äventyrsmotorn: engine.js  (startAdventure)
// ----------------------------------------------------------------------------
// Den TEMA-AGNOSTISKA motorn: sätter ihop grid (grid.js), rörelse/kollision
// (movement.js), tangentstyrning (input.js) och frågeadaptern
// (question-adapter.js) till en spelbar bana och kör en självstädande rAF-loop
// (samma mönster som husdjurens promenad-AI i rum-promenad.js: loopen stoppar när
// scenen lämnar DOM:en). Allt tema-specifikt – karta, färger, grafik, ikoner,
// texter, slutmål – kommer via en tema-config (se themes/*.js och §3.3 i planen);
// motorn känner INTE till något om skog/rymd/osv.
//
// Flöde: avataren går fritt på gridet → står bredvid en station → trycker E/knapp
// → frågemodalen fryser spelet → rätt svar markerar stationen klar och räknar upp
// framsteget → när målet (theme.goal, default = antal stationer) nås dyker
// slutmålet upp → gå fram till det → showResult/awardExercise (grind-skalat,
// 1–3 stjärnor ur antal fel) via reward.js. Fel svar är alltid snällt, aldrig
// game over – det påverkar bara stjärnorna.
// ============================================================================

import { avatarMarkup, DEFAULT_AVATAR } from "../avatars.js";
import { parseMap, cellCenter, tileSizePct, makeBlockedAt } from "./grid.js";
import { moveStep, nearestWithin, dist } from "./movement.js";
import { createInput } from "./input.js";
import { awardAdventure } from "./reward.js";

const SPEED = 34; // %/s – lugnt men responsivt promenadtempo på gridet
const MARGIN = 1.5; // % marginal mot scenkanten

/** HTML-escape för tema-/lärar-text i prompt/hud. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Starta ett äventyr.
 * @param {object} o
 * @param {HTMLElement} o.mount   elementet motorn ritar i (töms & fylls)
 * @param {object} o.theme        tema-config (§3.3)
 * @param {object} o.questions    frågeadapter { askNext, remaining, reset, hasQuestions }
 * @param {{avatarHtml:string}} o.player  elevens avatar-markup (redan med klädsel)
 * @param {string} [o.subj]       ämne (för belöning/navigering)
 * @param {string} [o.area]       område (för belöning/navigering)
 * @param {(result:object)=>void} [o.onComplete]  extra hook när banan är klar
 * @param {()=>void} [o.onReplay]  starta om banan (skickas till resultatskärmen)
 * @returns {{destroy:()=>void}}  controller (stoppar loop + städar lyssnare)
 */
export function startAdventure({ mount, theme, questions, player, subj, area, onComplete, onReplay }) {
  const grid = parseMap(theme.map, theme.legend);
  const tile = tileSizePct(grid.cols, grid.rows);
  const blockedAt = makeBlockedAt(grid);
  const interactRadius = Math.max(tile.w, tile.h) * 0.85;

  const goal = Number.isFinite(theme.goal) ? theme.goal : grid.stations.length;
  const progressIcon = theme.progressIcon || "⭐";
  const avatarHtml = (player && player.avatarHtml) || avatarMarkup(DEFAULT_AVATAR, []);

  // --- Scen-DOM -------------------------------------------------------------
  const stage = document.createElement("div");
  stage.className = "adventure-stage";
  stage.style.setProperty("--adv-himmel", theme.stamning?.himmel || "#bfe3ff");
  stage.style.setProperty("--adv-mark", theme.stamning?.mark || "#8FCB74");

  stage.innerHTML =
    `<div class="adv-tiles" aria-hidden="true">${renderTiles()}</div>` +
    `<div class="adv-stations" id="adv-stations">${renderStations()}</div>` +
    `<div class="adv-goal" id="adv-goal" hidden></div>` +
    `<div class="adv-hud">` +
    `<span class="adv-progress"><span class="adv-progress-icon">${progressIcon}</span> ` +
    `<b id="adv-count">0</b> / ${goal}</span></div>` +
    `<div class="adv-prompt" id="adv-prompt" hidden></div>` +
    `<div class="adventure-player" id="adv-player"><div class="adv-avatar">${avatarHtml}</div></div>`;

  const intro = document.createElement("div");
  intro.className = "adv-intro panel center";
  intro.innerHTML =
    `<div class="big-emoji">${progressIcon}</div>` +
    `<h2>${esc(theme.namn || "Äventyr")}</h2>` +
    `<p>${esc(theme.texter?.intro || "Gå runt och svara rätt vid varje station för att nå målet!")}</p>` +
    `<p class="hint">Styr med <b>piltangenter</b> eller <b>WASD</b>. Gå fram till en station och tryck <b>E</b> (eller mellanslag) för att svara.</p>` +
    `<button class="btn stor gron" id="adv-go">Starta! 🚀</button>`;

  mount.replaceChildren(intro);
  intro.querySelector("#adv-go").addEventListener("click", () => {
    mount.replaceChildren(stage);
    begin();
  });

  // --- Rendering-hjälpare ---------------------------------------------------
  function tileArtFor(t) {
    if (theme.tileArt && typeof theme.tileArt[t.type] === "function") {
      return theme.tileArt[t.type](t);
    }
    return ""; // färg räcker (via CSS-klass) för ett minimalt tema
  }
  function renderTiles() {
    return grid.tiles
      .map((t) => {
        const c = cellCenter(t.col, t.row, grid.cols, grid.rows);
        return (
          `<div class="adv-tile adv-tile-${t.type}" style="left:${c.x}%;top:${c.y}%;` +
          `width:${tile.w}%;height:${tile.h}%">${tileArtFor(t)}</div>`
        );
      })
      .join("");
  }
  function renderStations() {
    return grid.stations
      .map((s, i) => {
        const c = cellCenter(s.col, s.row, grid.cols, grid.rows);
        const art = theme.stationArt ? theme.stationArt() : progressIcon;
        return (
          `<div class="adv-station" data-station="${i}" style="left:${c.x}%;top:${c.y}%">` +
          `<span class="adv-station-art">${art}</span></div>`
        );
      })
      .join("");
  }

  // --- Speltillstånd --------------------------------------------------------
  const startCell = grid.start || grid.stations[0] || { col: 0, row: 0 };
  const pos = cellCenter(startCell.col, startCell.row, grid.cols, grid.rows);
  const stationPts = grid.stations.map((s) => cellCenter(s.col, s.row, grid.cols, grid.rows));
  const cleared = new Set(); // index på klarade stationer
  const goalCell = grid.goal || grid.stations[grid.stations.length - 1] || startCell;
  const goalPt = cellCenter(goalCell.col, goalCell.row, grid.cols, grid.rows);

  let mistakes = 0;
  let facingLeft = false;
  let goalActive = false; // slutmålet framme (alla stationer klara)
  let finished = false;
  let busy = false; // en modal är öppen → frys
  let last = 0;
  let raf = 0;
  let started = false;
  const startTime = Date.now();

  // DOM-referenser (efter att stage monterats vid begin()).
  let playerEl, promptEl, countEl, goalEl, stationsWrap;
  const input = createInput({ onInteract: tryInteract });

  function begin() {
    if (started) return;
    started = true;
    playerEl = stage.querySelector("#adv-player");
    promptEl = stage.querySelector("#adv-prompt");
    countEl = stage.querySelector("#adv-count");
    goalEl = stage.querySelector("#adv-goal");
    stationsWrap = stage.querySelector("#adv-stations");
    // Avatarens storlek: skala mot rutstorleken så figuren fyller ~en ruta.
    playerEl.style.fontSize = (theme.avatarScale || Math.max(tile.w, tile.h) * 0.9) + "cqw";
    placePlayer();
    window.addEventListener("hashchange", onHashChange);
    raf = requestAnimationFrame(tick);
  }

  function placePlayer() {
    playerEl.style.left = pos.x + "%";
    playerEl.style.top = pos.y + "%";
    playerEl.classList.toggle("vand-vanster", facingLeft);
  }

  // --- Interaktion + frågetrigger -------------------------------------------
  function currentTarget() {
    // Slutmålet har prioritet när det är framme.
    if (goalActive) {
      if (dist(pos, goalPt) <= interactRadius) return { type: "goal" };
      return null;
    }
    // Närmaste ICKE-klarade station inom räckhåll.
    const open = stationPts
      .map((p, i) => ({ p, i }))
      .filter((o) => !cleared.has(o.i));
    const hit = nearestWithin(pos, open.map((o) => o.p), interactRadius);
    if (!hit) return null;
    return { type: "station", index: open[hit.index].i };
  }

  function updatePrompt() {
    if (busy || finished) {
      promptEl.hidden = true;
      return;
    }
    const t = currentTarget();
    if (!t) {
      promptEl.hidden = true;
      return;
    }
    const text =
      t.type === "goal"
        ? theme.texter?.goalPrompt || "Du är framme vid målet! Tryck för att avsluta 🎉"
        : theme.texter?.stationPrompt || "En kunskapsstation! Tryck E för att svara.";
    promptEl.textContent = text;
    promptEl.hidden = false;
  }

  async function tryInteract() {
    if (busy || finished || !started) return;
    const t = currentTarget();
    if (!t) return;
    if (t.type === "goal") return finish();
    // Station: frys spelet och ställ frågan.
    busy = true;
    input.setFrozen(true);
    playerEl.classList.remove("gar");
    promptEl.hidden = true;
    let res;
    try {
      res = await questions.askNext({
        title: theme.texter?.stationTitle || "Kunskapsstation",
        emoji: progressIcon,
      });
    } finally {
      busy = false;
      input.setFrozen(false);
    }
    if (finished) return;
    if (res && res.correct && !res.cancelled) {
      clearStation(t.index);
    } else if (res && !res.cancelled) {
      mistakes++; // fel svar: snällt, stationen är kvar att försöka igen på
    }
  }

  function clearStation(index) {
    if (cleared.has(index)) return;
    cleared.add(index);
    const node = stationsWrap.querySelector(`.adv-station[data-station="${index}"]`);
    if (node) node.classList.add("cleared");
    countEl.textContent = String(cleared.size);
    if (cleared.size >= goal) spawnGoal();
  }

  function spawnGoal() {
    if (goalActive) return;
    goalActive = true;
    goalEl.style.left = goalPt.x + "%";
    goalEl.style.top = goalPt.y + "%";
    goalEl.innerHTML =
      `<span class="adv-goal-art">${theme.goalArt ? theme.goalArt() : "🏆"}</span>`;
    goalEl.hidden = false;
  }

  function finish() {
    if (finished) return;
    finished = true;
    teardown();
    const result = {
      stationsCleared: cleared.size,
      mistakes,
      elapsedMs: Date.now() - startTime,
      goal,
    };
    onComplete && onComplete(result);
    awardAdventure({
      container: mount,
      subj,
      area,
      theme,
      result,
      replay: () => (onReplay ? onReplay() : null),
    });
  }

  // --- Loop -----------------------------------------------------------------
  function tick(now) {
    if (finished) return;
    if (!mount.isConnected) return teardown(); // sidan lämnad → städa (som promenad-AI:n)
    const dt = Math.min((now - last) / 1000, 0.05) || 0; // flik i bakgrunden → inga skutt
    last = now;

    if (!busy) {
      const step = moveStep(pos, input.dir(), { speed: SPEED, dt, blockedAt, margin: MARGIN });
      pos.x = step.x;
      pos.y = step.y;
      if (step.facingLeft !== null) facingLeft = step.facingLeft;
      playerEl.classList.toggle("gar", step.moving);
      if (step.moving) placePlayer();
    }
    updatePrompt();
    raf = requestAnimationFrame(tick);
  }

  function onHashChange() {
    teardown();
  }

  function teardown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    input.destroy();
    window.removeEventListener("hashchange", onHashChange);
  }

  return {
    destroy() {
      finished = true;
      teardown();
    },
  };
}
