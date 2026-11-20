// ============================================================================
// Matchdagen (#869): lärarens statistik – underfliken "Matchdagen" i klassens
// Hur går det? (STATS_TABS i teacher-class.js, spec §6.4). Visas bara när någon
// elev i klassen har Matchdagen (classes/{id}.elevModuler).
//   • tabellen: en rad per elev med åtkomst – speltid de senaste 7 dagarna och
//     totalt, matcher, andel rätt totalt och per källa, division och säsong,
//     senast spelat. Kvoten (§13): EN läsning per elev (matchdagen/{uid}).
//   • klick på en elev: de senaste matcherna (läses FÖRST då, matcher/ – högst 20),
//     andelen rätt per vecka som en liten linje (ur karriärens dagar) och lagnamnet
//     med Återställ lagnamn (md-lagnamn.js).
// Laddas med import() – aldrig i bootgrafen (#271).
// ============================================================================

import { el, esc } from "../../teacher-shared.js";
import { DIVISIONER } from "../delat/md-config.js";
import { sekunderSenaste, veckoRatt } from "../delat/md-sasong.js";
import { harMatchdagen } from "../md-inst.js";
import { kopplaAterstall } from "./md-lagnamn.js";

const pct = (r, f) => (f ? Math.round((100 * r) / f) : null);
const pctText = (r, f) => (f ? `${pct(r, f)} %` : "–");
const minText = (sek) => {
  const m = Math.round((Number(sek) || 0) / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const kallNamn = (k, v = {}) => v.namn || (k.startsWith("tabell:") ? `${k.slice(7)}:ans tabell` : k.split("/").pop());
const datumText = (t) => {
  const d = t?.toDate ? t.toDate() : typeof t === "number" ? new Date(t) : null;
  return d ? d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) : "–";
};

/** Andel rätt per vecka som en liten linje (8 veckor, äldst till vänster). */
export function sparkline(varden, { b = 160, h = 40 } = {}) {
  const pts = varden.map((v, i) => (v == null ? null : [6 + (i * (b - 12)) / Math.max(1, varden.length - 1), h - 6 - v * (h - 12)]));
  const delar = [];
  let del = [];
  for (const p of pts) { if (p) del.push(p); else if (del.length) { linje(delar, del); del = []; } }
  if (del.length) linje(delar, del);
  const prickar = pts.filter(Boolean).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"/>`).join("");
  const sista = varden.filter((v) => v != null).pop();
  const text = sista == null ? "Inga frågor de senaste veckorna" : `Andel rätt per vecka, senaste veckan ${Math.round(sista * 100)} %`;
  return `<svg class="mdl-linje" viewBox="0 0 ${b} ${h}" width="${b}" height="${h}" role="img" aria-label="${text}">
    <line x1="0" x2="${b}" y1="${h / 2}" y2="${h / 2}" class="mdl-mitt"/>${delar.join("")}<g class="mdl-prick">${prickar}</g></svg>`;
}
function linje(ut, del) {
  ut.push(`<polyline points="${del.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}"/>`);
}

/** En rad per elev ur karriären (null = har inte startat). */
export function elevRad(elev, K, nu = Date.now()) {
  const s = K?.summa || {};
  const kallor = Object.entries(s.perKalla || {}).sort((a, b) => b[1].fragor - a[1].fragor);
  return {
    id: elev.id, namn: elev.namn || elev.username || elev.id, startad: !!K,
    sek7: K ? sekunderSenaste(K.dagar, nu, 7) : 0, minTotalt: Number(s.spelminuter) || 0,
    matcher: s.matcher || 0, ratt: s.ratt || 0, fragor: s.fragor || 0, kallor,
    div: K ? DIVISIONER[K.div] || "" : "", sasong: K?.sasong || 0, senast: K?.senast || null, lag: K?.klubb?.namn || "",
  };
}

export async function renderClassMatchdagen(ctx, host, { cls, students }) {
  const elever = (students || []).filter((s) => harMatchdagen(cls, s.id))
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));
  if (!elever.length) {
    host.replaceChildren(el(`<p class="hint">Ingen elev i klassen har Matchdagen. Slå på den under Elever → Anpassningar per elev.</p>`));
    return;
  }
  const data = await import("../md-data.js");
  const karriarer = await data.lasKarriarer(elever.map((e) => e.id));
  const rader = elever.map((e) => elevRad(e, karriarer.get(e.id)));
  const view = el(`<div class="mdl">
    <p class="hint">Bara elever som har Matchdagen syns här. Klicka på en elev för matcherna, utvecklingen och lagnamnet.</p>
    <div class="table-scroll"><table class="tbl lrt-tbl mdl-tbl">
      <thead><tr><th>Elev</th><th class="lrt-num">Speltid 7 dagar</th><th class="lrt-num">Totalt</th><th class="lrt-num">Matcher</th>
        <th class="lrt-num">Rätt</th><th>Per källa</th><th>Division</th><th>Senast</th></tr></thead>
      <tbody>${rader.map((r) => `<tr class="mdl-rad" data-elev="${esc(r.id)}" tabindex="0" role="button" aria-expanded="false">
        <td><b>${esc(r.namn)}</b>${r.lag ? `<br><small class="hint">${esc(r.lag)}</small>` : ""}</td>
        ${r.startad ? `<td class="lrt-num">${minText(r.sek7)}</td><td class="lrt-num">${minText(r.minTotalt * 60)}</td>
        <td class="lrt-num">${r.matcher}</td><td class="lrt-num">${pctText(r.ratt, r.fragor)}</td>
        <td class="mdl-kallor">${r.kallor.slice(0, 4).map(([k, v]) => `<span class="mdl-kalla">${esc(kallNamn(k, v))} ${pctText(v.ratt, v.fragor)}</span>`).join("") || "–"}</td>
        <td>${esc(r.div)} · säsong ${r.sasong}</td><td>${datumText(r.senast)}</td>`
          : `<td colspan="7" class="hint">Har inte startat sitt lag än</td>`}
      </tr>`).join("")}</tbody></table></div>
    <div class="mdl-detalj" aria-live="polite"></div>
  </div>`);
  host.replaceChildren(view);
  const detalj = view.querySelector(".mdl-detalj");
  const oppna = (tr) => {
    view.querySelectorAll(".mdl-rad").forEach((x) => x.setAttribute("aria-expanded", String(x === tr)));
    const elev = elever.find((e) => e.id === tr.dataset.elev);
    visaElev(detalj, elev, karriarer.get(elev.id), data, (namn) => {
      const k = karriarer.get(elev.id);
      if (k) k.klubb.namn = namn;
      const small = tr.querySelector("small");
      if (small) small.textContent = namn;
    });
  };
  view.querySelectorAll(".mdl-rad").forEach((tr) => {
    tr.addEventListener("click", () => oppna(tr));
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oppna(tr); } });
  });
}

