// ============================================================================
// Hitta rätt! – kartmotorns redigerings-API (src/hitta-ratt/karta/redigering.js) · #636
// ----------------------------------------------------------------------------
// Bara LÄRARVYN anropar de här (arkitektur §11.6 punkt 5 och §11.7). Spelet
// rör dem aldrig, så spelbeteendet är oförändrat. Ligger utanför
// kartmotor.js så att den håller sig under 400 rader. Ingen DOM här – bara
// motorns interna delar (testas i Node med stubbar).
//
//   k.satGissning({ lon, lat } | null, { zooma })
//       Sätter nålen programmatiskt (sökträff). zooma: true → kameran glider
//       dit och zoomar in (minst ZOOM × helvyn). Ingen "gissning"-händelse –
//       anroparen vet redan platsen. Dra nålen / klicka om fungerar som i spelet.
//   k.markera(ids, { etikett: { id, text } })
//       Alla valda områden får klassen `markerad` (blå fyllning + kontur), de
//       ritas överst så konturen syns. Motorns eget klickval (`vald`) töms, så
//       ett område som klickats bort inte ser valt ut. etikett = namnet vid
//       senast klickade området (bara läraren ser namn – §4.2).
// ============================================================================

import { tillKarta } from "./projektion.js";

/** Inzoomning när en sökträff väljs (gånger helvyn). */
export const ZOOM = 4;

/**
 * @param m  motorns delar: { p, omraden: Map id → { path, c }, skarm, kam, rita, rensaVal }
 */
export function skapaRedigering(m) {
  let markerade = new Set();

  return {
    satGissning(pos, { zooma = false } = {}) {
      if (!pos || !Number.isFinite(pos.lon) || !Number.isFinite(pos.lat)) {
        m.skarm.satGiss(null);
        m.rita();
        return;
      }
      const xy = tillKarta(m.p, pos.lon, pos.lat);
      m.skarm.satGiss(xy);
      if (zooma) {
        const k = Math.max(m.kam.kam.k, m.kam.kHem * ZOOM);
        m.kam.animera({ k, cx: xy[0], cy: xy[1] }, 500);
      }
      m.rita();
    },

    markera(ids = [], { etikett = null } = {}) {
      m.rensaVal();
      const nya = new Set(ids.filter((id) => m.omraden.has(id)));
      for (const id of markerade) if (!nya.has(id)) m.omraden.get(id)?.path.classList.remove("markerad");
      for (const id of nya) {
        const { path } = m.omraden.get(id);
        path.classList.add("markerad");
        path.parentNode?.appendChild(path); // överst bland områdena → hela konturen syns
      }
      markerade = nya;
      const o = etikett && m.omraden.get(etikett.id);
      if (o && etikett.text) m.skarm.satEtikett(etikett.text, o.c, "mitt");
      else m.skarm.satEtikett("", null);
      m.rita();
    },

    get markerade() { return [...markerade]; },
  };
}
