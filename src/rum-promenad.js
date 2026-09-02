// ============================================================================
// Pluggportalen – promenad-AI för husdjuren i Mitt rum
// ----------------------------------------------------------------------------
// Låter kläckta husdjur promenera lugnt omkring på golvet i rumsscenen
// (pages-rum.js) utan att gå genom eller ställa sig ovanpå utplacerade möbler
// och dekor. Ingen väg-sökning: djuret väljer bara mål dit den raka vägen är
// fri (kolliderar rummet ändå, t.ex. när en möbel dras ovanpå djuret, stannar
// det och väljer ett nytt mål). Tempo enligt designfacit: lugnt, mjukt,
// barnvänligt – accelererar/bromsar mjukt och pausar ofta.
//
// Kollisionsrutor läses från DOM:en (.room-item[data-id]) i procent av scenen,
// så modulen fungerar oavsett hur sakerna är ritade/skalade. Loopen drivs av
// requestAnimationFrame och städar sig själv när scenen lämnar dokumentet.
// ============================================================================

import { FLOOR_TOP } from "./art-room.js";

const SPEED = 6; // %/s – lugnt promenadtempo (designfacit ~7 %/s)
const RAMP = 5; // % sträcka för mjuk gasa/bromsa i början/slutet av en tur
const IDLE_MIN = 1600; // ms paus mellan promenader …
const IDLE_MAX = 5200; // … slumpas i detta spann (ibland längre, se pickIdle)
const OBSTACLE_TTL = 1200; // ms mellan omläsningar av möblernas rutor
const TRIES = 14; // målförsök per promenadstart innan djuret väntar kvar

const rand = (min, max) => min + Math.random() * (max - min);

/** Slumpad vilopaus – då och då en riktigt lång "sitta och myse"-paus. */
function pickIdle(now) {
  return now + (Math.random() < 0.18 ? rand(6000, 9500) : rand(IDLE_MIN, IDLE_MAX));
}

/**
 * Starta promenad-loopen för husdjuren i rumsscenen.
 * @param {object} o
 * @param {HTMLElement} o.stage  rumsscenen (.room-stage)
 * @param {() => object[]} o.getPets  aktuell pets-array (positioner i procent)
 * @param {(pet: object) => boolean} o.isPetPaused  true = rör dig inte (vald/dras)
 * @param {() => void} [o.onSettled]  kallas när ett djur stannar (för ev. sparning)
 * @returns {() => void} stoppfunktion (loopen stoppar även sig själv när
 *   scenen försvinner ur DOM:en, samma mönster som äggens nedräkningstimer)
 */
