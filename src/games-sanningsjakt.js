// ============================================================================
// Pluggportalen – games-sanningsjakt.js
// Arkad-läget "Fånga sanningar": avataren står längst ner med en hink och rör
// sig i sidled (piltangenter/A-D + touch/drag). Påståenden faller uppifrån i
// slumpade x-lägen i ett tempo som ökar gradvis. Fånga SANT = poäng + glädje,
// fånga FALSKT = −1 liv (3 liv, hjärtan). Missat påstående som når golvet ger
// ingen straff. Game over vid 0 liv → resultat + grind-skalad belöning.
//
// Innehållet härleds ur områdets fakta-par ({term,definition}): rätt parning =
// sant "<term> betyder <definition>", felparad = falskt. Saknas par (minst 2)
// faller vi tillbaka på quiz: rätt alternativ = sant, distraktor = falskt.
// Själva innehållshärledningen bor i sanningsjakt-content.js (browser-fri).
// ============================================================================

import { app, el } from "./ui.js";
import * as data from "./data.js";
import { sound } from "./fx.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { gameFrame, muteButton, showResult } from "./game-shared.js";
import { buildStatements, statementFeeder } from "./sanningsjakt-content.js";

const START_LIVES = 3;
// Coin-ekonomi (lätt att tune:a). Första varvet genom påstående-poolen (färska,
// osedda påståenden) ger COINS_FRESH_TRUTH per sann fångst; så fort poolen
// varvat ett varv och innehållet börjar upprepas sjunker det till
// COINS_REPEAT_TRUTH för resten av sessionen. 3-liv-modellen låter en skicklig
// spelare hålla på länge, men upprepat innehåll ger mindre → inget farmande.
const COINS_FRESH_TRUTH = 2;
const COINS_REPEAT_TRUTH = 1;

