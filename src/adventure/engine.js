// ============================================================================
// Pluggportalen – äventyrsmotorn: engine.js  (startAdventure)
// ----------------------------------------------------------------------------
// Den TEMA-AGNOSTISKA motorn: sätter ihop en VÄRLD (koordinater/kollision) och en
// SCEN (DOM/rendering) med rörelse (movement.js), tangentstyrning (input.js) och
// frågeadaptern (question-adapter.js) till en spelbar bana och kör en självstädande
// rAF-loop (samma mönster som husdjurens promenad-AI: loopen stoppar när scenen
// lämnar DOM:en). Allt tema-specifikt – karta, färger, grafik, texter, slutmål –
// kommer via en tema-config (se themes/*.js och themes/README.md).
//
// TVÅ VÄRLDS-LÄGEN bakom exakt samma spel-logik (issue #220):
//   • grid  (default) – liten ASCII-ruta i PROCENT-koordinater (Spökjakten/Gruvan
//     funkar precis som förr).
//   • scroll (opt-in när theme.mapImage finns) – stor rasterbild i PIXEL-
//     koordinater med scrollande kamera (world.js + camera.js + scene-scroll.js).
// Loopen/interaktionen nedan pratar bara med ett litet space- + scene-gränssnitt,
// så koordinatsystemet är utbytbart utan att röra spel-, fråge- eller belöningslogik.
//
// Flöde: avataren går fritt → står nära en station → trycker E/knapp → frågemodalen
// fryser spelet → rätt svar markerar stationen klar och räknar upp framsteget → när
// målet nås dyker slutmålet upp → gå fram till det → awardAdventure (grind-skalat,
// 1–3 stjärnor). Fel svar är alltid snällt, aldrig game over – bara stjärnorna.
// Interaktions-räckvidden mäts ISOTROPT (samma åt alla håll) så ett objekt kan
// aktiveras från vilken sida som helst (fix för #218), men bara på nära håll och
// bara en gång per objekt.
// ============================================================================

import { avatarMarkup, DEFAULT_AVATAR } from "../avatars.js";
import { parseMap, cellCenter, tileSizePct, makeBlockedAt, cellDistance } from "./grid.js";
import { moveStep } from "./movement.js";
import { createInput } from "./input.js";
import { createImageWorld } from "./world.js";
import { createScrollScene } from "./scene-scroll.js";
import { playerAvatarHtml, playHack } from "./hand-tool.js";
import { awardAdventure } from "./reward.js";

const SPEED = 34; // %/s – lugnt men responsivt promenadtempo på grid-läget
const MARGIN = 1.5; // % marginal mot scenkanten (grid-läget)
const GRID_REACH = 1.25; // interaktionsradie i RUTOR (isotropt) för grid-läget

/** HTML-escape för tema-/lärar-text i intro/hud. */
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
 * @param {object} o.theme        tema-config (§3.3 / themes/README.md)
 * @param {object} o.questions    frågeadapter { askNext, remaining, reset, hasQuestions }
 * @param {{avatarHtml:string}} o.player  elevens avatar-markup (redan med klädsel)
 * @param {string} [o.subj]       ämne (för belöning/navigering)
 * @param {string} [o.area]       område (för belöning/navigering)
 * @param {(result:object)=>void} [o.onComplete]  extra hook när banan är klar
 * @param {()=>void} [o.onReplay]  starta om banan (skickas till resultatskärmen)
 * @returns {{destroy:()=>void}}  controller (stoppar loop + städar lyssnare)
 */
