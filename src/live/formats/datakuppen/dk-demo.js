// ============================================================================
// Datakuppen – DEMOLÄGE FÖR PROJEKTORN (#654). En hel match i minnet på den
// gemensamma kistspelsdemon (#651, src/live/kistspel/ks-demo.js): samma 30
// påhittade elever med avatarer, filerna öppnas med formatets RIKTIGA regler
// (DK_REGLER – samma som servern), händelserna skrivs som servern skriver dem
// (dkEvents, nyast först; lyckat hack = type "steal", chest "hack").
// Projektorn monteras med `deps` – inget Firestore-lager laddas, inga Cloud
// Functions anropas, inget skrivs (sessionen har demo:true, som live-rewards
// aldrig betalar för). Sidan: preview/preview-datakuppen-demo.html.
//
// Koderna (välj kod, gissa kod, minnesmomentet) avgörs av servern och syns
// aldrig på projektorn – demot simulerar bara det projektorn ser: lyckade
// hack som händelser och klassens hackförsök (dkPlayers.hackAttempts/
// hackSuccess) för statistikvyn. Ett misslyckat hack skriver ingen händelse,
// precis som servern.
//
// API
//   createDkDemo({ sid?, classes?, showNames?, hacking?, screen?, onLog?, rng? })
//     → kistdemon (ks-demo) + {
//       hack()           ett lyckat hack (från en elev längre ned mot den rikaste
//                        som går att välja) – hack-linjen + terminalraden
//       hackFail()       ett misslyckat hackförsök (bara statistiken räknar)
//       hackStats()      { attempts, success } hela klassen
//     }
//   DEMO_FILES        [{ id, icon, label }] filtyperna (demopanelen)
//   forceReducedMotion(on)
// ============================================================================

import { createKistDemo } from "../../kistspel/ks-demo.js";
import { computeStandings, buildResult } from "./datakuppen-core.js";
import { DK_REGLER } from "./delat/datakuppen-regler.js";
import { DK_FILES } from "./delat/files-config.js";
import { milestone } from "./dk-proj-scen.js";

export { forceReducedMotion } from "../snilleblixt/sb-demo.js";
export const DEMO_FILES = DK_FILES.map((f) => ({ id: f.id, icon: f.icon, label: f.label }));

const THEME = {
  format: "datakuppen",
  displayName: "Datakuppen",
  regler: DK_REGLER,
  computeStandings: (s, { players, grPlayers }) => computeStandings(s, { players, dkPlayers: grPlayers }),
  buildResult: (s, c, players, m, { grPlayers, answers }) => buildResult(s, c, players, m, { dkPlayers: grPlayers, answers }),
  milestone,
  chests: { fallback: "mapp", shield: "brandvagg", lead: "serverhall", treasure: "mapp" },
  dataKey: "datakuppen",
  logs: { allReached: "alla milstolpar redan nådda", reached: (next, name) => `🎉 milstolpe ${next} MB – ${name}` },
};

export function createDkDemo(opts = {}) {
  const hacking = opts.hacking !== false;
  const demo = createKistDemo(THEME, { sid: "demo-datakuppen", ...opts, stealSwap: hacking });
  demo.session.hacking = hacking;
  delete demo.session.stealSwap;
  // Kistdemon slår filer med session.stealSwap – Datakuppens fält heter hacking.
  Object.defineProperty(demo.session, "stealSwap", { get: () => demo.session.hacking, enumerable: false, configurable: true });

  // Klassens hackförsök: varje lyckat hack (händelse) räknas, plus ibland ett
  // misslyckat försök före (minnesmomentet: andra försöket lyckas oftare).
  const stats = new Map(); // uid → { a, s }
  const seen = new Set();
  const bump = (uid, ok) => {
    const x = stats.get(uid) || { a: 0, s: 0 };
    x.a++;
    if (ok) x.s++;
    stats.set(uid, x);
  };
  demo.onChange(() => {
    for (const e of demo.state().events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.type === "steal" && e.chest === "hack") {
        if (Number(e.id.replace(/\D/g, "")) % 2) bump(e.uid, false);
        bump(e.uid, true);
      }
    }
  });
  const decorate = (g) => ({ ...g, hackAttempts: stats.get(g.uid)?.a || 0, hackSuccess: stats.get(g.uid)?.s || 0 });
  const api = demo.deps.datakuppen;
  const watch = api.watchGrPlayers;
  api.watchGrPlayers = (s, f) => watch(s, (list, meta) => f(list.map(decorate), meta));

  return Object.assign(demo, {
    hack: () => demo.chest("hack"),
    hackFail() {
      const r = demo.state().grPlayers;
      if (!r.length) return;
      const g = r[Math.floor((opts.rng || Math.random)() * r.length)];
      bump(g.uid, false);
      demo.emit(true);
      opts.onLog?.(`💻 ${g.name} gissade fel kod (ingen händelse – bara statistiken)`);
    },
    hackStats() {
      let attempts = 0;
      let success = 0;
      for (const x of stats.values()) { attempts += x.a; success += x.s; }
      return { attempts, success };
    },
  });
}
