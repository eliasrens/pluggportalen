// ============================================================================
// Bråkresan – lärarens klassvy (src/brakresan/larare/klass.js) · K #716
// ----------------------------------------------------------------------------
// Fliken "Bråkresan" i klasskortets Statistik-panel (teacher-class.js
// STATS_TABS, lazy). Spec §12. Tre delar:
//   Översikt          elevlista (sorterbar, periodfilter), klassens summor med
//                     antal elever, momentöversikt per kunskapstagg, utmaningar
//                     som behöver träning / går bra – alltid med underlag
//   Matris            elever × 50 utmaningar (matris.js)
//   Rekommendationer  till klassen eller en elev (rek-vy.js)
// + länk till testläget (#/larare/brakresan). Klick på en elev eller en
// matriscell öppnar individvyn (elev.js).
//
// KVOT (#231): ETT state-dokument per elev, en gång (api.loadClass). Omgångar,
// stjärnhändelser och elevrekommendationer läses först när läraren öppnar dem.
// Bara klassens elever som läraren når (firestore.rules hasStudent) – en elev
// som inte kan läsas visas med "–".
// ============================================================================

import { avatarEmoji } from "../../avatars.js";
import { el, emptyState, icon } from "../../teacher-shared.js";
import { CHALLENGES } from "../schema/katalog.js";
import { MAX_TOTAL_STARS, CHALLENGE_COUNT } from "../schema/regler.js";
import { aktivSedan, elevRad, klassSumma, momentOversikt, svaraOchLatta, utmaningsAggregat } from "./statistik.js";
import { DASH, esc, indikatorHtml, laddaLarareCss, namnPa, pctHtml, senastText, underlagText } from "./vy-delat.js";

const defaultApi = async () => (await import("./data-larare.js")).API;

const KOLUMNER = [
  { key: "namn", label: "Elev" },
  { key: "stars", label: "Stjärnor", num: true, title: `av ${MAX_TOTAL_STARS}` },
  { key: "mastered", label: "Bemästrade", num: true, title: `av ${CHALLENGE_COUNT}` },
  { key: "roundsCompleted", label: "Avslutade omgångar", num: true },
  { key: "accuracy", label: "Första svar rätt", num: true, title: "Träffsäkerhet: rätta första svar av alla bedömda första svar, även i ej avslutade omgångar" },
  { key: "helpBeforePct", label: "Stöd före svar", num: true, title: "Andel bedömda uppgifter där eleven öppnade hjälpen före första kontroll" },
  { key: "lastActivity", label: "Senaste aktivitet", num: true },
];
const PERIODER = [
  { dagar: 0, text: "Alla elever" },
  { dagar: 7, text: "Aktiva senaste 7 dagarna" },
  { dagar: 30, text: "Aktiva senaste 30 dagarna" },
];
const DELAR = [
  { key: "oversikt", label: "Översikt", ikon: "chart" },
  { key: "matris", label: "Matris", ikon: "grad" },
  { key: "rek", label: "Rekommendationer", ikon: "pin" },
];

let senasteDel = "oversikt";
let sortering = { key: "namn", dir: "asc" };
let period = 0;

/** Sortera elevraderna; rader utan värde (–) hamnar alltid sist. */
export function sorteraRader(rader, { key, dir }) {
  const f = dir === "asc" ? 1 : -1;
  return rader.slice().sort((a, b) => {
    if (key === "namn") return f * a.namn.localeCompare(b.namn, "sv");
    const x = a.saknas ? null : a[key];
    const y = b.saknas ? null : b[key];
    if (x == null && y == null) return a.namn.localeCompare(b.namn, "sv");
    if (x == null) return 1;
    if (y == null) return -1;
    return f * (x - y) || a.namn.localeCompare(b.namn, "sv");
  });
}