export function startAdventure({ mount, theme, questions, player, subj, area, onComplete, onReplay }) {
  const progressIcon = theme.progressIcon || "⭐";
  const avatarHtml = (player && player.avatarHtml) || avatarMarkup(DEFAULT_AVATAR, []);

  // Välj VÄRLD (koordinater/kollision) och SCEN (DOM) utifrån temat.
  const space = (theme.mapImage || theme.mapSvg) ? createImageWorld(theme) : createGridSpace(theme);
  const goal = Number.isFinite(theme.goal) ? theme.goal : space.stations.length;
  const scene = space.scroll
    ? createScrollScene({ world: space, theme, avatarHtml, progressIcon, goal })
    : createGridScene({ space, theme, avatarHtml, progressIcon, goal });

  // --- Introskärm (läges-oberoende) -----------------------------------------
  const intro = document.createElement("div");
  intro.className = "adv-intro panel center";
  intro.innerHTML =
    `<div class="big-emoji">${progressIcon}</div>` +
    `<h2>${esc(theme.namn || "Äventyr")}</h2>` +
    `<p>${esc((theme.texter && theme.texter.intro) || "Gå runt och svara rätt vid varje station för att nå målet!")}</p>` +
    `<p class="hint">Styr med <b>piltangenter</b>/<b>WASD</b> – eller <b>håll fingret</b> på spelytan och gå mot det. Gå fram till en station och tryck <b>E</b>/mellanslag (eller <b>tryck</b> på spelytan) för att svara.</p>` +
    `<button class="btn stor gron" id="adv-go">Starta! 🚀</button>`;

  mount.replaceChildren(intro);
  intro.querySelector("#adv-go").addEventListener("click", () => {
    mount.replaceChildren(scene.stage);
    begin();
  });

  // --- Speltillstånd --------------------------------------------------------
  const pos = { x: space.start.x, y: space.start.y };
  const cleared = new Set(); // index på klarade stationer
  let mistakes = 0;
  let facingLeft = false;
  let goalActive = false; // slutmålet framme (alla stationer klara)
  let finished = false;
  let busy = false; // en modal är öppen → frys
  let last = 0;
  let raf = 0;
  let started = false;
  const startTime = Date.now();
  // Touch-styrning (issue #250): peklyssnare på SPELYTAN (scene.stage), inte window,
  // så bara spelytan styr. getAimOrigin ger avatarens skärmpunkt så "gå mot fingret"
  // riktas rätt i grid-läget; scroll-scenen saknar den ⇒ null ⇒ spelytans mitt
  // (avataren är då visuellt centrerad). Tangentbordet ligger kvar på window som förr.
  const input = createInput({
    onInteract: tryInteract,
    pointerTarget: scene.stage,
    getAimOrigin: () => (scene.getAimOrigin ? scene.getAimOrigin() : null),
  });
  const isCoarsePointer =
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

  function begin() {
    if (started) return;
    started = true;
    scene.begin();
    scene.placePlayer(pos, facingLeft);
    scene.frame(pos, 0); // initiera kameran på spelaren (scroll: snäpp, grid: no-op)
    window.addEventListener("hashchange", onHashChange);
    raf = requestAnimationFrame(tick);
  }

  // --- Interaktion + frågetrigger (ISOTROP räckvidd, alla håll) --------------
  function currentTarget() {
    if (goalActive) {
      if (space.reach(pos, space.goal) <= space.interactRadius) return { type: "goal" };
      return null;
    }
    // Närmaste ICKE-klarade station inom (isotrop) räckvidd.
    let best = null;
    for (let i = 0; i < space.stations.length; i++) {
      if (cleared.has(i)) continue;
      const d = space.reach(pos, space.stations[i]);
      if (d <= space.interactRadius && (!best || d < best.d)) best = { index: i, d };
    }
    if (!best) return null;
    return { type: "station", index: best.index };
  }

  function updatePrompt() {
    if (busy || finished) return scene.setPrompt(null);
    const t = currentTarget();
    if (!t) return scene.setPrompt(null);
    const text =
      t.type === "goal"
        ? (theme.texter && theme.texter.goalPrompt) || "Du är framme vid målet! Tryck för att avsluta 🎉"
        : (theme.texter && theme.texter.stationPrompt) || "En kunskapsstation! Tryck E för att svara.";
    // Touch (#250): temats prompt är skriven för tangentbord ("Tryck E …"); på
    // pekskärm finns ingen E-tangent, så på coarse-pointer byts den mot "tryck på
    // skärmen" (interagera funkar redan via TAP på spelytan/prompten). Desktop orört.
    scene.setPrompt(isCoarsePointer ? text.replace(/Tryck E( \(eller mellanslag\))?/g, "Tryck på skärmen") : text);
  }

  async function tryInteract() {
    if (busy || finished || !started) return;
    const t = currentTarget();
    if (!t) return;
    if (t.type === "goal") return finish();
    // Station: frys spelet och ställ frågan.
    busy = true;
    input.setFrozen(true);
    scene.setWalking(false);
    scene.setPrompt(null);
    let res;
    try {
      res = await questions.askNext({
        title: (theme.texter && theme.texter.stationTitle) || "Kunskapsstation",
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
    if (cleared.has(index)) return; // varje station triggar bara en gång
    cleared.add(index);
    scene.playHack && scene.playHack(); // kort hack/hugg-rörelse: stationen "bryts"
    scene.markStationCleared(index);
    scene.setCount(cleared.size);
    if (cleared.size >= goal) spawnGoal();
  }

  function spawnGoal() {
    if (goalActive) return;
    goalActive = true;
    scene.spawnGoal(space.goal);
  }

  function finish() {
    if (finished) return;
    finished = true;
    teardown();
    const result = { stationsCleared: cleared.size, mistakes, elapsedMs: Date.now() - startTime, goal };
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
      const step = moveStep(pos, input.dir(), {
        speed: space.speed,
        dt,
        blockedAt: space.blockedAt,
        margin: space.margin,
        maxX: space.maxX,
        maxY: space.maxY,
      });
      pos.x = step.x;
      pos.y = step.y;
      if (step.facingLeft !== null) facingLeft = step.facingLeft;
      scene.setWalking(step.moving);
      if (step.moving) scene.placePlayer(pos, facingLeft);
    }
    scene.frame(pos, dt); // mjuk kamera-följning (scroll); no-op i grid-läget
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
    if (scene.teardown) scene.teardown();
    window.removeEventListener("hashchange", onHashChange);
  }

  return {
    destroy() {
      finished = true;
      teardown();
    },
  };
}

// ============================================================================
// GRID-VÄRLDEN (default) – liten ASCII-ruta i PROCENT-koordinater.
// Oförändrat beteende mot före #220: samma karta, samma tiles, samma placeringar.
// Enda skillnaden är att interaktions-räckvidden nu mäts i RUTOR (isotropt) i
// stället för i råa procent → objekt kan aktiveras från alla håll (fix #218).
// ============================================================================
function createGridSpace(theme) {
  const grid = parseMap(theme.map, theme.legend);
  const tile = tileSizePct(grid.cols, grid.rows);
  const blockedAt = makeBlockedAt(grid);
  const startCell = grid.start || grid.stations[0] || { col: 0, row: 0 };
  const goalCell = grid.goal || grid.stations[grid.stations.length - 1] || startCell;
  return {
    scroll: false,
    size: { w: 100, h: 100 },
    maxX: 100,
    maxY: 100,
    start: cellCenter(startCell.col, startCell.row, grid.cols, grid.rows),
    stations: grid.stations.map((s) => cellCenter(s.col, s.row, grid.cols, grid.rows)),
    goal: cellCenter(goalCell.col, goalCell.row, grid.cols, grid.rows),
    blockedAt,
    reach: (a, b) => cellDistance(a, b, grid.cols, grid.rows),
    interactRadius: GRID_REACH,
    speed: SPEED,
    margin: MARGIN,
    grid,
    tile,
  };
}

// ============================================================================
// GRID-SCENEN (default) – bygger EXAKT samma DOM/CSS som före #220 och exponerar
// samma lilla scene-gränssnitt som scroll-scenen så motor-loopen är gemensam.
// ============================================================================
function createGridScene({ space, theme, avatarHtml, progressIcon, goal }) {
  const { grid, tile } = space;

  function tileArtFor(t) {
    if (theme.tileArt && typeof theme.tileArt[t.type] === "function") return theme.tileArt[t.type](t);
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
    return space.stations
      .map((c, i) => {
        const art = theme.stationArt ? theme.stationArt() : progressIcon;
        return (
          `<div class="adv-station" data-station="${i}" style="left:${c.x}%;top:${c.y}%">` +
          `<span class="adv-station-art">${art}</span></div>`
        );
      })
      .join("");
  }

  const stage = document.createElement("div");
  stage.className = "adventure-stage";
  stage.style.setProperty("--adv-himmel", (theme.stamning && theme.stamning.himmel) || "#bfe3ff");
  stage.style.setProperty("--adv-mark", (theme.stamning && theme.stamning.mark) || "#8FCB74");
  stage.innerHTML =
    `<div class="adv-tiles" aria-hidden="true">${renderTiles()}</div>` +
    `<div class="adv-stations" id="adv-stations">${renderStations()}</div>` +
    `<div class="adv-goal" id="adv-goal" hidden></div>` +
    `<div class="adv-hud">` +
    `<span class="adv-progress"><span class="adv-progress-icon">${progressIcon}</span> ` +
    `<b id="adv-count">0</b> / ${goal}</span></div>` +
    `<div class="adv-prompt" id="adv-prompt" hidden></div>` +
    `<div class="adventure-player" id="adv-player">${playerAvatarHtml(avatarHtml, theme)}</div>`;

  const playerEl = stage.querySelector("#adv-player");
  const promptEl = stage.querySelector("#adv-prompt");
  const countEl = stage.querySelector("#adv-count");
  const goalEl = stage.querySelector("#adv-goal");
  const stationsWrap = stage.querySelector("#adv-stations");

  return {
    stage,
    begin() {
      // Avatarens storlek: skala mot rutstorleken så figuren fyller ~en ruta.
      playerEl.style.fontSize = (theme.avatarScale || Math.max(tile.w, tile.h) * 0.9) + "cqw";
    },
    placePlayer(pos, facingLeft) {
      playerEl.style.left = pos.x + "%";
      playerEl.style.top = pos.y + "%";
      playerEl.classList.toggle("vand-vanster", !!facingLeft);
    },
    // Touch-styrning (#250): avataren RÖR sig i grid-läget → sikta mot dess faktiska
    // skärmpunkt (bounding rect-centrum), så "gå mot fingret" pekar rätt.
    getAimOrigin() {
      const r = playerEl.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    setWalking(v) {
      playerEl.classList.toggle("gar", !!v);
    },
    setCount(n) {
      countEl.textContent = String(n);
    },
    setPrompt(text) {
      if (text == null) {
        promptEl.hidden = true;
      } else {
        promptEl.textContent = text;
        promptEl.hidden = false;
      }
    },
    playHack() {
      playHack(playerEl);
    },
    markStationCleared(index) {
      const node = stationsWrap.querySelector(`.adv-station[data-station="${index}"]`);
      if (node) node.classList.add("cleared");
    },
    spawnGoal(pt) {
      goalEl.style.left = pt.x + "%";
      goalEl.style.top = pt.y + "%";
      goalEl.innerHTML = `<span class="adv-goal-art">${theme.goalArt ? theme.goalArt() : "🏆"}</span>`;
      goalEl.hidden = false;
    },
    frame() {
      /* grid-läget har ingen kamera – världen är hela scenen */
    },
  };
}
