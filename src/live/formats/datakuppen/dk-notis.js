// ============================================================================
// Datakuppen 💾 (#653): NOTISEN till den som blev hackad (spec §1.5, §4.3):
// "💻 Omar knäckte din kod och tog 45 MB!" med Omars avatar glider in från
// kanten, syns ~2 s och blockerar aldrig spelet (pointer-events: none, ligger
// utanför svarsytan). Texten kommer ur dk-elev.js createHitWatcher. Koden
// ligger kvar efter hacket (#719) – inget nytt kodval, spelet fortsätter.
//
// API
//   createDkNotice(box, { pool, roster, ms? }) → { show(hit, by?), destroy(), ms }
//     hit = { text, name, byUid }   by = hackarens dkPlayers-rad (classId → avatar)
// ============================================================================

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function createDkNotice(box, { pool, roster, ms = 2200 }) {
  let t = 0;
  return {
    ms,
    show(hit, by = null) {
      const text = esc(hit.text);
      const name = esc(hit.name || "");
      box.innerHTML = `<span class="dk-notis-av"></span><span class="dk-notis-text">${name ? text.replace(name, `<b>${name}</b>`) : text}</span>`;
      if (hit.byUid) {
        roster.ensure([{ uid: hit.byUid, classId: by?.classId ?? null }]).catch(() => {});
        box.querySelector(".dk-notis-av").appendChild(pool.el(hit.byUid, "notis"));
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
