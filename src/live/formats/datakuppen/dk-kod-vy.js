// ============================================================================
// Datakuppen 💾 (#653, #719): ELEVENS KOD – lobbyns kodval. Ritar med
// dk-kodval.js, läser elevens dkSelf (kod, förslag) och anropar BARA pickCode:
//   lobbyn   inga förslag än → pickCode(null) ber servern om fyra; eleven
//            väljer (index) → "Din kod: f0tb01l ✓" en stund, sedan dold
//            bakom "Visa kod"
//   start    ingen kod vald i lobbyn → pickCode(null): servern väljer en
// Koden gäller HELA matchen (#719): efter ett hack visas bara notisen
// (dk-notis.js) och skyddet – inget nytt kodval.
//
// API
//   createCodeArea({ view, api, sid, sound?, onError? })
//     → { lobby(self), live(self), destroy() }
//     view  elevvyn (lobbyns [data-dk-kod] letas upp där)
// ============================================================================

import { codePickState } from "./dk-elev.js";
import { createCodePicker } from "./dk-kodval.js";

export function createCodeArea({ view, api, sid, sound = null, onError = () => {} }) {
  let asked = ""; // pickCode(null) en gång per läge
  let lobbyPicker = null;
  let lobbyEl = null;
  let destroyed = false;

  function ask(tag) {
    if (asked === tag) return;
    asked = tag;
    api.pickCode({ sid }).catch((err) => {
      asked = "";
      // Lobbyns felrad syns i lobbyn; spelytans via vyn.
      if (tag === "lobby" && lobbyPicker) lobbyPicker.error(err?.message || "Det gick inte – försök igen.");
      else onError(err);
    });
  }

  function lobby(self) {
    const slot = view.querySelector(".live-elev-lobby [data-dk-kod]");
    if (!slot || destroyed) return;
    if (!lobbyPicker || lobbyEl !== slot.firstElementChild) {
      lobbyPicker?.destroy();
      lobbyPicker = createCodePicker(slot, { sound, pick: (index) => api.pickCode({ sid, index }) });
      lobbyEl = slot.firstElementChild;
    }
    if (!self?.code && !self?.offers?.length) ask("lobby");
    lobbyPicker.set(codePickState(self, "lobby"));
  }

  function live(self) {
    if (destroyed) return;
    if (!self?.code) ask("start");
  }

  return {
    lobby,
    live,
    destroy() {
      destroyed = true;
      lobbyPicker?.destroy();
    },
  };
}
