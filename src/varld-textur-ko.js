// ============================================================================
// Pluggporten – idle-kön för textur-pipelinen (#396, F3 #417)
// ----------------------------------------------------------------------------
// koa(fn, prio): små uppgifter (≈ ett tegel-band, ≤ ~8 ms) körs i tidsrutor
// ≤ RUTA_MS så att main-tråden aldrig får en lång uppgift av pipelinen.
//   "idle" → requestIdleCallback (+ timeout, så de inte svälts ut)
//   "nu"   → MessageChannel (nästa task; går före alla "idle")
// Utan requestIdleCallback (Safari, node) körs även "idle" via MessageChannel.
// Re-exporteras från varld-textur.js. Laddas aldrig statiskt.
// ============================================================================

/** Längsta sammanhängande tidsruta i kön (ms) – under 16 ms = ingen jank. */
const RUTA_MS = 10;
/** Idle-uppgifter körs senast efter så här lång väntan (requestIdleCallback-timeout). */
const IDLE_TIMEOUT_MS = 200;

const ko = { nu: [], idle: [] };
let schemalagd = false;
const stats = { jobb: 0, rutor: 0, langstaJobbMs: 0, langstaRutaMs: 0 };

/** Kö-statistik (langstaJobbMs = längsta enskilda uppgift, langstaRutaMs = längsta tidsruta). */
export function koStats() {
  return { ...stats, vantar: ko.nu.length + ko.idle.length };
}
export const nollstallKoStats = () => Object.assign(stats, { jobb: 0, rutor: 0, langstaJobbMs: 0, langstaRutaMs: 0 });

/**
 * Köa en liten uppgift (≤ ~8 ms, t.ex. ETT tegel). "nu" går före alla "idle".
 * Resolvar med uppgiftens värde (eller rejectar med dess fel).
 * @template T
 * @param {() => T|Promise<T>} fn
 * @param {"idle"|"nu"} [prio="idle"]
 * @param {boolean} [forst=false] först i sin kö (fortsättning på ett påbörjat tegel)
 * @returns {Promise<T>}
 */
export function koa(fn, prio = "idle", forst = false) {
  return new Promise((res, rej) => {
    const q = prio === "nu" ? ko.nu : ko.idle;
    q[forst ? "unshift" : "push"]({ fn, res, rej });
    schemalagg();
  });
}

let kanal = null;
let planerad = null; // "nu" | "idle" | null
let korPagar = false;
/** Uppskattad längd på nästa uppgift (avtar, så en enstaka lång uppgift inte låser rutorna). */
let uppskattning = 2;

function schemalagg() {
  if (korPagar || (!ko.nu.length && !ko.idle.length)) return;
  const vill = ko.nu.length || typeof requestIdleCallback !== "function" ? "nu" : "idle";
  // En "nu"-uppgift får aldrig vänta på ett redan planerat idle-anrop.
  if (planerad === "nu" || planerad === vill) return;
  planerad = vill;
  if (vill === "idle") {
    requestIdleCallback(kor, { timeout: IDLE_TIMEOUT_MS });
    return;
  }
  // MessageChannel = nästa task utan setTimeouts 4 ms-golv; låter input/rAF gå emellan.
  if (!kanal) {
    kanal = new MessageChannel();
    kanal.port1.onmessage = () => kor(null);
    kanal.port1.unref?.(); // node (test): håll inte processen vid liv
  }
  kanal.port2.postMessage(0);
}

/**
 * En tidsruta: kör uppgifter så länge de ryms. Uppgifterna bör vara synkrona
 * (en await som väntar på en senare task håller rutan öppen).
 */
async function kor(deadline) {
  if (korPagar) return; // inaktuellt anrop (t.ex. idle efter en "nu"-uppgradering)
  planerad = null;
  korPagar = true;
  const t0 = performance.now();
  let n = 0;
  try {
    while (ko.nu.length || ko.idle.length) {
      const nu = ko.nu.length > 0;
      if (n > 0) {
        if (RUTA_MS - (performance.now() - t0) < uppskattning) break;
        // Idle: respektera webbläsarens deadline (input/rAF väntar annars).
        if (!nu && deadline && !deadline.didTimeout && deadline.timeRemaining() < uppskattning) break;
      }
      const u = (nu ? ko.nu : ko.idle).shift();
      const j0 = performance.now();
      try {
        u.res(await u.fn());
      } catch (err) {
        u.rej(err);
      }
      const ms = performance.now() - j0;
      uppskattning = Math.max(1, ms, uppskattning * 0.8);
      stats.jobb++;
      if (ms > stats.langstaJobbMs) stats.langstaJobbMs = ms;
      n++;
    }
  } finally {
    const ms = performance.now() - t0;
    stats.rutor++;
    if (ms > stats.langstaRutaMs) stats.langstaRutaMs = ms;
    korPagar = false;
    schemalagg();
  }
}
