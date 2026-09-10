// ============================================================================
// Pluggportalen – äventyrsmotorn: grid-scene.js
// ----------------------------------------------------------------------------
// DOM-scenen för DEFAULT grid-läget (liten ASCII-ruta i PROCENT-koordinater).
// Bygger EXAKT samma DOM/CSS som förr och exponerar samma lilla scene-gränssnitt
// som scroll-scenen (scene-scroll.js) så motor-loopen (engine.js) är gemensam.
// Utbruten ur engine.js (#261) för att hålla motorn under fil-cap och samla all
// grid-rendering på ett ställe. Ingen beteende-ändring mot tidigare inline-version.
// ============================================================================

import { cellCenter } from "./grid.js";
import { playerAvatarHtml, playHack } from "./hand-tool.js";
import { createCompass } from "./compass.js";

export function createGridScene({ space, theme, avatarHtml, progressIcon, goal }) {
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

  // Kompass-HUD (#261): fast overlay i hörnet, i SCENEN (inte i världen) så den inte
  // scrollar. Läggs sist ⇒ ovanpå. pointer-events:none via CSS ⇒ äter aldrig tap.
  const compass = createCompass();
  stage.append(compass.el);

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
    setCompass(angleRad) {
      compass.set(angleRad);
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
