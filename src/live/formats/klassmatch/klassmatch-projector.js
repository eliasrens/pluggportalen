// ============================================================================
// Klassmatchen – projektorns delar (#547). Laddas LATT av projektorskalet
// (src/live/projector.js) via KLASSMATCH.projectorViews() = import().
//   views          Raketrace, Statistik, Dragkamp (bara två klasser) och
//                  Trollkarlsduellen (#536, två klasser, äger sin egen final;
//                  modulen hämtas först när vyn väljs)
//   createLobby    lobbyn: "N elever redo" per klass, nämnare, trollkarlar
//   createWinner   vinnarskärm + konfetti
//   editDivisors   "÷ Nämnare"-dialogen (#543)
// View-post: { id, label, create(host, { st, colors, sound }) → { update, destroy },
//   only2?: bara två klasser, finale?: vyn visar själv slutet (ingen
//   vinnarskärm), preload?(): förladda (lobbyn, när vyn är vald) }
// ============================================================================

import { createLobby } from "../../proj-lobby.js";
import { createRocketView } from "../../proj-rocket.js";
import { createStatsView } from "../../proj-stats.js";
import { createTugView } from "../../proj-tug.js";
import { createWinner } from "../../proj-winner.js";
import { openDivisorDialog } from "../../live-divisor-dialog.js";

const loadTrollkarl = () => import("../../trollkarl/trollkarl-vy.js");

// Lat vy: modulen hämtas först när vyn väljs (inga nya filer i bootgrafen).
// Senaste st buffras medan den laddar.
function lazyView(load, name) {
  return (host, opts) => {
    let ui = null;
    let last = opts.st;
    let dead = false;
    host.innerHTML = `<div class="lp-wait">Laddar…</div>`;
    load().then((m) => {
      if (!dead) ui = m[name](host, { ...opts, st: last });
    }).catch((err) => {
      if (dead) return;
      const w = document.createElement("div");
      w.className = "lp-wait";
      w.textContent = `Vyn kunde inte laddas (${err?.message || err}). Välj en annan vy eller ladda om sidan.`;
      host.replaceChildren(w);
    });
    return {
      update(st) { last = st; ui?.update(st); },
      destroy() { dead = true; ui?.destroy(); },
    };
  };
}

export const views = [
  { id: "raket", label: "🚀 Raketrace", create: createRocketView },
  { id: "statistik", label: "📊 Statistik", create: createStatsView },
  { id: "dragkamp", label: "🪢 Dragkamp", create: createTugView, only2: true },
  {
    id: "trollkarl", label: "🧙 Trollkarlsduellen", create: lazyView(loadTrollkarl, "createTrollkarlView"), only2: true, finale: true,
    // Lobbyn med två klasser och Trollkarlsduellen vald: förladda vyn (§17).
    preload: () => loadTrollkarl().then((m) => m.preload?.()).catch(() => {}),
  },
];

export { createLobby, createWinner };

/** "÷ Nämnare" (projektorns rad under och efter matchen). */
export function editDivisors(host, { session, save }) {
  return openDivisorDialog(host, { session, save });
}