function radHtml(r, student) {
  const vanta = r.saknas ? `<td class="lrt-num" colspan="6">${DASH} <span class="brl-svag">kunde inte läsas</span></td>` : `
    <td class="lrt-num">${r.started ? `<b>${r.stars}</b><span class="lrt-of">/${MAX_TOTAL_STARS}</span>` : DASH}</td>
    <td class="lrt-num">${r.started ? `${r.mastered}<span class="lrt-of">/${CHALLENGE_COUNT}</span>` : DASH}</td>
    <td class="lrt-num">${r.started ? r.roundsCompleted : DASH}</td>
    <td class="lrt-num" title="${r.firstTotal ? `${r.firstCorrect} av ${r.firstTotal} första svar rätt` : ""}">${pctHtml(r.accuracy)}</td>
    <td class="lrt-num" title="${r.firstTotal ? `${r.helpBefore} av ${r.firstTotal} uppgifter` : ""}">${pctHtml(r.helpBeforePct)}</td>
    <td class="lrt-num">${esc(senastText(r.lastActivity))}</td>`;
  return `<tr class="lrt-row${r.started ? "" : " lrt-not-started"}" data-student="${esc(r.studentId)}" tabindex="0" role="button"
      title="Visa ${esc(r.namn)}s resultat i Bråkresan">
    <th class="lrt-name" scope="row"><span class="cx-avatar">${avatarEmoji(student?.avatarId)}</span>
      <span class="lrt-name-txt">${esc(r.namn)}</span>${r.started || r.saknas ? "" : `<span class="lrt-badge">inte tränat</span>`}</th>
    ${vanta}
  </tr>`;
}

function huvudHtml() {
  return `<tr>${KOLUMNER.map((c) => {
    const aktiv = sortering.key === c.key;
    const aria = aktiv ? (sortering.dir === "asc" ? "ascending" : "descending") : "none";
    const pil = aktiv ? (sortering.dir === "asc" ? "▲" : "▼") : "↕";
    return `<th scope="col" class="lrt-th${c.num ? " lrt-num" : ""}${aktiv ? " active" : ""}" aria-sort="${aria}"${c.title ? ` title="${esc(c.title)}"` : ""}>
      <button type="button" class="lrt-sort" data-key="${c.key}"><span>${esc(c.label)}</span><span class="lrt-arrow" aria-hidden="true">${pil}</span></button></th>`;
  }).join("")}</tr>`;
}

function summaHtml(s) {
  if (!s.elever) return `<p class="brl-svag">Inga elever kunde läsas.</p>`;
  return `<div class="brl-summa" role="list">
    <div class="brl-summa-kort" role="listitem"><b>${s.stars}</b> stjärnor<span>av ${s.maxStars} möjliga</span></div>
    <div class="brl-summa-kort" role="listitem"><b>${s.mastered}</b> bemästrade<span>utmaningar totalt</span></div>
    <div class="brl-summa-kort" role="listitem"><b>${s.elever}</b> elever ingår<span>${s.started} har tränat${s.saknas ? ` · ${s.saknas} kunde inte läsas` : ""}</span></div>
    <div class="brl-summa-kort" role="listitem"><b>${s.roundsCompleted}</b> avslutade omgångar<span>hela klassen</span></div>
    <div class="brl-summa-kort" role="listitem"><b>${s.accuracy == null ? "–" : `${s.accuracy} %`}</b> första svar rätt
      <span>${s.firstTotal ? `${s.firstCorrect} av ${s.firstTotal} bedömda svar (klassens summa)` : "inga bedömda svar än"}</span></div>
    <div class="brl-summa-kort" role="listitem"><b>${s.helpBeforePct == null ? "–" : `${s.helpBeforePct} %`}</b> stöd före svar<span>andel bedömda uppgifter</span></div>
  </div>`;
}