async function visaElev(host, elev, K, data, efterNamn) {
  const namn = elev.namn || elev.username || elev.id;
  if (!K) {
    host.replaceChildren(el(`<div class="mdl-elev"><h4 class="subhead">${esc(namn)}</h4><p class="hint">${esc(namn)} har inte startat sitt lag än.</p></div>`));
    return;
  }
  const veckor = veckoRatt(K.dagar, Date.now(), 8);
  const box = el(`<div class="mdl-elev">
    <h4 class="subhead">${esc(namn)}</h4>
    <div class="mdl-topp">
      <div><span class="hint">Lagnamn</span><br><b class="mdl-lagnamn">${esc(K.klubb?.namn || "")}</b>
        <div class="mdl-rad-knapp"><button type="button" class="btn ghost small" data-lagnamn disabled>Återställ lagnamn</button>
        <span class="mdl-status" role="status"></span></div></div>
      <div><span class="hint">Andel rätt per vecka (8 veckor)</span><br>${sparkline(veckor)}</div>
    </div>
    <div class="mdl-matcher"><div class="spinner">Laddar matcherna…</div></div>
  </div>`);
  host.replaceChildren(box);
  kopplaAterstall(box.querySelector("[data-lagnamn]"), {
    uid: elev.id, elevNamn: namn, status: box.querySelector(".mdl-status"),
    efter: (n) => { box.querySelector(".mdl-lagnamn").textContent = n; efterNamn(n); },
  });
  const yta = box.querySelector(".mdl-matcher");
  try {
    const matcher = await data.lasMatcher(elev.id, 20);
    yta.replaceChildren(el(matcher.length ? `<div class="table-scroll"><table class="tbl lrt-tbl">
      <thead><tr><th>Datum</th><th>Motståndare</th><th class="lrt-num">Resultat</th><th class="lrt-num">Rätt</th><th class="lrt-num">Speltid</th></tr></thead>
      <tbody>${matcher.map((m) => `<tr><td>${datumText(m.datum)}</td><td>${esc(m.mot)}</td><td class="lrt-num">${m.oss}–${m.dem}</td>
        <td class="lrt-num">${m.ratt}/${m.fragor} (${pctText(m.ratt, m.fragor)})</td><td class="lrt-num">${minText(m.sekunder)}</td></tr>`).join("")}</tbody>
    </table></div>` : `<p class="hint">Inga matcher än.</p>`));
  } catch (err) {
    yta.replaceChildren(el(`<div class="msg error">Matcherna kunde inte läsas: ${esc(err.message)}</div>`));
  }
}
