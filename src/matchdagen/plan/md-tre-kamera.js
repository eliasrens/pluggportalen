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
//   dimma([x, y, z])         → [near, far]   dimman börjar bortom planens bortersta hörn
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

/**
 * Lugnt läge: fast vy över hela planen. Smalare yta → bredare synfält och lite längre bort
 * (#882 F1: bara avståndet gav 150 m på en mobil – planen liten och inne i dimman).
 */
export function lugnVy(aspekt) {
  const smal = aspekt < SMAL;
  const s = smal ? 0.6 + 0.95 / aspekt : Math.max(0.95, 0.25 + 1.75 / aspekt);
  return { pos: [0, 52 * s, 4 + 58 * s], mal: [0, 0, 4], fov: smal ? 65 : 50 };
}

/** Planens hörn (scenens meter) – dimman ska börja bortom det som ligger längst bort. */
const HORN = [[-52.5, -34], [52.5, -34], [-52.5, 34], [52.5, 34]];
export const DIMMA = { near: 95, djup: 85 };
export function dimma([x, y, z]) {
  let d = 0;
  for (const [hx, hz] of HORN) d = Math.max(d, Math.hypot(hx - x, y, hz - z));
  const near = Math.max(DIMMA.near, Math.ceil(d) + 5);
  return [near, near + DIMMA.djup];
}
