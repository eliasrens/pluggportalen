// ============================================================================
// Datakuppen 💾 (#653): ELEVENS KOD på spelytan (spec §1.2, §1.5) – lobbyns
// kodval och "Välj ny kod" efter ett hack. Ritar med dk-kodval.js, läser
// elevens dkSelf (kod, förslag, offersExpiresAt) och anropar BARA pickCode:
//   lobbyn   inga förslag än → pickCode(null) ber servern om fyra; eleven
//            väljer (index) → "Din kod: f0tb01l ✓"
//   start    ingen kod vald i lobbyn → pickCode(null): servern väljer en
//   hackad   fyra nya förslag + nedräkning (~10 s). Notisen visas först
//            (~2 s), sedan raden "Välj ny kod" ovanför frågan – spelet stoppas
//            aldrig. Tiden ute → pickCode(null): servern väljer åt eleven.
//            Valt → "🔑 Ny kod: … ✓" en kort stund.
//
// API
//   createCodeArea({ view, box, api, sid, sound?, reduced?, now, onError? })
//     → { lobby(self), live(self, { noticeUntil }), hide(), destroy() }
//     view  elevvyn (lobbyns [data-dk-kod] letas upp där)
//     box   raden "Välj ny kod" på spelytan
// ============================================================================

import { codePickState } from "./dk-elev.js";
import { DK_RULES } from "./delat/files-config.js";
import { toMs } from "../../kistspel/delat/ks-regler.js";
import { createCodePicker, codeHtml } from "./dk-kodval.js";

const FLASH_MS = 1800;
const NOTICE_MS = 2200; // notisen "… knäckte din kod" (dk-notis.js) syns först

export function createCodeArea({ view, box, api, sid, sound = null, reduced = false, now, onError = () => {} }) {
  let asked = ""; // pickCode(null) en gång per läge
  let lobbyPicker = null;
  let lobbyEl = null;
  let picker = null;
  let pickerCode = null; // koden när raden öppnades (servern kan välja åt eleven)
  let flashing = false;
  let done = ""; // förslagen eleven redan valt bland
  let iv = 0;
  let t = 0; // väntan på notisen
  let flashT = 0;
  let last = null; // senaste dkSelf
  let notice = 0;
  let destroyed = false;

  function ask(tag) {
    if (asked === tag) return;
    asked = tag;
    api.pickCode({ sid }).catch((err) => {
      asked = "";
      onError(err);
    });
  }

  function lobby(self) {
    const slot = view.querySelector(".live-elev-lobby [data-dk-kod]");
    if (!slot || destroyed) return;
    if (!lobbyPicker || lobbyEl !== slot.firstElementChild) {
      lobbyPicker = createCodePicker(slot, { lobby: true, sound, pick: (index) => api.pickCode({ sid, index }) });
      lobbyEl = slot.firstElementChild;
    }
    if (!self?.code && !self?.offers?.length) ask("lobby");
    lobbyPicker.set(codePickState(self, "lobby", now()));
  }

  function hide() {
    clearInterval(iv);
    clearTimeout(t);
    clearTimeout(flashT);
    iv = 0;
    flashing = false;
    picker?.destroy();
    picker = null;
    box.hidden = true;
  }

  function flash(code) {
    clearInterval(iv);
    iv = 0;
    if (!code || !picker) return hide();
    flashing = true;
    box.firstElementChild.innerHTML = `<p class="dkv-klar">🔑 Ny kod: ${codeHtml(code)} <span class="dkv-bock">✓</span></p>`;
    flashT = setTimeout(hide, FLASH_MS);
  }

  function live(self, { noticeUntil = 0 } = {}) {
    if (destroyed) return;
    last = self;
    notice = noticeUntil;
    clearTimeout(t);
    if (!self?.code) ask("start");
    const state = codePickState(self, "live", now());
    const key = state.offers.join("|");
    if (flashing) return;
    if (picker && !state.show && self?.code && self.code !== pickerCode) return flash(self.code);
    if (!state.show || key === done) return hide();
    // Notisen först (~2 s efter hacket, serverns tid), sedan raden.
    const hackAt = toMs(self.offersExpiresAt) - DK_RULES.codePickMs;
    const wait = Math.max(notice - Date.now(), hackAt + NOTICE_MS - now());
    if (wait > 0) {
      t = setTimeout(() => live(last, { noticeUntil: notice }), wait + 30);
      return;
    }
    if (!picker) {
      pickerCode = self.code;
      picker = createCodePicker(box, {
        lobby: false, sound,
        pick: async (index) => {
          const res = await api.pickCode({ sid, index });
          done = key;
          flash(res?.code);
        },
      });
      box.hidden = false;
      if (!reduced) box.animate?.([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 220 });
    }
    picker.set(state);
    if (!iv) {
      iv = setInterval(() => {
        const s = codePickState(last, "live", now());
        if (!s.show) return live(last, { noticeUntil: notice });
        picker?.set(s);
        // Tiden ute → servern väljer åt eleven.
        if (s.leftMs === 0) ask(`auto:${s.offers.join("|")}`);
      }, 250);
    }
  }

  return {
    lobby,
    live,
    hide,
    destroy() {
      destroyed = true;
      hide();
      lobbyPicker?.destroy();
    },
  };
}
