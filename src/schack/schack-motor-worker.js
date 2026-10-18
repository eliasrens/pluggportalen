// ============================================================================
// Web Worker-skalet runt schackmotorn (#776, §3.1): tar emot { id, typ, fen, opt }
// och svarar { id, ok, resultat | fel }. Allt tänkande sker här, så brädet i
// huvudtråden fryser aldrig. Startas av schack-dator.js med
//   new Worker(new URL("./schack-motor-worker.js", import.meta.url), { type: "module" })
// – URL:en bygger på modulens egen adress och fungerar därför både lokalt,
// på GitHub Pages med repots basväg och på en egen domän.
// ============================================================================

import { valjDrag, analysera } from "./schack-motor.js";

self.onmessage = (e) => {
  const { id, typ, fen, opt } = e.data || {};
  try {
    const resultat = typ === "tips" ? analysera(fen, opt) : valjDrag(fen, opt);
    self.postMessage({ id, ok: true, resultat });
  } catch (fel) {
    self.postMessage({ id, ok: false, fel: String(fel && fel.message || fel) });
  }
};

self.postMessage({ typ: "redo" });
