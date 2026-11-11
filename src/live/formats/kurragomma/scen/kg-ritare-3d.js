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
      if (forstaKamera) { tre.kameraHopp(p); forstaKamera = false; } else tre.kameraSatt(p, dt);
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
