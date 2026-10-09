// ============================================================================
// Trollkarlsduellen (#536): REGIN – händelsebuss + animationskö med prioritet
// (spec §11, §14.1, §16). Ingen DOM: vyn ger funktionerna som faktiskt spelar.
//
// Prioritet: FINALE 4 > ATTACK 3 > CHARGE 2 > IDLE 1.
//   • Attacker köas FIFO och spelas EN i taget (båda klassernas – inget tappas).
//   • stop() (00:00): inga nya attacker, kön töms, pågående avbryts (AbortSignal).
//   • finale(utfall) körs EXAKT EN gång: stoppar, väntar ut avbrottet, spelar.
//   • Uppladdning/idle är inga köjobb: vyn frågar idle() innan den visar dem.
// Poäng och mätare går aldrig via kön – de uppdateras direkt i vyn.
//
// API
//   PRIORITY, STATES (§11-tillstånden)
//   createDirector({ runAttack(evt, signal), runFinale(outcome, signal),
//                    settle(kind, evt, aborted), guardMs? }) → {
//     attack(evt) → bool    evt = { from, to, index, seed, … }
//     finale(outcome) → bool  outcome = { winnerId, draw }
//     stop(), idle() → bool, current() → "attack"|"finale"|null, pending() → n,
//     priority() → 1–4, stopped(), finaleStarted(),
//     on(type, fn) → off   typer: attack, attack:start, attack:end,
//                          finale, finale:start, finale:end
//     whenIdle() → Promise (nästa gång kön är tom – för test/demo)
//     destroy()
//   }
// ============================================================================

export const PRIORITY = { IDLE: 1, CHARGE: 2, ATTACK: 3, FINALE: 4 };
export const STATES = [
  "IDLE", "IDLE_VARIATION", "CHARGING", "CASTING", "ANTICIPATING_HIT",
  "HIT", "TRANSFORMED", "RECOVERING", "VICTORY", "DEFEAT",
];

// Skyddsnät: en attack/final som aldrig blir klar släpps efter så här länge.
const GUARD_MS = 30_000;

// Burst (#538, §11/§16): vid lång kö komprimeras attackerna i stället för att
// tappas – högre tempo (a.speed, används av dur()/a.wait i attackerna) och
// överhoppad uppladdning. Räkningen ligger i MagicSystem och påverkas aldrig.
export function rushFor(pending) {
  const p = Math.max(0, Math.floor(Number(pending) || 0));
  const speed = p <= 0 ? 1 : p <= 2 ? 1.4 : p <= 4 ? 1.8 : 2.4;
  return { speed, skipCharge: p >= 2 };
}

export function createDirector({ runAttack, runFinale, settle = () => {}, guardMs = GUARD_MS }) {
  const handlers = new Map();
  const queue = [];
  let running = null; // { kind, evt, ac, done }
  let stopped = false;
  let finaleOn = false;
  let dead = false;
  let idleWaiters = [];

  function emit(type, payload) {
    for (const fn of handlers.get(type) || []) {
      try { fn(payload); } catch (e) { console.warn("Trollkarlsduellen:", type, e); }
    }
  }

  function notifyIdle() {
    if (running || queue.length) return;
    const w = idleWaiters;
    idleWaiters = [];
    w.forEach((r) => r());
  }

  async function runJob(kind, evt, fn) {
    const ac = new AbortController();
    let guardT = 0;
    const job = { kind, evt, ac };
    running = job;
    emit(`${kind}:start`, evt);
    job.done = (async () => {
      try {
        await Promise.race([
          Promise.resolve().then(() => fn(evt, ac.signal)),
          new Promise((resolve) => { guardT = setTimeout(() => { ac.abort(); resolve(); }, guardMs); }),
          new Promise((resolve) => ac.signal.addEventListener("abort", resolve, { once: true })),
        ]);
      } catch (e) {
        if (!ac.signal.aborted) console.warn(`Trollkarlsduellen: ${kind} kraschade`, e);
      } finally {
        clearTimeout(guardT);
        try { settle(kind, evt, ac.signal.aborted); } catch (e) { console.warn("Trollkarlsduellen: settle", e); }
        running = null;
        emit(`${kind}:end`, evt);
      }
    })();
    return job.done;
  }

  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length && !stopped && !dead) await runJob("attack", queue.shift(), runAttack);
    } finally {
      pumping = false;
      notifyIdle();
    }
  }

  function stop() {
    stopped = true;
    queue.length = 0;
    if (running?.kind === "attack") running.ac.abort();
    notifyIdle();
  }

  return {
    attack(evt) {
      if (stopped || finaleOn || dead) return false;
      queue.push(evt);
      emit("attack", evt);
      pump();
      return true;
    },
    finale(outcome) {
      if (finaleOn || dead) return false;
      finaleOn = true;
      const prev = running?.done;
      stop();
      emit("finale", outcome);
      Promise.resolve(prev).then(() => {
        if (!dead) return runJob("finale", outcome, runFinale);
      }).finally(notifyIdle);
      return true;
    },
    stop,
    idle: () => !running && !queue.length,
    current: () => running?.kind || null,
    pending: () => queue.length,
    priority: () => (running ? (running.kind === "finale" ? PRIORITY.FINALE : PRIORITY.ATTACK) : queue.length ? PRIORITY.ATTACK : PRIORITY.IDLE),
    stopped: () => stopped,
    finaleStarted: () => finaleOn,
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    whenIdle() {
      if (!running && !queue.length) return Promise.resolve();
      return new Promise((r) => idleWaiters.push(r));
    },
    destroy() {
      dead = true;
      stopped = true;
      queue.length = 0;
      running?.ac.abort();
      handlers.clear();
      notifyIdle();
    },
  };
}
