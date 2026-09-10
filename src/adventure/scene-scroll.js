// ============================================================================
// Pluggportalen – äventyrsmotorn: scene-scroll.js  (issue #220)
// ----------------------------------------------------------------------------
// DOM-scenen för OPT-IN scroll/bild-karta-läget. Bygger de separerade lagren och
// kör kameran (camera.js) medan motorn (engine.js) äger spel-logiken. Motorn
// pratar med scenen genom EXAKT samma litet gränssnitt som grid-scenen
// (placePlayer/setCount/setPrompt/markStationCleared/spawnGoal/frame/…), så
// interaktion/frågor/progress/belöning är oförändrade – bara koordinatsystemet
// och renderingen skiljer.
//
// Lager (bakifrån och fram, precis som issue:n kräver):
//   map (bild)  <  collision (osynlig)  <  objekt (stationer/mål)  <  spelare  <  UI
// map/objekt/spelare ligger i .adv-world som KAMERAN translaterar+skalar (världen
// scrollar under en nära centrerad avatar); .adv-hud/.adv-prompt (UI) ligger fast
// utanför världen och rör sig aldrig.
// ============================================================================

import { createCamera } from "./camera.js";
import { playerAvatarHtml, playHack } from "./hand-tool.js";
import { createCompass } from "./compass.js";

