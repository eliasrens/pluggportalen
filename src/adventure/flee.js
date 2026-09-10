// ============================================================================
// Pluggportalen – äventyrsmotorn: flee.js  (issue #276)
// ----------------------------------------------------------------------------
// REN, DOM-fri och Firebase-fri flykt-logik för "flyende spöken" (Spökjakten).
// En liten state-maskin PER frågeobjekt (spöke) + kollisions-medveten flykt-
// styrning + robust off-screen-respawn. Ingen import av ui.js/firebase → laddas i
// `node --test` (test/adventure-flee.test.js), i samma anda som movement.js/world.js.
//
// Detta är ett OPT-IN-beteende: motorn (engine.js) kör det bara när temat sätter
// `fleeing: true` (Spökjakten). Skattjakten (stationer) och Gruvan (kristaller)
// rör flaggan aldrig → exakt oförändrat beteende där.
//
// Modell (allt i VÄRLDSPIXLAR, samma rymd som world.js/space.stations):
//   • Varje spöke har ett tillstånd `calm` | `fleeing` + fälten fleeTimer, fleeCount.
//   • calm → fleeing när spelaren kommer inom detectRadius; en ~3 s-timer startar.
//   • fleeing: spöket glider BORT från spelaren (flee-vektor) med kollisions-medveten
//     glidning – om nästa steg är blockerat provas tangentiella riktningar så det
//     inte fastnar i hörn; håller sig inom banan (blockedAt = utanför = blockerat).
//   • timern räknas ner med dt; når 0 utan fångst → escape: spöket respawnar på en
//     NY gångbar plats UTANFÖR viewporten och ej för nära spelaren, återställt lugnt,
//     och fleeCount räknas upp (fler flykter → aningen långsammare = lättare).
// Fångst = motorns vanliga interaktion (inom interactRadius) – ligger i engine.js,
// inte här. Slutmåls-spöket omfattas ALDRIG av flee (motorn styr det via goalActive).
// ============================================================================

/** Euklidiskt avstånd mellan (x,y) och punkt p. */
function distTo(x, y, p) {
  return Math.hypot(x - p.x, y - p.y);
}

