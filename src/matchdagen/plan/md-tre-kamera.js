// ============================================================================
// Matchdagen (#882): TV-KAMERANS MÅL – REN (ingen DOM, ingen three). 3D-ritaren
// (md-tre-ritare.js) lerpar kameran mot det här; testet (matchdagen-kamera-882)
// projicerar bollen och spelarna runt den med three och kräver att de syns.
// Koordinater i scenens meter: x längs planen (−52,5–52,5), z tvärs (−34 bortre
// långsidan, +34 närmast kameran), y uppåt.
//
//   foljVy(bx, bz, aspekt)   → { pos: [x, y, z], mal: [x, y, z], fov }   följer bollen
//   lugnVy(aspekt)           → { pos, mal, fov }   fast vy där hela planen ryms (lugnt läge)
//   fovFor(aspekt)           → synfältet på höjden (smal yta: bredare)
//
// #882: kameran stod still på tvären (z 37) och siktade bara på 0,4 × bollens z –
// nära den närmaste långsidan hamnade bollen och spelarna under bildkanten. Nu
// följer både siktpunkten och kameran bollen på tvären (0,7 – bollen hamnar strax under
// mitten vid långsidan och planen fyller bilden), och i sidled lite mer.
// ============================================================================

export const SMAL = 1.6;
export const fovFor = (aspekt) => (aspekt < SMAL ? 50 : 36);

/** Följ-kameran från långsidan, lite bakom och ovanför bollen. */
export function foljVy(bx, bz, aspekt) {
  const bred = aspekt < SMAL ? 1.35 : 1;
  const tz = bz * 0.7;
  return { pos: [bx * 0.81, 19 * bred, tz + 37 * bred], mal: [bx * 0.95, 0, tz], fov: fovFor(aspekt) };
}

/** Lugnt läge: fast vy över hela planen – längre bort ju smalare ytan är. */
export function lugnVy(aspekt) {
  const s = Math.max(1.15, (aspekt < SMAL ? 2.05 : 3) / aspekt);
  return { pos: [0, 52 * s, 4 + 58 * s], mal: [0, 0, 4], fov: fovFor(aspekt) };
}
