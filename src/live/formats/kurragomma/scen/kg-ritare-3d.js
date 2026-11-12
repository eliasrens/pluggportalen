// ============================================================================
// Kurragömma (#837): 3D-RITAREN – sätter ihop three-ritaren (kg-tre.js),
// figurerna (kg-figur.js), effekterna (kg-effekter.js) och kameralogiken
// (kg-kamera.js) till RITAR-GRÄNSSNITTET som kg-scen.js använder. 2D-reserven
// (kg-2d.js) har exakt samma gränssnitt, så kg-scen vet inte vilken som kör.
//
// Ritar-gränssnittet
//   typ                         "3d" | "2d"
//   lageSatt(lage)              elev-gom | elev-gomd | elev-sokare | projektor
//   kamera({ jag, inneI, projektor: { t, glid, stilla } }, dt) · kameraHopp()
//   figur(uid, { x, z, gar, namn, skylt, hopp }) · figurerBehall(uids) · namnPa(bool)
//   genomskinlig(lovId | null)
//   vissling(p, { markor, text }, nu) · hittad(p, { text }, nu)
//   gomstalle(uid, p) · gomstallenRensa()
//   skarmPunkt(x, z) → { sx, sy, inne } · markPunkt(sx, sy) → { x, z } | null
//   rita(nu, dt) → ritanrop · nivaSatt(n) · storlek() · dispose()
// ============================================================================

import { skapaTreRitare } from "./kg-tre.js";
import { skapaFigurer, FIGUR_HOJD_M } from "./kg-figur.js";
import { skapaEffekter } from "./kg-effekter.js";
import { kameraHinder, placeraKamera, projektorKamera } from "./kg-kamera.js";

export function skapa3dRitare({ T, yta, karta, niva, bilder }) {
  const tre = skapaTreRitare({ T, yta, karta, niva });
  const figurer = skapaFigurer(T, { scen: tre.scen, bilder });
  const effekter = skapaEffekter(T, { scen: tre.scen });
  const hinder = kameraHinder(karta);
  let lage = "elev-gom";
  let forstaKamera = true;
  // Den mjuka följningen: kameran och blickpunkten glider mot det önskade läget
  // (k = 1 − e^(−7·dt)), och det lerpade läget klipps mot hindren en gång till
  // så inte heller mellanlägena skär genom en krona eller en vägg.
  const nu = { x: 0, y: 0, z: 0, mal: { x: 0, y: 0, z: 0 } };
  const lerp = (a, b, k) => a + (b - a) * k;

  return {
    typ: "3d",
    tre, figurer, effekter,
    lageSatt(l) {
      if (l !== lage) forstaKamera = true;
      lage = l;
      tre.dimma(l);
    },
    kamera({ jag, inneI = null, projektor = null }, dt) {
      let p;
      if (lage === "projektor") {
        const { w, h } = tre.storlek();
        p = projektorKamera({ ...(projektor || {}), aspekt: w / h });
      } else {
        p = placeraKamera({ jag, hinder, inneI });
      }
      if (forstaKamera) {
        nu.x = p.x; nu.y = p.y; nu.z = p.z; Object.assign(nu.mal, p.mal);
        forstaKamera = false;
      } else {
        const k = 1 - Math.exp(-dt * 7);
        nu.x = lerp(nu.x, p.x, k); nu.y = lerp(nu.y, p.y, k); nu.z = lerp(nu.z, p.z, k);
        nu.mal.x = lerp(nu.mal.x, p.mal.x, k); nu.mal.y = lerp(nu.mal.y, p.mal.y, k); nu.mal.z = lerp(nu.mal.z, p.mal.z, k);
        if (lage !== "projektor") {
          const q = placeraKamera({ jag, hinder, inneI, fullt: { x: nu.x, y: nu.y, z: nu.z } });
          nu.x = q.x; nu.y = q.y; nu.z = q.z;
        }
      }
      tre.kameraSatt(nu);
    },
    kameraHopp() { forstaKamera = true; },
    figur: figurer.satt,
    figurerBehall: figurer.behall,
    namnPa: figurer.namnPa,
    genomskinlig: (id) => tre.varld.genomskinlig(id),
    vissling: effekter.vissling,
    hittad: effekter.hittad,
    gomstalle: effekter.gomstalle,
    gomstallenRensa: effekter.gomstallenRensa,
    skarmPunkt: (x, z) => tre.skarmPunkt(x, FIGUR_HOJD_M * 0.6, z),
    markPunkt: tre.markPunkt,
    rita(nu, dt) {
      figurer.tick(nu);
      effekter.tick(nu, dt);
      return tre.rita();
    },
    nivaSatt: tre.nivaSatt,
    storlek: tre.storlek,
    dispose() {
      effekter.dispose();
      figurer.dispose();
      tre.dispose();
    },
  };
}
