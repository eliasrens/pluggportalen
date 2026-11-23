// Förhandsvisning #908 (preview-vinter-908.html): vinterdekoren i konsten utan
// inloggning. ?vy=matris (QA 24: snö på alla hus) | fonster (rumsfönstret) |
// gate (lärarspärrens dekor) och ?sasong=vinter|host|sommar|halloween|jul.
// Hela appen (byn, huset ute, gården, porten, spärren) med riktig routing:
// preview-vinter-908-app.html.
import { applyTheme } from "../../src/season-world.js";
import { listHusSkal, husMini } from "../../src/art-hus-ute.js";
import { getPalette, ROOM_PALETTES } from "../../src/room-palettes.js";

const q = new URLSearchParams(location.search);
const vy = q.get("vy") || "matris";
const sasong = q.get("sasong") || "vinter";
if (q.has("ren")) document.body.classList.add("ren");

const state = {
  season: ["vinter", "host", "sommar"].includes(sasong) ? sasong : sasong === "halloween" ? "host" : "vinter",
  halloweenActive: sasong === "halloween",
  julActive: sasong === "jul",
};
applyTheme(state);

const ctrl = document.getElementById("pv-ctrl");
const lank = (k, v, txt) => {
  const p = new URLSearchParams(location.search);
  p.set(k, v);
  const cur = (q.get(k) || (k === "vy" ? "matris" : "vinter")) === v;
  return `<a href="?${p}"${cur ? ' aria-current="true"' : ""}>${txt}</a>`;
};
ctrl.innerHTML =
  ["matris", "fonster", "gate"].map((v) => lank("vy", v, v)).join("") +
  " · " +
  ["vinter", "host", "sommar", "halloween", "jul"].map((v) => lank("sasong", v, v)).join("");

const yta = document.getElementById("pv-yta");

async function rita() {
  if (vy === "matris") {
    // Halloween-husen registreras lazy i appen – samma väg här.
    await import("../../src/halloween/hw-konst.js").then((m) => m.registreraHalloweenKonst());
    const pal = Object.keys(ROOM_PALETTES);
    yta.innerHTML = `<div class="pv-matris varld-stage">${listHusSkal()
      .map((s, i) => {
        const p = getPalette(pal[i % pal.length]);
        return `<div class="pv-ruta" style="--hus-house:${p.house};--hus-roof:${p.roof};--hus-wall:${p.wall};--hus-wall2:${p.wall2}">
          ${husMini({ skalId: s.id })}<div>${s.id}</div></div>`;
      })
      .join("")}</div>`;
  } else if (vy === "fonster") {
    const { windowItemHtml } = await import("../../src/art-room.js");
    // Bara fönstrets SVG (svg.room-window får paletten), förstorad.
    const html = windowItemHtml({ x: 50, y: 50, interactive: false });
    yta.innerHTML = `<div class="pv-fonster">${html.slice(html.indexOf("<svg"), html.indexOf("</svg>") + 6)}</div>`;
  } else if (vy === "gate") {
    const { mountGateSasong } = await import("../../src/season-world.js");
    yta.innerHTML = `<div class="teacher-page teacher-dark"><div class="panel gate-panel center"><h1>Lärarläge</h1></div></div>`;
    mountGateSasong(yta.firstElementChild);
  }
}
rita();