export function createScrollScene({ world, theme, avatarHtml, progressIcon, goal }) {
  // OBS: camera vill ha världens mått {w,h} (world.size), inte hela space-objektet.
  const camera = createCamera({ world: world.size, viewFraction: world.viewFraction });

  // --- Bygg scen-DOM --------------------------------------------------------
  const stage = document.createElement("div");
  stage.className = "adventure-stage adv-scroll";
  stage.style.setProperty("--adv-himmel", (theme.stamning && theme.stamning.himmel) || "#bfe3ff");
  stage.style.setProperty("--adv-mark", (theme.stamning && theme.stamning.mark) || "#8FCB74");

  const worldEl = document.createElement("div");
  worldEl.className = "adv-world";
  worldEl.style.width = world.size.w + "px";
  worldEl.style.height = world.size.h + "px";

  const mapEl = document.createElement("div");
  mapEl.className = "adv-map";
  mapEl.setAttribute("aria-hidden", "true");
  // Opt-in: egenritad inline-SVG-värld (issue #238) har företräde – rendera den
  // rakt in i kartlagret. Annars backwards-compat med bild-karta (mapImage).
  if (world.mapSvg) mapEl.innerHTML = world.mapSvg;
  else if (world.mapImage) mapEl.style.backgroundImage = `url("${world.mapImage}")`;

  const objectsEl = document.createElement("div");
  objectsEl.className = "adv-objects";
  // Lugn-min-konsten per station beräknas EN gång (vissa teman varierar per anrop,
  // t.ex. Gruvans kristaller) → stabil bild att återställa till efter en flykt (#276).
  const calmArt = world.stations.map(() => (theme.stationArt ? theme.stationArt() : progressIcon));
  objectsEl.innerHTML = renderStations();

  const goalEl = document.createElement("div");
  goalEl.className = "adv-goal";
  goalEl.hidden = true;

  const playerEl = document.createElement("div");
  playerEl.className = "adventure-player";
  playerEl.innerHTML = playerAvatarHtml(avatarHtml, theme);

  worldEl.append(mapEl, objectsEl, goalEl, playerEl);

  const hud = document.createElement("div");
  hud.className = "adv-hud";
  hud.innerHTML =
    `<span class="adv-progress"><span class="adv-progress-icon">${progressIcon}</span> ` +
    `<b class="adv-count">0</b> / ${goal}</span>`;
  const countEl = hud.querySelector(".adv-count");

  const promptEl = document.createElement("div");
  promptEl.className = "adv-prompt";
  promptEl.hidden = true;

  // Kompass-HUD (#261): fast overlay UTANFÖR .adv-world (i stage) så den inte
  // scrollar/skalas med kameran. pointer-events:none via CSS ⇒ äter aldrig tap.
  const compass = createCompass();

  stage.append(worldEl, hud, promptEl, compass.el);

  function renderStations() {
    // Använd den EN gång beräknade lugn-min-konsten (calmArt) → stabil variation,
    // samma mönster som grid-scenen, och samma bild att återställa till efter flykt.
    return world.stations
      .map((p, i) => {
        return (
          `<div class="adv-station" data-station="${i}" data-mood="calm" style="left:${p.x}px;top:${p.y}px">` +
          `<span class="adv-station-art">${calmArt[i]}</span></div>`
        );
      })
      .join("");
  }

  /** DOM-noden för station #index (eller null om utanför/redan borttagen). */
  function stationNode(index) {
    return objectsEl.querySelector(`.adv-station[data-station="${index}"]`);
  }

  // --- Kamera-storlek: mät scenen och håll den aktuell vid resize ------------
  let ro = null;
  function syncScreen() {
    camera.setScreen({ w: stage.clientWidth || 1, h: stage.clientHeight || 1 });
  }

  // --- Scene-gränssnittet motorn använder -----------------------------------
  return {
    stage,
    begin() {
      // Storlek på objekt/avatar i VÄRLDSPIXLAR → skalar korrekt med zoomen.
      // objectScale är tune:bar per tema (#276 gör Spökjaktens spöken mindre);
      // default 1.1 = oförändrat för övriga teman.
      playerEl.style.fontSize = world.avatarSize + "px";
      objectsEl.style.fontSize = world.avatarSize * (world.objectScale || 1.1) + "px";
      goalEl.style.fontSize = world.avatarSize * 1.3 + "px";
      syncScreen();
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(syncScreen);
        ro.observe(stage);
      }
    },
    placePlayer(pos, facingLeft) {
      playerEl.style.left = pos.x + "px";
      playerEl.style.top = pos.y + "px";
      playerEl.classList.toggle("vand-vanster", !!facingLeft);
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
      const node = stationNode(index);
      if (node) {
        node.classList.remove("scared");
        node.classList.add("cleared");
      }
    },
    // --- Flyende spöken (#276): motorn flyttar/varierar min på levande stationer ---
    // Flytta en stations DOM-nod till en ny världsposition (px). Billig – bara left/top.
    moveStation(index, pos) {
      const node = stationNode(index);
      if (!node) return;
      node.style.left = pos.x + "px";
      node.style.top = pos.y + "px";
    },
    // Växla lugn/rädd min. Byter bara DOM när minen faktiskt ändras (dedupe) så
    // puls-animationen inte startas om varje bildruta. "scared" ⇒ temats
    // stationScaredArt (om finns) + CSS-klass; "calm" ⇒ den lagrade lugn-konsten.
    setStationMood(index, mood) {
      const node = stationNode(index);
      if (!node) return;
      const want = mood === "scared" ? "scared" : "calm";
      if (node.dataset.mood === want) return;
      node.dataset.mood = want;
      node.classList.toggle("scared", want === "scared");
      const art = node.querySelector(".adv-station-art");
      if (art) {
        art.innerHTML =
          want === "scared" && theme.stationScaredArt ? theme.stationScaredArt() : calmArt[index];
      }
    },
    // Escape → respawn: flytta + återställ lugn + en kort fade-in på den nya platsen.
    respawnStation(index, pos) {
      this.moveStation(index, pos);
      this.setStationMood(index, "calm");
      const node = stationNode(index);
      if (!node) return;
      const art = node.querySelector(".adv-station-art");
      if (!art) return;
      art.classList.remove("adv-respawn");
      // reflow → animationen kan spelas om även vid täta respawns.
      void art.offsetWidth;
      art.classList.add("adv-respawn");
    },
    // Synlig världsruta {x,y,w,h} (px) för off-screen-respawn (#276).
    getViewport() {
      return camera.getViewport();
    },
    spawnGoal(pt) {
      goalEl.style.left = pt.x + "px";
      goalEl.style.top = pt.y + "px";
      goalEl.innerHTML = `<span class="adv-goal-art">${theme.goalArt ? theme.goalArt() : "🏆"}</span>`;
      goalEl.hidden = false;
    },
    frame(pos, dt) {
      worldEl.style.transform = camera.update(pos, dt);
    },
    teardown() {
      if (ro) ro.disconnect();
      ro = null;
    },
  };
}
