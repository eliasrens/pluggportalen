// ============================================================================
// Meteorstormen – EN BILDRUTA av rymden (#822). Ritar motorns tillstånd vid t
// på en Canvas 2D: bakgrunden, stationerna (skadenivåer, bucklor, besättning,
// gung), sköldbubblorna, meteorerna, laserstrålarna, explosionerna, "⚠️
// Skölden är nere!" och slutets fyrverkerier. Ingen egen stat utöver
// bakgrundsbilden: samma (tillstånd, t, frö) → samma pixlar. Används av
// projektorvyn (msp-rymd.js) och motor-previewn (skrovreglaget).
//
// API
//   skapaBild(canvas) → { rita(o), storlek(pxW, pxH) }
//   o = { s: tillståndet (simulera/tillstand), tMotor, tAnim, cfg, plan,
//         minne (skapaLoggminne().las), farger: [färg per station],
//         namn(classId), seed, rorelse, slut: { sedan, firar: [index] } | null,
//         skrov?: [override per station] (previewns reglage) }
// ============================================================================

import { W, H, platser, meteorPunkt, humor, gungVid, RADIE } from "./msp-scen.js";
import { skapaBakgrund, ritaTindra, ritaMeteor, samlaEffekter, ritaEffekter, ritaFyrverkeri, traffVinkel } from "./msp-rita.js";
import { ritaStation } from "./msp-station.js";
import { ritaBubbla, ritaSkoldText } from "./msp-skold.js";

const BUCKLOR_MAX = 12;

export function skapaBild(canvas) {
  const g = canvas.getContext("2d", { alpha: false });
  let bak = null;
  let px = [0, 0];

  function storlek(pxW, pxH) {
    if (px[0] === pxW && px[1] === pxH && bak) return;
    px = [pxW, pxH];
    canvas.width = pxW;
    canvas.height = pxH;
    bak = skapaBakgrund(pxW, pxH);
  }

  function rita(o) {
    const { s, tMotor, tAnim, cfg, plan, minne, farger, seed, rorelse, slut } = o;
    if (!bak) storlek(canvas.width || W, canvas.height || H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bak, 0, 0);
    g.setTransform(px[0] / W, 0, 0, px[1] / H, 0, 0);
    ritaTindra(g, tAnim, rorelse);

    const pl = platser(s.stationer.length, !!slut);
    const index = new Map(s.stationer.map((st, i) => [st.classId, i]));
    const ctx = { plan, kast: minne.kast, cfg, index, pl, seed, farger };
    const { vagor, eff } = samlaEffekter(s.logg, tAnim, ctx);
    const gung = s.stationer.map((st) => (rorelse ? gungVid(minne, st.classId, tAnim) : { x: 0, y: 0 }));

    s.stationer.forEach((st, i) => {
      const skrov = o.skrov?.[i] ?? st.skrov;
      const bucklor = (minne.traffar.get(st.classId) || []).slice(-BUCKLOR_MAX).map((p) => traffVinkel(p, ctx));
      let hum = humor(minne, st.classId, tAnim, skrov === 0);
      if (slut && skrov > 0) hum = slut.firar.includes(i) ? "jubel" : "lugn";
      ritaStation(g, {
        ...pl[i], farg: farger[i], skrov, t: tAnim, seed, idx: i, humor: hum, gung: gung[i], rorelse,
        buckla: bucklor, tand: !!slut && slut.firar.includes(i), vinka: !!slut && !slut.firar.includes(i),
      });
    });
    s.stationer.forEach((st, i) => {
      if ((o.skrov?.[i] ?? st.skrov) === 0) return;
      ritaBubbla(g, { ...pl[i], skold: st.skold, t: tAnim, seed, idx: i, gung: gung[i], vagor: vagor[i] });
    });

    // meteorerna – bara medan stormen pågår (ett avslut före tiden fryser inga stenar i luften)
    if (!slut) {
      // flyter (skrov 0): ingen bubbla – skölden tar inget, meteoren når skrovet och puffar ofarligt
      const slutR = s.stationer.map((st, i) => ((o.skrov?.[i] ?? st.skrov) > 0 && st.skold > 0 ? RADIE.bubbla : RADIE.skrov));
      for (const m of s.meteorer) {
        const i = index.get(m.mal);
        if (i === undefined) continue;
        const kastI = m.kastadAv ? index.get(m.kastadAv) ?? -1 : -1;
        const geo = { mal: i, kastadAv: kastI, bana: m.bana, spawnMs: m.spawnMs, ankomstMs: m.ankomstMs, jatte: !!m.jatte };
        const p = meteorPunkt(geo, tMotor, pl, slutR[i]);
        ritaMeteor(g, m, p, { t: tMotor, seed, farg: farger[kastI] || "#ffd166", fran: m.kastadAv ? o.namn(m.kastadAv) : "", pl, geo });
      }
    }
    ritaEffekter(g, eff, ctx);

    s.stationer.forEach((st, i) => {
      const skrov = o.skrov?.[i] ?? st.skrov;
      if (st.skold <= 0 && skrov > 0 && !slut) ritaSkoldText(g, pl[i].x, pl[i].y + 196 * pl[i].skala, pl[i].skala);
    });
    if (slut && rorelse) for (const i of slut.firar) ritaFyrverkeri(g, tAnim, slut.sedan, pl[i].x, pl[i].y, farger[i], seed);
  }

  return { rita, storlek, g };
}
