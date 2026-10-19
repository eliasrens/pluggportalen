// ============================================================================
// Prov (#742, spec §7.5 "Över tid"): fliken "Prov" i klassens statistik
// (STATS_TABS i teacher-class.js, laddas med import() – #271).
//   Klassens provtillfällen  datum, prov, klassens snitt, fördelningen 🟢/🟡/🔴
//   En elev                  alla prov eleven skrivit: datum, procent, färg,
//                            nivå + en liten linje som visar utvecklingen
// Läser EN gång när fliken öppnas: en collection group-fråga på rattning
// (prov-statistik-data.js). Allt annat räknas i prov-statistik.js.
// CSS: prov-statistik.css (.provl-st-).
// ============================================================================

import { FARG_INFO, granserFor, historik, medTillfallensGranser, linjePunkter, procent } from "./prov-statistik.js";
import { fordelningEl } from "./prov-stat-vy.js";
import { hamtaKlassensRattningar, hamtaKlassensTillfallen } from "./prov-statistik-data.js";
import { h, laddaCss } from "./prov-vy.js";

const datumText = (ms) => (ms ? new Date(ms).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "–");
const resultatHash = (t) => `#/larare/prov/ratta?t=${encodeURIComponent(t)}&lage=oversikt`;
const SVG = "http://www.w3.org/2000/svg";

function bricka(andel, farg) {
  if (andel == null) return h("span", { class: "provl-st-bricka provl-st-ej" }, h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: "?" }), h("span", { text: "Ej rättad" }));
  const f = FARG_INFO[farg];
  return h("span", { class: `provl-st-bricka provl-st-${farg}`, title: f.namn },
    h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: f.ikon }), h("span", { text: procent(andel) }));
}

/** Den lilla linjen: elevens andel prov för prov (äldst till vänster). */
export function utvecklingsLinje(prov, b = 180, hojd = 44) {
  const pts = linjePunkter(prov.map((p) => p.andel), b, hojd);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${b} ${hojd}`);
  svg.setAttribute("width", String(b));
  svg.setAttribute("height", String(hojd));
  svg.setAttribute("class", "provl-st-linje");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Utveckling: ${prov.filter((p) => p.andel != null).map((p) => procent(p.andel)).join(", ") || "inga rättade prov"}`);
  const ns = (tag, attrs) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svg.append(e);
    return e;
  };
  ns("line", { x1: 0, x2: b, y1: hojd / 2, y2: hojd / 2, class: "provl-st-linje-mitt" });
  if (pts.length > 1) ns("polyline", { points: pts.map((p) => `${p.x},${p.y}`).join(" "), class: "provl-st-linje-v" });
  const medAndel = prov.filter((p) => p.andel != null);
  pts.forEach((p, i) => ns("circle", { cx: p.x, cy: p.y, r: 3.5, class: `provl-st-linje-p provl-st-${medAndel[i].farg}` }));
  return svg;
}

/**
 * @param {object} ctx
 * @param {HTMLElement} pane
 * @param {{ classId: string, students: object[], hamta?: (classId: string) => Promise<object[]> }} o
 */
export async function renderClassProv(ctx, pane, { classId, students = [], hamta = hamtaKlassensRattningar, hamtaTillfallen = hamtaKlassensTillfallen }) {
  await laddaCss("prov-statistik.css");
  // Tillfällets gränser (#796) – saknas de (fel/ingen åtkomst) gäller rättningarnas kopia.
  const [rattningar, klassTillfallen] = await Promise.all([hamta(classId), Promise.resolve().then(() => hamtaTillfallen(classId)).catch(() => [])]);
  const lista = medTillfallensGranser(rattningar, klassTillfallen);
  const { tillfallen, perElev } = historik(lista);
  const namn = new Map(students.map((s) => [s.id, s.namn || s.username || s.id]));
  const go = (hash) => (ctx?.go ? ctx.go(hash) : (window.location.hash = hash));

  if (!tillfallen.length) {
    pane.replaceChildren(h("div", { class: "provl-st provl-st-klass" },
      h("p", { class: "hint", text: "Klassen har inga rättade prov än. Kör ett prov under Prov → Mina prov, rätta det, så syns resultatet här." })));
    return;
  }

  const tabell = h("table", { class: "provl-st-lista" },
    h("thead", {}, h("tr", {}, ["Datum", "Prov", "Klassens snitt", "Fördelning", ""].map((t) => h("th", { scope: "col", text: t })))),
    h("tbody", {}, tillfallen.map((tf) => h("tr", {},
      h("td", { text: datumText(tf.datum) }),
      h("th", { scope: "row", text: tf.provNamn }),
      h("td", {}, bricka(tf.snitt, tf.farg)),
      h("td", { class: "provl-st-ford" }, fordelningEl(tf.fordelning)),
      h("td", {}, h("a", { class: "btn ghost small", href: resultatHash(tf.t), text: "Resultat", on: { click: (e) => { e.preventDefault(); go(resultatHash(tf.t)); } } }))))));

  // Eleverna som skrivit något prov först (A–Ö), sedan resten av klassen.
  const elever = [...new Set([...students.map((s) => s.id), ...perElev.keys()])]
    .map((id) => ({ id, namn: namn.get(id) || "Okänd elev", n: perElev.get(id)?.length || 0 }))
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
  const val = h("select", { class: "select provl-st-elevval", "aria-label": "Välj elev" },
    h("option", { value: "", text: "Välj en elev…" }),
    elever.map((e) => h("option", { value: e.id, text: `${e.namn} (${e.n} prov)` })));
  const elevHost = h("div", { class: "provl-st-elevhist" });
  val.addEventListener("change", () => ritaElev(val.value));

  function ritaElev(uid) {
    if (!uid) return elevHost.replaceChildren();
    const prov = perElev.get(uid) || [];
    if (!prov.length) return elevHost.replaceChildren(h("p", { class: "hint", text: "Eleven har inte skrivit något prov än." }));
    elevHost.replaceChildren(
      h("div", { class: "provl-st-linje-rad" }, utvecklingsLinje(prov),
        h("span", { class: "hint", text: "Äldst till vänster. Mittlinjen = 50 %." })),
      h("table", { class: "provl-st-lista" },
        h("thead", {}, h("tr", {}, ["Datum", "Prov", "Resultat", "Nivå"].map((t) => h("th", { scope: "col", text: t })))),
        h("tbody", {}, prov.slice().reverse().map((p) => h("tr", {},
          h("td", { text: datumText(p.datum) }),
          h("th", { scope: "row", text: p.provNamn }),
          h("td", {}, bricka(p.andel, p.farg), p.aterlamnad ? null : h("span", { class: "hint", text: " inte tillbakalämnat" })),
          h("td", { text: p.nivaNamn || "–" }))))));
  }

  pane.replaceChildren(h("div", { class: "provl-st provl-st-klass" },
    h("section", {}, h("h3", { class: "provl-st-rubrik", text: "Klassens provtillfällen" }),
      h("div", { class: "provl-st-scroll" }, tabell)),
    h("section", {}, h("h3", { class: "provl-st-rubrik", text: "En elev över tid" }), val, elevHost),
    h("p", { class: "hint", text: `Färgen räknas på de bedömda frågorna med varje provs egna färggränser (standard grön från ${granserFor().gron} %, gul från ${granserFor().gul} %, annars röd). Nivån är lärarens bedömning och visas bredvid.` })));
}