/** HTML-escape för lärar-inmatad text i en fallande bricka. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Spelet -----------------------------------------------------------------

export async function startSanningsjakt(ctx) {
  const { subj, area } = ctx;

  const view = gameFrame({ subj, area, title: "Fånga sanningar", emoji: "🪣" });
  view.querySelector(".game-head-right").appendChild(muteButton());
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // Hämta elevens avatar (med burna plagg) för figuren.
  let avatarId = DEFAULT_AVATAR;
  let avatarItems = [];
  try {
    const sd = await data.getStudentData();
    avatarId = sd.avatarId || DEFAULT_AVATAR;
    avatarItems = sd.avatarItems || [];
  } catch {}

  const intro = el(`<div class="panel center sj-intro">
    <div class="big-emoji">🪣</div>
    <h2>Fånga sanningar!</h2>
    <p>Påståenden regnar ner. Fånga de som är <b>sanna</b> med hinken – men undvik de <b>falska</b>!</p>
    <p class="hint">Styr med <b>piltangenter</b> eller <b>A/D</b> – eller dra med fingret. Du har <b>${START_LIVES} liv</b> ❤️❤️❤️, ett falskt påstående i hinken kostar ett liv. Tempot ökar efter hand!</p>
    <button class="btn stor gron" id="go">Starta! 🚀</button>
  </div>`);
  intro.querySelector("#go").addEventListener("click", () => {
    sound.click();
    runGame(ctx, body, { avatarId, avatarItems });
  });
  body.replaceChildren(intro);
}

function runGame(ctx, body, { avatarId, avatarItems }) {
  const { subj, area, areaData } = ctx;
  const deck = buildStatements(areaData);
  const feed = statementFeeder(deck);

  // Texter som visats hittills: när en text setts förut är den inte "färsk"
  // längre (poolen har varvat), och en fångst av den ger färre coins.
  const seenTexts = new Set();

  let lives = START_LIVES;
  let score = 0;
  let caughtTrue = 0;
  let coinsEarned = 0; // summeras under spelet enligt fresh/repeat-regeln
  let streak = 0;
  let ended = false;

  const arena = el(`<div class="sj-arena" id="arena">
    <div class="sj-hud">
      <div class="sj-hearts" id="hearts"></div>
      <div class="sj-score">Poäng <b id="score">0</b></div>
    </div>
    <div class="sj-field" id="field"></div>
    <div class="sj-player" id="player">
      <div class="sj-figure" id="figure">${avatarMarkup(avatarId, avatarItems)}</div>
      <div class="sj-bucket" aria-hidden="true"></div>
    </div>
  </div>`);
  body.replaceChildren(arena);

  const field = arena.querySelector("#field");
  const player = arena.querySelector("#player");
  const figure = arena.querySelector("#figure");
  const bucketEl = arena.querySelector(".sj-bucket");
  const scoreEl = arena.querySelector("#score");
  const heartsEl = arena.querySelector("#hearts");

  // Arena-mått + hink-geometri (mäts av DOM så kollisionen alltid matchar den
  // BURNA hinkens öppning – uppdateras vid resize).
  let aw = arena.clientWidth;
  let ah = arena.clientHeight;
  const PLAYER_W = player.offsetWidth || 92;
  let mouthHalf = 40; // halva hinkens fångstöppning (mäts nedan)
  let catchLineY = ah - 70; // y (arena-koord) för hinkens överkant (mäts nedan)

  function measureBucket() {
    const ar = arena.getBoundingClientRect();
    const br = bucketEl.getBoundingClientRect();
    catchLineY = br.top - ar.top; // hinkens öppning, i höjd med magen
    mouthHalf = (br.width / 2) * 0.92;
  }

  let bucketX = aw / 2; // mittpunkt (px)
  let facingLeft = false;
  let keyDir = 0; // -1 vänster, +1 höger (tangenter)
  let pointerTarget = null; // px (touch/mus-drag), null = ingen aktiv styrning

  const tiles = []; // { eln, x, y, w, h, truth, caught }
  let elapsed = 0; // sekunder sedan start
  let spawnAcc = 0;
  let lastTs = 0;
  let raf = 0;

  function renderHearts() {
    let s = "";
    for (let i = 0; i < START_LIVES; i++) s += i < lives ? "❤️" : "🤍";
    heartsEl.textContent = s;
  }

  function placePlayer() {
    const half = PLAYER_W / 2;
    bucketX = Math.max(half, Math.min(aw - half, bucketX));
    player.style.left = bucketX - half + "px";
    player.classList.toggle("face-left", facingLeft);
  }

  function spawnTile() {
    const st = feed();
    if (!st) return;
    const eln = document.createElement("div");
    eln.className = "sj-tile " + (st.truth ? "truth" : "false");
    eln.innerHTML =
      (st.sub ? `<span class="sj-tile-sub">${esc(st.sub)}</span>` : "") +
      `<span class="sj-tile-main">${esc(st.text)}</span>`;
    field.appendChild(eln);
    const w = Math.min(eln.offsetWidth, aw - 16);
    const h = eln.offsetHeight;
    const x = Math.random() * Math.max(1, aw - w - 16) + 8;
    // Färskt = första gången just den texten visas (första varvet i poolen).
    const fresh = !seenTexts.has(st.text);
    seenTexts.add(st.text);
    const tile = { eln, x, y: -h, w, h, truth: st.truth, fresh, caught: false };
    eln.style.transform = `translate(${x}px, ${tile.y}px)`;
    tiles.push(tile);
  }

  function joy(x, y, txt, cls) {
    const f = document.createElement("span");
    f.className = "sj-float " + cls;
    f.textContent = txt;
    f.style.left = x + "px";
    f.style.top = y + "px";
    field.appendChild(f);
    setTimeout(() => f.remove(), 750);
  }

  // Lugnt i starten, ökar sedan gradvis. Fallhastigheten börjar lågt (70 px/s)
  // och klättrar långsamt; spawns är glesa först (var ~2,6 s) och tätnar sakta.
  function fallSpeed() {
    return Math.min(300, 70 + elapsed * 3.2); // px/s
  }
  function spawnInterval() {
    return Math.max(0.9, 2.6 - elapsed * 0.02); // s mellan brickor
  }

  function catchTile(tile) {
    tile.caught = true;
    tile.eln.classList.add("caught");
    const cx = tile.x + tile.w / 2;
    const cy = catchLineY;
    if (tile.truth) {
      streak++;
      const gained = 10 + Math.min(20, (streak - 1) * 2);
      score += gained;
      caughtTrue++;
      coinsEarned += tile.fresh ? COINS_FRESH_TRUTH : COINS_REPEAT_TRUTH;
      sound.correct();
      joy(cx, cy, `+${gained}`, "good");
      figure.classList.remove("cheer");
      void figure.offsetWidth;
      figure.classList.add("cheer");
    } else {
      streak = 0;
      lives--;
      sound.wrong();
      joy(cx, cy, "−1 ❤️", "bad");
      arena.classList.remove("shake");
      void arena.offsetWidth;
      arena.classList.add("shake");
      renderHearts();
      if (lives <= 0) return endGame();
    }
    scoreEl.textContent = score;
    setTimeout(() => tile.eln.remove(), 120);
  }

  function step(ts) {
    if (ended) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000); // klampa vid lagg
    lastTs = ts;
    elapsed += dt;

    // Styrning: tangent-håll rör hinken, drag styr mot mål.
    const moveSpeed = 520; // px/s
    let moving = false;
    if (keyDir !== 0) {
      bucketX += keyDir * moveSpeed * dt;
      facingLeft = keyDir < 0;
      moving = true;
    } else if (pointerTarget != null) {
      const d = pointerTarget - bucketX;
      if (Math.abs(d) > 2) {
        const stepPx = Math.sign(d) * Math.min(Math.abs(d), moveSpeed * dt);
        bucketX += stepPx;
        facingLeft = stepPx < 0;
        moving = true;
      }
    }
    figure.classList.toggle("walking", moving);
    placePlayer();

    // Spawna.
    spawnAcc += dt;
    if (spawnAcc >= spawnInterval()) {
      spawnAcc = 0;
      spawnTile();
    }

    // Flytta + kolla kollision/golv.
    const vy = fallSpeed();
    const mouthMin = bucketX - mouthHalf;
    const mouthMax = bucketX + mouthHalf;
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i];
      if (t.caught) continue;
      t.y += vy * dt;
      t.eln.style.transform = `translate(${t.x}px, ${t.y}px)`;
      const cx = t.x + t.w / 2;
      const bottom = t.y + t.h;
      if (bottom >= catchLineY && bottom <= catchLineY + t.h + 12 &&
          cx >= mouthMin && cx <= mouthMax) {
        catchTile(t);
        tiles.splice(i, 1);
        if (ended) return;
      } else if (t.y > ah) {
        // Missat: sant utan straff, falskt är ok. Bara städa.
        if (t.truth) streak = 0;
        t.eln.remove();
        tiles.splice(i, 1);
      }
    }

    raf = requestAnimationFrame(step);
  }

  // --- Input ----------------------------------------------------------------
  function onKeyDown(e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      keyDir = -1; e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      keyDir = 1; e.preventDefault();
    }
  }
  function onKeyUp(e) {
    if (((e.key === "ArrowLeft" || e.key === "a" || e.key === "A") && keyDir === -1) ||
        ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && keyDir === 1)) {
      keyDir = 0;
    }
  }
  function pointerX(e) {
    const r = arena.getBoundingClientRect();
    return Math.max(0, Math.min(aw, e.clientX - r.left));
  }
  function onPointerDown(e) {
    pointerTarget = pointerX(e);
    keyDir = 0;
    arena.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (pointerTarget == null) return;
    pointerTarget = pointerX(e);
  }
  function onPointerUp() {
    pointerTarget = null;
  }
  function onResize() {
    aw = arena.clientWidth;
    ah = arena.clientHeight;
    placePlayer();
    measureBucket();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  arena.addEventListener("pointerdown", onPointerDown);
  arena.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("resize", onResize);
  // Städa lyssnare + rAF om eleven navigerar bort mitt i spelet (jfr #51).
  window.addEventListener("hashchange", teardown, { once: true });

  function teardown() {
    ended = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    arena.removeEventListener("pointerdown", onPointerDown);
    arena.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("hashchange", teardown);
  }

  function endGame() {
    if (ended) return;
    teardown();
    // Coins summeras under spelet (2 färskt / 1 upprepat per sann fångst) och
    // skickas som baspott genom awardExercise → grind-trappan gäller vid omspel.
    const baseCoins = Math.max(1, coinsEarned);
    const stars = caughtTrue >= 24 ? 3 : caughtTrue >= 10 ? 2 : 1;
    showResult({
      container: body,
      subj, area, mode: "sanningsjakt",
      stars,
      scoreLine: `${score} poäng · ${caughtTrue} sanningar fångade`,
      baseCoins,
      bestScore: score,
      replay: () => startSanningsjakt(ctx),
    });
  }

  renderHearts();
  placePlayer();
  measureBucket();
  raf = requestAnimationFrame(step);
}