function momentHtml(moment) {
  return `<div class="table-scroll"><table class="tbl lrt-tbl brl-moment">
    <caption class="brl-caption">Momentöversikt – grupperad efter kunskapstaggar. En utmaning kan höra till två moment.</caption>
    <thead><tr><th scope="col">Moment</th><th scope="col">Utmaningar</th><th scope="col" class="lrt-num">Elever som tränat</th>
      <th scope="col" class="lrt-num">Bedömda svar</th><th scope="col" class="lrt-num">Första svar rätt</th><th scope="col" class="lrt-num">Stöd före svar</th></tr></thead>
    <tbody>${moment.map((m) => `<tr>
      <th scope="row">${esc(m.label)}</th>
      <td class="brl-ids">${m.challengeIds.join(" ")}</td>
      <td class="lrt-num">${m.students}</td>
      <td class="lrt-num">${m.answers}</td>
      <td class="lrt-num">${indikatorHtml(m)}</td>
      <td class="lrt-num">${m.inteTranat ? DASH : pctHtml(m.helpBeforePct)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function utmListaHtml(lista, tom) {
  if (!lista.length) return `<p class="brl-svag">${esc(tom)}</p>`;
  return `<ul class="brl-utm-lista">${lista.map((a) => `<li>
    <span class="brl-utm-nr">${a.id}</span> <span class="brl-utm-namn">${esc(a.meta.name)}</span>
    <span class="brl-utm-varde">${a.accuracy} % första svar rätt</span>
    <span class="brl-svag">${esc(underlagText(a))} · ${(a.roundsPerStudent).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} omgångar per elev</span>
  </li>`).join("")}</ul>`;
}

function oversiktHtml({ summa, moment, svlt }) {
  return `${summaHtml(summa)}
    <div class="brl-rad">
      <label for="brl-period">Visa</label>
      <select id="brl-period" class="brl-period">${PERIODER.map((p) => `<option value="${p.dagar}"${p.dagar === period ? " selected" : ""}>${p.text}</option>`).join("")}</select>
      <span class="brl-svag">Siffrorna gäller hela tiden; perioden väljer elever efter senaste sparade spelaktivitet.</span>
    </div>
    <div class="table-scroll"><table class="tbl lrt-tbl brl-elever"><thead></thead><tbody></tbody></table></div>
    <h4 class="brl-h4">Moment</h4>
    ${momentHtml(moment)}
    <div class="brl-tva">
      <section><h4 class="brl-h4">Behöver mer träning</h4>
        <p class="brl-svag">Lägre än 65 % första svar rätt, minst 3 elever och 20 bedömda svar.</p>
        ${utmListaHtml(svlt.svara, "Ingen utmaning med tillräckligt underlag ligger under 65 %.")}</section>
      <section><h4 class="brl-h4">Går bra</h4>
        <p class="brl-svag">Minst 85 % första svar rätt, minst 3 elever och 20 bedömda svar.</p>
        ${utmListaHtml(svlt.latta, "Ingen utmaning med tillräckligt underlag ligger på 85 % eller mer.")}</section>
    </div>
    ${svlt.litet.length ? `<details class="brl-details"><summary>Litet underlag (${svlt.litet.length}) – visas utan slutsats</summary>
      <ul class="brl-utm-lista">${svlt.litet.map((a) => `<li><span class="brl-utm-nr">${a.id}</span> ${esc(a.meta.name)}
        <span class="brl-svag">${esc(underlagText(a))} · ${a.accuracy} %</span></li>`).join("")}</ul></details>` : ""}
    <details class="brl-details"><summary>Inte tränat (${svlt.inteTranat.length} av ${CHALLENGES.length})</summary>
      <p class="brl-chips">${svlt.inteTranat.map((a) => `<span class="brl-chip" title="${esc(a.meta.name)}">${a.id}</span>`).join("") || "–"}</p></details>`;
}

/**
 * Rita klassens Bråkresan in i `host`.
 * @param {object} ctx
 * @param {HTMLElement} host
 * @param {{ students: object[], cls?: object, studentById?: Map, api?: object }} opts
 */
export async function renderClassBrakresan(ctx, host, opts = {}) {
  const students = (Array.isArray(opts.students) ? opts.students : []).slice()
    .sort((a, b) => namnPa(a).localeCompare(namnPa(b), "sv"));
  if (!students.length) {
    host.replaceChildren(emptyState(ctx, { icon: "users", title: "Klassen har inga elever än",
      text: "Lägg till elever på klasskortet så syns deras Bråkresa här." }));
    return;
  }
  host.replaceChildren(el(`<div class="spinner">Laddar Bråkresan…</div>`));
  let api;
  let states;
  try {
    api = opts.api || (await defaultApi());
    [states] = await Promise.all([api.loadClass(students.map((s) => s.id)), laddaLarareCss()]);
  } catch (err) {
    host.replaceChildren(el(`<div class="msg error">Kunde inte ladda Bråkresan: ${esc(err.message)}</div>`));
    return;
  }
  const byId = new Map(students.map((s) => [s.id, s]));
  const stateAv = (id) => states.get(id) ?? null;
  const rader = students.map((s) => elevRad(s, stateAv(s.id)));
  const alla = students.map((s) => stateAv(s.id));
  const agg = utmaningsAggregat(alla);

  const dold = Array.isArray(opts.cls?.hiddenModules) && opts.cls.hiddenModules.includes("brakresan");
  const view = el(`<div class="lrt-teacher brl">
    <div class="lrt-intro brl-intro">
      <h3 class="subhead lrt-title">${icon("brak", 18)}<span>Bråkresan</span></h3>
      <a class="btn small ghost brl-testlank" href="#/larare/brakresan">${icon("eye", 14)} Testa utmaningarna</a>
    </div>
    ${dold ? `<p class="msg warn brl-dold">Bråkresan är dold för ${esc(opts.cls.name || "klassen")} – visa den under Synliga moduler så ser eleverna den.</p>` : ""}
    <nav class="brl-delar" role="tablist" aria-label="Bråkresan">${DELAR.map((d) =>
      `<button type="button" role="tab" class="brl-del" data-del="${d.key}">${icon(d.ikon, 14)}<span>${d.label}</span></button>`).join("")}</nav>
    ${DELAR.map((d) => `<div class="brl-panel" data-panel="${d.key}" role="tabpanel" hidden></div>`).join("")}
    <p class="brl-svag brl-fot">Statistiken visar träning, inte betyg. Stöd före svar är information – aldrig ett fel.</p>
  </div>`);

  const oppnaElev = async (id, fokus = null) => {
    const student = byId.get(id);
    if (!student) return;
    const { openBrakresanElev } = await import("./elev.js");
    openBrakresanElev(student, { state: stateAv(id), api, fokus, cls: opts.cls });
  };

  const ritaOversikt = (panel) => {
    panel.innerHTML = oversiktHtml({ summa: klassSumma(rader), moment: momentOversikt(alla), svlt: svaraOchLatta(agg) });
    const thead = panel.querySelector(".brl-elever thead");
    const tbody = panel.querySelector(".brl-elever tbody");
    const rita = () => {
      thead.innerHTML = huvudHtml();
      const synliga = sorteraRader(rader.filter((r) => aktivSedan(r, period)), sortering);
      tbody.innerHTML = synliga.map((r) => radHtml(r, byId.get(r.studentId))).join("")
        || `<tr><td colspan="${KOLUMNER.length}" class="brl-svag">Ingen elev har sparad aktivitet under perioden.</td></tr>`;
    };
    thead.addEventListener("click", (e) => {
      const b = e.target.closest(".lrt-sort");
      if (!b) return;
      const key = b.dataset.key;
      sortering = sortering.key === key ? { key, dir: sortering.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "namn" ? "asc" : "desc" };
      rita();
      thead.querySelector(`.lrt-sort[data-key="${key}"]`)?.focus();
    });
    panel.querySelector(".brl-period").addEventListener("change", (e) => {
      period = Number(e.target.value) || 0;
      rita();
    });
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr.lrt-row");
      if (tr) oppnaElev(tr.dataset.student);
    });
    tbody.addEventListener("keydown", (e) => {
      const tr = e.target.closest("tr.lrt-row");
      if (!tr || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      oppnaElev(tr.dataset.student);
    });
    rita();
  };

  const ritat = new Set();
  const visa = async (key) => {
    senasteDel = DELAR.some((d) => d.key === key) ? key : "oversikt";
    view.querySelectorAll(".brl-del").forEach((b) => {
      const pa = b.dataset.del === senasteDel;
      b.classList.toggle("active", pa);
      b.setAttribute("aria-selected", pa ? "true" : "false");
    });
    view.querySelectorAll(".brl-panel").forEach((p) => (p.hidden = p.dataset.panel !== senasteDel));
    if (ritat.has(senasteDel)) return;
    ritat.add(senasteDel);
    const panel = view.querySelector(`[data-panel="${senasteDel}"]`);
    try {
      if (senasteDel === "oversikt") ritaOversikt(panel);
      else if (senasteDel === "matris") {
        (await import("./matris.js")).ritaMatris(panel, { students, stateAv, onCell: oppnaElev });
      } else {
        panel.replaceChildren(el(`<div class="spinner">Laddar rekommendationer…</div>`));
        await (await import("./rek-vy.js")).ritaRekommendationer(panel, { cls: opts.cls, students, api });
      }
    } catch (err) {
      ritat.delete(senasteDel);
      panel.replaceChildren(el(`<div class="msg error">Kunde inte visa delen: ${esc(err.message)}</div>`));
    }
  };
  view.querySelectorAll(".brl-del").forEach((b) => b.addEventListener("click", () => visa(b.dataset.del)));
  host.replaceChildren(view);
  await visa(senasteDel);
}
