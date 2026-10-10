// ============================================================================
// Guldrushen (#564): NOTISEN till den som blev bestulen (funktionsspec §6.7,
// designspec §6.5): "🦝 Leo knyckte 20 guld från dig!" med Leos avatar glider
// in från kanten, syns ~2 s och blockerar aldrig spelet (pointer-events: none,
// ligger utanför svarsytan). Texten kommer ur gr-elev.js createHitWatcher.
//
// API
//   createNotice(box, { pool, roster, ms? }) → { show(hit, by?), destroy() }
//     hit = { text, name, byUid }   by = tjuvens grPlayers-rad (classId → avatar)
// ============================================================================

import { escHtml } from "../../../ui.js";

export function createNotice(box, { pool, roster, ms = 2200 }) {
  let t = 0;
  return {
    show(hit, by = null) {
      const text = escHtml(hit.text);
      const name = escHtml(hit.name || "");
      box.innerHTML = `<span class="gr-notis-av"></span><span class="gr-notis-text">${name ? text.replace(name, `<b>${name}</b>`) : text}</span>`;
      if (hit.byUid) {
        roster.ensure([{ uid: hit.byUid, classId: by?.classId ?? null }]).catch(() => {});
        box.querySelector(".gr-notis-av").appendChild(pool.el(hit.byUid, "notis"));
      }
      box.hidden = false;
      box.classList.remove("in");
      void box.offsetWidth;
      box.classList.add("in");
      clearTimeout(t);
      t = setTimeout(() => { box.classList.remove("in"); box.hidden = true; }, ms);
    },
    destroy() {
      clearTimeout(t);
    },
  };
}