/** Rotera vektorn (vx,vy) `deg` grader (medurs i skärm-koordinater, y nedåt). */
function rotate(vx, vy, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

// Kandidat-avvikelser (grader) från den rena flyktriktningen. 0 = rakt bort; växande
// vinklar låter spöket glida längs väggar och runda hörn i stället för att nita fast.
const FLEE_ANGLES = [0, 20, -20, 42, -42, 66, -66, 90, -90, 120, -120];

/**
 * Ett kollisions-medvetet flyktsteg. Provar flyktriktningen och, om den är
 * blockerad, tangentiella avvikelser (glid längs vägg / runda hörn). Returnerar
 * ny position + om den rörde sig. Kliver aldrig in i en blockerad punkt.
 * @param {{x:number,y:number}} pos     spökets nuvarande position
 * @param {{x:number,y:number}} away    ENHETSvektor bort från spelaren
 * @param {number} step                 hur långt (px) spöket får flytta detta steg
 * @param {(x:number,y:number)=>boolean} blockedAt  true = blockerat (vägg/utanför)
 * @returns {{x:number,y:number,moved:boolean}}
 */
export function fleeStep(pos, away, step, blockedAt) {
  if (!(step > 0)) return { x: pos.x, y: pos.y, moved: false };
  for (let i = 0; i < FLEE_ANGLES.length; i++) {
    const d = rotate(away.x, away.y, FLEE_ANGLES[i]);
    const nx = pos.x + d.x * step;
    const ny = pos.y + d.y * step;
    if (!blockedAt(nx, ny)) return { x: nx, y: ny, moved: true };
  }
  // Sista utväg: axel-separerad glidning (som movement.js) – prova X, sedan Y.
  let nx = pos.x + away.x * step;
  if (blockedAt(nx, pos.y)) nx = pos.x;
  let ny = pos.y + away.y * step;
  if (blockedAt(nx, ny)) ny = pos.y;
  return { x: nx, y: ny, moved: nx !== pos.x || ny !== pos.y };
}

/** Enhetsvektor från spelaren mot spöket (riktningen spöket flyr åt). Faller
 *  tillbaka på "höger" om de ligger exakt på varandra (undviker NaN). */
export function fleeDirection(ghost, playerPos) {
  const dx = ghost.x - playerPos.x;
  const dy = ghost.y - playerPos.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Välj en respawn-position för ett flytt spöke: gångbar mark, UTANFÖR viewporten
 * (off-screen) och ej för nära spelaren. Samplar slumpkandidater och släpper
 * gradvis på villkoren (off-screen → gap → bara gångbart) så den alltid hittar
 * NÅGOT även på en trång bana. Respawnar ALDRIG i en vägg (blockedAt respekteras
 * i alla pass). Returnerar {x,y} eller null om inte ens en gångbar punkt hittas.
 *
 * @param {object} o
 * @param {(x:number,y:number)=>boolean} o.blockedAt
 * @param {{w:number,h:number}} o.worldSize
 * @param {{x:number,y:number,w:number,h:number}|null} [o.viewport]  synlig världsruta
 * @param {{x:number,y:number}} o.playerPos
 * @param {()=>number} [o.rng]
 * @param {number} [o.minGapFromPlayer=0]  minsta avstånd till spelaren
 * @param {number} [o.attempts=240]        kandidater per pass
 * @returns {{x:number,y:number}|null}
 */
export function pickRespawn({
  blockedAt,
  worldSize,
  viewport,
  playerPos,
  rng = Math.random,
  minGapFromPlayer = 0,
  attempts = 240,
}) {
  if (!worldSize || !(worldSize.w > 0) || !(worldSize.h > 0)) return null;
  const W = worldSize.w, H = worldSize.h;
  // Marginal utanför viewporten så spöket dyker upp en bit bortom kanten (inte
  // precis i utkanten där det ändå skymtar när kameran rör sig).
  const margin = Math.max(24, minGapFromPlayer * 0.5);
  const inView = (x, y) =>
    !!viewport &&
    x >= viewport.x - margin &&
    x <= viewport.x + viewport.w + margin &&
    y >= viewport.y - margin &&
    y <= viewport.y + viewport.h + margin;

  const passes = [
    (x, y) => !blockedAt(x, y) && !inView(x, y) && distTo(x, y, playerPos) >= minGapFromPlayer,
    (x, y) => !blockedAt(x, y) && !inView(x, y),
    (x, y) => !blockedAt(x, y) && distTo(x, y, playerPos) >= minGapFromPlayer,
    (x, y) => !blockedAt(x, y),
  ];
  for (let p = 0; p < passes.length; p++) {
    const ok = passes[p];
    for (let k = 0; k < attempts; k++) {
      const x = rng() * W;
      const y = rng() * H;
      if (ok(x, y)) return { x, y };
    }
  }
  return null;
}

/**
 * Uppdatera flykt-tillståndet ETT tick. MUTERAR stations[i] (levande positioner)
 * och states[i] (status/fleeTimer/fleeCount) och returnerar vilka spöken som just
 * började fly resp. just respawnade, så motorn kan trigga min-byte och en fade.
 * Redan klarade spöken (cleared) hoppas helt – de är inga mål längre.
 *
 * @param {object} o
 * @param {Array<{x:number,y:number}>} o.stations         levande spök-positioner (muteras)
 * @param {Array<{status:string,fleeTimer:number,fleeCount:number}>} o.states  per spöke (muteras)
 * @param {Set<number>|number[]} [o.cleared]              klarade spök-index (hoppas)
 * @param {{x:number,y:number}} o.playerPos
 * @param {number} o.dt                                    sekunder sedan förra ticket
 * @param {(x:number,y:number)=>boolean} o.blockedAt
 * @param {number} o.detectRadius                          upptäckts-radie (calm→fleeing)
 * @param {number} o.speed                                 flykt-fart (px/s)
 * @param {number} [o.fleeWindow=3]                        fångstfönster (sekunder)
 * @param {{x:number,y:number,w:number,h:number}|null} [o.viewport]
 * @param {{w:number,h:number}} o.worldSize
 * @param {()=>number} [o.rng]
 * @returns {{startedFleeing:number[], respawned:number[]}}
 */
export function updateFlee({
  stations,
  states,
  cleared,
  playerPos,
  dt,
  blockedAt,
  detectRadius,
  speed,
  fleeWindow = 3,
  viewport,
  worldSize,
  rng = Math.random,
}) {
  const isCleared =
    cleared instanceof Set
      ? (i) => cleared.has(i)
      : Array.isArray(cleared)
      ? (i) => cleared.includes(i)
      : () => false;

  const startedFleeing = [];
  const respawned = [];
  if (!Array.isArray(stations) || !Array.isArray(states)) return { startedFleeing, respawned };

  for (let i = 0; i < stations.length; i++) {
    if (isCleared(i)) continue;
    const g = stations[i];
    const st = states[i];
    if (!g || !st) continue;

    if (st.status !== "fleeing") {
      // calm: börja fly först när spelaren kommer nära nog.
      if (distTo(g.x, g.y, playerPos) <= detectRadius) {
        st.status = "fleeing";
        st.fleeTimer = fleeWindow;
        startedFleeing.push(i);
      } else {
        continue;
      }
    }

    // fleeing: glid bort från spelaren (kollisions-medvetet). Fler tidigare flykter
    // → aningen långsammare (golv 60 %) så en envis jakt till slut blir görbar.
    const ease = Math.max(0.6, 1 - 0.08 * (st.fleeCount || 0));
    const away = fleeDirection(g, playerPos);
    const next = fleeStep(g, away, speed * ease * dt, blockedAt);
    g.x = next.x;
    g.y = next.y;

    // Räkna ner fångstfönstret; slut utan fångst → escape + respawn off-screen.
    st.fleeTimer -= dt;
    if (st.fleeTimer <= 0) {
      const spot = pickRespawn({
        blockedAt,
        worldSize,
        viewport,
        playerPos,
        rng,
        minGapFromPlayer: detectRadius * 1.5,
      });
      if (spot) {
        g.x = spot.x;
        g.y = spot.y;
      }
      st.status = "calm";
      st.fleeTimer = 0;
      st.fleeCount = (st.fleeCount || 0) + 1;
      respawned.push(i);
    }
  }

  return { startedFleeing, respawned };
}

/** Skapa initiala flykt-states för n spöken (alla lugna). */
export function createFleeStates(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ status: "calm", fleeTimer: 0, fleeCount: 0 });
  return out;
}
