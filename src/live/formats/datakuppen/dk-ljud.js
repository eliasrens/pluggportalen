// ============================================================================
// Datakuppen 💾 (#653): EFFEKTLJUDEN på elevdatorn (spec §4.5). Korta,
// digitala och dämpade – inget gällt och inget som ringer kvar. Ett ljud per
// `sound`-id i filtabellen (delat/files-config.js) + hackets ljud. Samma
// tone(f, start, längd, typ, volym, glid) som resten av Live (proj-sound.js),
// inga ljudfiler.
//
// ELEVDATORN: createDkSound() – egen nyckel pp:dk:ljud, AV som standard
// (som Guldrushen: 30 datorer som piper i otakt = kaos), låg volym. Eleven
// slår på med ljudknappen.
//
// API
//   DK_SOUNDS  { [id]: (tone) => void }  beep, beep-dubbel, uppladdning,
//              laddning, glitch, puff, vosh, access, dekryptera, nekad, klick
//   createDkSound() → proj-sound createSound med elevens inställning
//   playDkSound(sound, id) → bool (tyst om av, okänt id eller ej upplåst)
// ============================================================================

import { createSound } from "../../proj-sound.js";

const KEY = "pp:dk:ljud";

export const DK_SOUNDS = Object.freeze({
  "beep": (t) => t(1320, 0, 0.09, "sine", 0.07),
  "beep-dubbel": (t) => { t(1175, 0, 0.08, "sine", 0.07); t(1568, 0.11, 0.1, "sine", 0.07); },
  "uppladdning": (t) => [784, 988, 1175, 1568].forEach((f, i) => t(f, i * 0.07, 0.09, "triangle", 0.06)),
  "laddning": (t) => t(330, 0, 0.32, "triangle", 0.06, 1320),
  "glitch": (t) => { t(260, 0, 0.07, "square", 0.025, 180); t(200, 0.09, 0.08, "square", 0.025, 140); },
  "puff": (t) => t(170, 0, 0.16, "sine", 0.06, 80),
  "vosh": (t) => { t(220, 0, 0.26, "sine", 0.07, 620); t(660, 0.15, 0.22, "sine", 0.04, 990); },
  "access": (t) => { t(392, 0, 0.12, "triangle", 0.07); t(523, 0.12, 0.12, "triangle", 0.07); t(784, 0.24, 0.2, "triangle", 0.06); },
  "dekryptera": (t) => t(500, 0, 0.5, "sine", 0.025, 1500),
  "nekad": (t) => { t(330, 0, 0.1, "triangle", 0.06); t(247, 0.12, 0.16, "triangle", 0.06); },
  "klick": (t) => t(900, 0, 0.04, "sine", 0.05),
});

export function createDkSound() {
  return createSound({ key: KEY, defaultOn: false, volume: 0.22 });
}

export function playDkSound(sound, id) {
  const fn = DK_SOUNDS[id];
  return !!(sound && fn && sound.play(fn));
}
