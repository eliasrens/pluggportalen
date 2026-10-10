// ============================================================================
// Guldrushen (#564): KISTORNAS LJUD (designspec §6.4, §8). Ett ljud per
// `sound`-id i kistkonfigen (delat/chests-config.js) – en ny kisttyp väljer ett
// befintligt id där eller lägger till sitt ljud här. Syntetiserat med samma
// tone(f, start, längd, typ, volym, glid) som resten av Live (proj-sound.js) –
// inga ljudfiler. Projektorn (egen issue) kan spela samma ljud via
// sound.play(GR_SOUNDS[id]).
//
// ELEVDATORN: createChestSound() – egen nyckel pp:gr:kistljud, AV som standard
// (30 datorer som piper i otakt = kaos, §8), låg volym. Eleven slår på med
// ljudknappen (en gest → webbläsaren tillåter ljud).
//
// API
//   GR_SOUNDS  { [id]: (tone) => void }  klirr, klirr-stor, glitter, fanfar,
//              pling-pling, smygtassar, svisch, mynt-studs, puff, vosh
//   createChestSound() → proj-sound createSound med elevens inställning
//   playChestSound(sound, id) → bool (tyst om av, okänt id eller ej upplåst)
// ============================================================================

import { createSound } from "../../proj-sound.js";

const KEY = "pp:gr:kistljud";

export const GR_SOUNDS = Object.freeze({
  "klirr": (t) => [2637, 3136].forEach((f, i) => t(f, i * 0.07, 0.12, "triangle", 0.07)),
  "klirr-stor": (t) => [2349, 2637, 3136, 3520, 2637].forEach((f, i) => t(f, i * 0.055, 0.14, "triangle", 0.08)),
  "glitter": (t) => {
    [3136, 3951, 4699, 3951, 5274].forEach((f, i) => t(f, i * 0.05, 0.1, "sine", 0.05));
    t(2637, 0.28, 0.16, "triangle", 0.07);
  },
  "fanfar": (t) => [523, 659, 784, 1047].forEach((f, i) => t(f, i * 0.11, i === 3 ? 0.45 : 0.14, "triangle", 0.12)),
  "pling-pling": (t) => { t(1568, 0, 0.12, "sine", 0.1); t(2093, 0.16, 0.18, "sine", 0.1); },
  "smygtassar": (t) => [0, 0.11, 0.22, 0.33].forEach((a, i) => t(i % 2 ? 200 : 240, a, 0.06, "triangle", 0.07, 150)),
  "svisch": (t) => { t(320, 0, 0.28, "sawtooth", 0.035, 1500); t(1500, 0.22, 0.26, "sawtooth", 0.03, 320); },
  "mynt-studs": (t) => [2349, 2093, 1760, 1568].forEach((f, i) => t(f, i * 0.09, 0.07, "triangle", 0.06 - i * 0.01)),
  "puff": (t) => t(160, 0, 0.18, "sine", 0.08, 70),
  "vosh": (t) => { t(220, 0, 0.32, "sine", 0.09, 660); t(880, 0.18, 0.3, "sine", 0.05, 1320); },
});

export function createChestSound() {
  return createSound({ key: KEY, defaultOn: false, volume: 0.25 });
}

export function playChestSound(sound, id) {
  const fn = GR_SOUNDS[id];
  return !!(sound && fn && sound.play(fn));
}