export function startPetPromenad({ stage, getPets, isPetPaused, onSettled }) {
  // Respektera reduced motion: inga promenader alls (designfacit).
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  const states = new Map(); // petId → { mode, until, target, node, halfW, halfH }
  let obstacles = [];
  let obstaclesAt = 0;
  let raf = 0;
  let last = 0;
  let stopped = false;

  // --- Kollisionsrutor: placerade saker i procent av scenen -----------------
  function refreshObstacles(now) {
    if (now - obstaclesAt < OBSTACLE_TTL) return;
    obstaclesAt = now;
    const sr = stage.getBoundingClientRect();
    if (sr.width === 0 || sr.height === 0) return;
    obstacles = [];
    for (const n of stage.querySelectorAll(".room-item[data-id]")) {
      const r = n.getBoundingClientRect();
      // Krymp rutan lite (10 %) så djuren kan smyga tätt förbi utan att fastna.
      const padX = r.width * 0.1;
      const padY = r.height * 0.1;
      obstacles.push({
        l: ((r.left + padX - sr.left) / sr.width) * 100,
        r: ((r.right - padX - sr.left) / sr.width) * 100,
        t: ((r.top + padY - sr.top) / sr.height) * 100,
        b: ((r.bottom - padY - sr.top) / sr.height) * 100,
      });
    }
  }

  /** Är punkten (djurets mittpunkt) i konflikt med någon möbel/dekor? */
  function hitsObstacle(x, y, st) {
    // Djurets egen utbredning räknas delvis in – helt in gör passagerna för trånga.
    const ex = st.halfW * 0.55;
    const ey = st.halfH * 0.45;
    for (const o of obstacles) {
      if (x + ex > o.l && x - ex < o.r && y + ey > o.t && y - ey < o.b) return true;
    }
    return false;
  }

  /** Är den raka vägen mellan två punkter fri? (samplas i korta steg) */
  function pathClear(x1, y1, x2, y2, st) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(dist / 1.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (hitsObstacle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, st)) return false;
    }
    return true;
  }

  /**
   * För nära ett annat (kläckt) husdjur? Håller flocken från att klumpa ihop
   * sig. Med closingIn=true krävs dessutom att steget NÄRMAR sig kompisen –
   * annars kan två djur som redan står tätt aldrig gå isär (dödläge).
   */
  function nearOtherPet(pet, x, y, factor, closingIn) {
    for (const other of getPets()) {
      if (other.id === pet.id || !other.hatchedAt || !other.pos) continue;
      const os = states.get(other.id);
      const sep = (statesHalfW(pet) + (os ? os.halfW : 3)) * factor;
      const next = Math.hypot(x - other.pos.x, y - other.pos.y);
      if (next >= sep) continue;
      if (!closingIn) return true;
      const cur = Math.hypot(pet.pos.x - other.pos.x, pet.pos.y - other.pos.y);
      if (next < cur) return true;
    }
    return false;
  }
  const statesHalfW = (pet) => (states.get(pet.id) || { halfW: 3 }).halfW;

  // --- Nod & mått (noderna byts ut när scenen ritas om) ---------------------
  function nodeFor(pet, st) {
    if (!st.node || !st.node.isConnected) {
      st.node = stage.querySelector(`.room-item[data-pet-id="${pet.id}"]`);
      if (st.node) {
        const sr = stage.getBoundingClientRect();
        st.halfW = sr.width ? ((st.node.offsetWidth / sr.width) * 100) / 2 : 3;
        st.halfH = sr.height ? ((st.node.offsetHeight / sr.height) * 100) / 2 : 5;
      }
    }
    return st.node;
  }

  /** Golvzonen djuret får röra sig i (samma clamp som drag & drop). */
  function walkZone(st) {
    return {
      minX: Math.max(3, st.halfW),
      maxX: Math.min(97, 100 - st.halfW),
      minY: Math.max(st.halfH, FLOOR_TOP + 4 - st.halfH),
      maxY: 100 - st.halfH,
    };
  }

  // --- Välj nytt promenadmål ------------------------------------------------
  function pickTarget(pet, st, now) {
    const z = walkZone(st);
    const stuck = hitsObstacle(pet.pos.x, pet.pos.y, st); // t.ex. möbel draget hit
    for (let i = 0; i < TRIES; i++) {
      // Varannan gång en kort sväng nära nuvarande plats, annars fritt på golvet.
      const short = i % 2 === 0;
      const x = short
        ? Math.min(z.maxX, Math.max(z.minX, pet.pos.x + rand(-18, 18)))
        : rand(z.minX, z.maxX);
      const y = short
        ? Math.min(z.maxY, Math.max(z.minY, pet.pos.y + rand(-7, 7)))
        : rand(z.minY, z.maxY);
      if (Math.hypot(x - pet.pos.x, y - pet.pos.y) < 4) continue; // för nära = tråkigt
      if (hitsObstacle(x, y, st)) continue;
      if (nearOtherPet(pet, x, y, 1.1)) continue;
      // Fast i en möbel? Då får djuret gå rakt ut även om vägen skär rutan.
      if (!stuck && !pathClear(pet.pos.x, pet.pos.y, x, y, st)) continue;
      st.target = { x, y };
      st.startDist = Math.hypot(x - pet.pos.x, y - pet.pos.y);
      st.mode = "walk";
      return;
    }
    st.until = now + rand(700, 1600); // ingen fri väg just nu – vila och testa igen
  }

  // --- Ett promenadsteg -----------------------------------------------------
  function walkStep(pet, st, node, dt, now) {
    const dx = st.target.x - pet.pos.x;
    const dy = st.target.y - pet.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.6) return settle(pet, st, node, now);

    // Mjuk fart: gasa i början, bromsa mot målet (aldrig ryckigt stopp).
    const traveled = Math.max(0.001, st.startDist - dist);
    const ease = Math.max(0.28, Math.min(1, traveled / RAMP, dist / RAMP));
    const step = Math.min(dist, SPEED * ease * dt);
    const nx = pet.pos.x + (dx / dist) * step;
    const ny = pet.pos.y + (dy / dist) * step;

    // Möbel i vägen (flyttad under promenaden) eller kompis för nära → stanna.
    if (hitsObstacle(nx, ny, st)) return settle(pet, st, node, now);
    if (nearOtherPet(pet, nx, ny, 0.8, true)) return settle(pet, st, node, now);

    pet.pos.x = nx;
    pet.pos.y = ny;
    node.style.left = nx + "%";
    node.style.top = ny + "%";
    node.classList.add("promenerar");
    node.classList.toggle("vand-vanster", dx < 0);
  }

  /** Avsluta promenaden och ställ dig och vila en stund. */
  function settle(pet, st, node, now) {
    st.mode = "idle";
    st.until = pickIdle(now);
    node.classList.remove("promenerar");
    if (onSettled) onSettled();
  }

  // --- Huvudloopen ----------------------------------------------------------
  function tick(now) {
    if (stopped) return;
    if (!stage.isConnected) return stop(); // sidan lämnad – städa upp
    const dt = Math.min((now - last) / 1000, 0.1); // flik i bakgrunden → inga skutt
    last = now;
    refreshObstacles(now);

    for (const pet of getPets()) {
      if (!pet.hatchedAt || !pet.pos) continue; // ägg ligger stilla och ruvar
      let st = states.get(pet.id);
      if (!st) {
        st = { mode: "idle", until: pickIdle(now), target: null, node: null, halfW: 3, halfH: 5 };
        states.set(pet.id, st);
      }
      const node = nodeFor(pet, st);
      if (!node) continue;

      // Interaktion (djuret är valt/matas eller dras) → stå still och vänta.
      if (isPetPaused(pet)) {
        if (st.mode === "walk") settle(pet, st, node, now);
        st.until = Math.max(st.until, now + 1200);
        continue;
      }

      if (st.mode === "idle") {
        if (now >= st.until) pickTarget(pet, st, now);
      } else {
        walkStep(pet, st, node, dt, now);
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    states.clear();
  }

  raf = requestAnimationFrame((now) => {
    last = now;
    tick(now);
  });
  return stop;
}
