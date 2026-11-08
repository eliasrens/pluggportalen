// ============================================================================
// Meteorstormen – projektorns LJUD (#822, spec §4.5): korta, mjuka ljud via
// skalets proj-sound.js (samma AudioContext, ljud av/på och musikens ducking).
// Laser, explosion, träff i skölden/skrovet, dragstrålens kast och händelse-
// banderollen. Varje sort högst en gång per GAP_MS – en hård final blir ett
// sorl, aldrig en kakofoni. Ljud är inte en del av "samma bild": det spelas
// bara för loggposter som är NYA för den här projektorn.
//   createMsLjud(sound) → { post(loggpost), banderoll(typ), slut(), destroy() }
// ============================================================================

const TONER = {
  laser: (t) => t(1500, 0, 0.11, "sawtooth", 0.035, 520),
  boom: (t) => { t(150, 0, 0.32, "sine", 0.13, 60); t(95, 0.02, 0.38, "triangle", 0.07, 45); },
  skold: (t) => t(620, 0, 0.18, "sine", 0.06, 900),
  traff: (t) => { t(105, 0, 0.3, "sine", 0.16, 52); t(70, 0.03, 0.3, "triangle", 0.08, 40); },
  kast: (t) => { t(240, 0, 0.5, "sine", 0.08, 900); t(900, 0.3, 0.3, "sine", 0.04, 1300); },
  band: (t) => [659, 784, 988].forEach((f, i) => t(f, i * 0.12, i === 2 ? 0.4 : 0.14, "triangle", 0.12)),
  jatte: (t) => { t(98, 0, 0.9, "sine", 0.16, 70); [523, 466, 392].forEach((f, i) => t(f, 0.15 + i * 0.18, 0.2, "triangle", 0.1)); },
  slut: (t) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => t(f, [0, 0.16, 0.32, 0.5, 0.74, 0.9][i], i === 5 ? 0.7 : 0.2, "triangle", 0.18)),
};
const GAP_MS = { laser: 120, boom: 160, skold: 180, traff: 220, kast: 600, band: 1500, jatte: 1500, slut: 5000 };

export function createMsLjud(sound) {
  const sist = new Map();
  const spela = (namn) => {
    if (!sound) return;
    const nu = performance.now();
    if (nu - (sist.get(namn) ?? -Infinity) < GAP_MS[namn]) return;
    sist.set(namn, nu);
    sound.play(TONER[namn]);
  };
  return {
    post(p) {
      if (p.typ === "nedskjuten") { spela("laser"); spela("boom"); }
      else if (p.typ === "traff") spela("traff");
      else if (p.typ === "skold") spela("skold");
      else if (p.typ === "kast") spela("kast");
      else if (p.typ === "handelse") spela(p.handelse === "jattemeteor" ? "jatte" : "band");
    },
    slut: () => spela("slut"),
    destroy() { sist.clear(); },
  };
}
