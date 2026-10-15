// ============================================================================
// Bråkresan – lärarens individvy (src/brakresan/larare/elev.js) · K #716
// ----------------------------------------------------------------------------
// Modal från klassvyn/matrisen. Spec §12 "Individvy" + "Exakta definitioner":
//   • nyckeltal: stjärnor, bemästrade, avslutade/avbrutna/aktiva omgångar var
//     för sig, rätt/fel på första inlämning, träffsäkerhet (även ej avslutade
//     omgångar – står i etiketten), stöd före svar, stöd efter fel, senaste aktivitet
//   • förslag som tydligt bygger på resultat (forslagElev) – inga diagnoser
//   • progression över tid: stjärnkurvan ur stjärnhändelserna + omgångarna i perioden
//   • alla 50 utmaningar: stjärnor, kategori, omgångar, senaste/bästa, träffsäkerhet;
//     en utmaning öppnas → dess omgångar → en omgång öppnas (omgang-vy.js)
//   • rekommendera till eleven (rek-vy.js)
// Här (och bara här) läses omgångar och stjärnhändelser – för EN elev (#231).
// Samma modal-skal (.cx-modal, teacher-dark) som övriga lärarvyer.
// ============================================================================

import { avatarEmoji } from "../../avatars.js";
import { el, icon } from "../../teacher-shared.js";
import { SECTIONS } from "../schema/katalog.js";
import { CHALLENGE_COUNT, MAX_TOTAL_STARS } from "../schema/regler.js";
import { KATEGORI_TEXT, elevRad, elevUtmaningar, forslagElev, omgangRad, stjarnkurva } from "./statistik.js";
import { DASH, datumText, esc, laddaLarareCss, namnPa, pctHtml, senastText, stjarnHtml } from "./vy-delat.js";

const stat = (num, lbl, title = "") =>
  `<div class="cx-stat"${title ? ` title="${esc(title)}"` : ""}><div class="cx-stat-num">${num}</div><div class="cx-stat-lbl">${lbl}</div></div>`;

function nyckeltalHtml(r) {
  if (r.saknas) return `<p class="msg warn">Elevens Bråkresa kunde inte läsas.</p>`;
  const fel = r.firstTotal - r.firstCorrect;
  return `<div class="cx-stat-grid lrt-stat-grid brl-stat-grid">
    ${stat(`${r.stars}<span class="cx-stat-of">/${MAX_TOTAL_STARS}</span>`, "stjärnor")}
    ${stat(`${r.mastered}<span class="cx-stat-of">/${CHALLENGE_COUNT}</span>`, "bemästrade")}
    ${stat(r.roundsCompleted, "avslutade omgångar")}
    ${stat(r.roundsAborted, "avbrutna omgångar")}
    ${stat(r.activeRounds, "aktiva omgångar")}
    ${stat(r.firstTotal ? `${r.firstCorrect} / ${fel}` : DASH, "rätt / fel på första inlämning")}
    ${stat(pctHtml(r.accuracy), "träffsäkerhet, alla bedömda första svar", "Även besvarade uppgifter i omgångar som inte avslutats")}
    ${stat(pctHtml(r.helpBeforePct), `stöd före svar${r.firstTotal ? ` (${r.helpBefore} av ${r.firstTotal})` : ""}`)}
    ${stat(r.helpAfter, "uppgifter med stöd efter fel")}
    ${stat(esc(senastText(r.lastActivity)), "senaste aktivitet")}
  </div>`;
}

function forslagHtml(f) {
  if (!f.ova.length && !f.bra.length) {
    return `<p class="brl-svag">För lite underlag för förslag än (minst 6 bedömda svar inom ett moment).</p>`;
  }
  return `${f.ova.length ? `<h4 class="brl-h4">Kan behöva mer träning</h4><ul class="brl-forslag">${f.ova.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul>` : ""}
    ${f.bra.length ? `<h4 class="brl-h4">Går bra</h4><ul class="brl-forslag brl-forslag--bra">${f.bra.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul>` : ""}
    <p class="brl-svag">Förslagen bygger bara på siffrorna ovan. Du tolkar dem – de är inga diagnoser eller betyg.</p>`;
}

/** Stjärnkurvan som liten SVG (x = tid, y = stjärnor totalt). */
export function kurvaHtml(punkter) {
  if (!punkter.length) return `<p class="brl-svag">Inga stjärnor än.</p>`;
  const W = 520;
  const H = 140;
  const P = 28;
  const t0 = punkter[0].t;
  const t1 = Math.max(punkter[punkter.length - 1].t, t0 + 86_400_000);
  const maxY = Math.max(10, punkter[punkter.length - 1].total);
  const x = (t) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P);
  const y = (v) => H - P + 6 - (v / maxY) * (H - 2 * P);
  const steg = punkter.map((p, i) => `${i ? `H${x(p.t).toFixed(1)}` : `M${x(p.t).toFixed(1)},${y(0).toFixed(1)}`}V${y(p.total).toFixed(1)}`).join("");
  return `<figure class="brl-kurva"><svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${esc(`Stjärnor över tid: ${punkter.length} stjärnor från ${datumText(t0)} till ${datumText(punkter[punkter.length - 1].t)}`)}">
    <line class="brl-kurva-axel" x1="${P}" y1="${y(0)}" x2="${W - P}" y2="${y(0)}"/>
    <text class="brl-kurva-txt" x="${P}" y="${H - 4}">${esc(datumText(t0))}</text>
    <text class="brl-kurva-txt" x="${W - P}" y="${H - 4}" text-anchor="end">${esc(datumText(t1))}</text>
    <text class="brl-kurva-txt" x="4" y="${y(maxY) + 4}">${maxY}</text>
    <path class="brl-kurva-linje" d="${steg}"/>
  </svg><figcaption class="brl-svag">${punkter.length} stjärnor. Senaste: ${esc(datumText(punkter[punkter.length - 1].t))}.</figcaption></figure>`;
}

export function omgangTabellHtml(rader, { visaUtmaning = true } = {}) {
  if (!rader.length) return `<p class="brl-svag">Inga omgångar.</p>`;
  return `<div class="table-scroll"><table class="tbl lrt-tbl brl-omg">
    <thead><tr><th scope="col">Datum</th>${visaUtmaning ? `<th scope="col">Utmaning</th>` : ""}<th scope="col">Status</th>
      <th scope="col" class="lrt-num">Resultat</th><th scope="col" class="lrt-num">Stöd före svar</th><th scope="col" class="lrt-num">Bearbetning</th><th scope="col">Belöning</th></tr></thead>
    <tbody>${rader.map((o) => `<tr class="brl-omg-rad" tabindex="0" role="button" data-round="${esc(o.roundId)}" title="Öppna omgången">
      <td>${esc(datumText(o.startedAt, { tid: true }))}</td>${visaUtmaning ? `<td>${esc(o.challengeId || "")}</td>` : ""}
      <td>${esc(o.statusText)}</td><td class="lrt-num">${esc(o.resultat)}</td>
      <td class="lrt-num">${o.stodFore} av ${o.besvarade}</td><td class="lrt-num">${o.bearbetning ? `${o.bearbetning} försök` : "–"}</td>
      <td>${esc(o.beloning || "–")}</td></tr>`).join("")}</tbody></table></div>`;
}

const KATEGORIER = ["alla", "bemastrad", "stjarnor", "forsokt-utan-stjarna", "inte-forsokt"];

function utmRadHtml(u) {
  return `<tr class="brl-u-rad${u.kategori === "inte-forsokt" ? " lrt-not-started" : ""}" data-u="${u.id}" tabindex="0" role="button"
      aria-expanded="false" title="Visa omgångarna i ${esc(u.name)}">
    <th scope="row"><b>${u.id}</b> ${esc(u.name)}</th>
    <td>${stjarnHtml(u.stars)}</td>
    <td>${esc(u.active ? u.status.label : KATEGORI_TEXT[u.kategori])}</td>
    <td class="lrt-num">${u.roundsCompleted}${u.roundsAborted ? ` <span class="brl-svag">(+${u.roundsAborted} avbr.)</span>` : ""}</td>
    <td class="lrt-num">${u.last == null ? DASH : `${u.last}/10`}</td>
    <td class="lrt-num">${u.best == null ? DASH : `${u.best}/10`}</td>
    <td class="lrt-num" title="${u.firstTotal ? `${u.firstCorrect} av ${u.firstTotal}` : ""}">${pctHtml(u.accuracy)}</td>
  </tr>`;
}

function utmTabellHtml(lista, kat) {
  const synliga = lista.filter((u) => kat === "alla" || u.kategori === kat);
  return SECTIONS.map((s) => {
    const rader = synliga.filter((u) => u.section === s.id);
    if (!rader.length) return "";
    return `<tbody><tr class="brl-u-grupp"><th colspan="7" scope="colgroup">${esc(s.name)}</th></tr>${rader.map(utmRadHtml).join("")}</tbody>`;
  }).join("") || `<tbody><tr><td colspan="7" class="brl-svag">Inga utmaningar i urvalet.</td></tr></tbody>`;
}

/**
 * @param {object} student
 * @param {{ state: object|null, api: object, fokus?: string, cls?: object }} o
 */
export async function openBrakresanElev(student, { state, api, fokus = null, cls = null }) {
  await laddaLarareCss();
  const namn = namnPa(student);
  const rad = elevRad(student, state);
  const utm = elevUtmaningar(state);
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lrt-modal brl-modal" role="dialog" aria-modal="true"
      aria-label="Bråkresan – ${esc(namn)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head"><span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div><h2 class="cx-modal-name">${esc(namn)}</h2><p class="cx-modal-sub">${icon("brak", 14)} Bråkresan</p></div></div>
      <div class="cx-modal-body">
        ${nyckeltalHtml(rad)}
        <div class="cx-detail-sec"><h3>Förslag</h3>${forslagHtml(forslagElev(state))}</div>
        <div class="cx-detail-sec"><h3>Progression över tid</h3><div class="brl-kurva-host"><div class="spinner">Laddar…</div></div></div>
        <div class="cx-detail-sec"><h3>Omgångar</h3>
          <div class="brl-rad"><label for="brl-omg-period">Period</label>
            <select id="brl-omg-period" class="brl-omg-period"><option value="0">Senaste 20</option><option value="7">Senaste 7 dagarna</option>
              <option value="30">Senaste 30 dagarna</option><option value="90">Senaste 90 dagarna</option></select></div>
          <div class="brl-omg-host"></div></div>
        <div class="cx-detail-sec"><h3>Utmaningar</h3>
          <div class="brl-rad"><label for="brl-kat">Visa</label><select id="brl-kat" class="brl-kat">${KATEGORIER.map((k) =>
            `<option value="${k}">${k === "alla" ? "Alla 50" : esc(KATEGORI_TEXT[k])}</option>`).join("")}</select></div>
          <div class="table-scroll"><table class="tbl lrt-tbl brl-utm"><thead><tr><th scope="col">Utmaning</th><th scope="col">Stjärnor</th>
            <th scope="col">Status</th><th scope="col" class="lrt-num">Omgångar</th><th scope="col" class="lrt-num">Senaste</th>
            <th scope="col" class="lrt-num">Bästa</th><th scope="col" class="lrt-num">Första svar rätt</th></tr></thead></table></div></div>
        <div class="cx-detail-sec"><h3>Rekommendera</h3><div class="brl-rek-host"><div class="spinner">Laddar…</div></div></div>
      </div>
    </div>
  </div>`);
  const stang = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", stang);
  };
  const onKey = (e) => {
    if (e.key !== "Escape") return;
    const omg = document.querySelector(".brl-omgang-overlay");
    if (omg) return; // omgångsvyn ovanpå stänger sig själv först
    stang();
  };
  overlay.querySelector(".cx-modal-close").addEventListener("click", stang);
  overlay.addEventListener("click", (e) => e.target === overlay && stang());
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", stang);
  document.body.appendChild(overlay);
  overlay.querySelector(".cx-modal-close").focus();

  const oppnaOmgang = async (round, tillbaka) => {
    const { visaOmgang } = await import("./omgang-vy.js");
    visaOmgang(round, { namn, tillbaka });
  };
  const kopplaOmgangar = (host, rounds) => {
    const hitta = (tr) => rounds().find((r) => r.roundId === tr?.dataset.round);
    host.addEventListener("click", (e) => {
      const tr = e.target.closest(".brl-omg-rad");
      if (tr && hitta(tr)) oppnaOmgang(hitta(tr), tr);
    });
    host.addEventListener("keydown", (e) => {
      const tr = e.target.closest(".brl-omg-rad");
      if (!tr || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      if (hitta(tr)) oppnaOmgang(hitta(tr), tr);
    });
  };

  // Progression: stjärnhändelserna (små dokument, ≤ 150).
  const kurva = overlay.querySelector(".brl-kurva-host");
  api.listStarEvents(student.id).then((ev) => (kurva.innerHTML = kurvaHtml(stjarnkurva(ev))),
    (err) => (kurva.innerHTML = `<p class="msg error">Kunde inte läsa stjärnorna: ${esc(err.message)}</p>`));

  // Omgångar i perioden.
  const omgHost = overlay.querySelector(".brl-omg-host");
  let senaste = [];
  const laddaOmg = async (dagar) => {
    omgHost.innerHTML = `<div class="spinner">Laddar omgångar…</div>`;
    try {
      const rounds = await api.listRounds(student.id, dagar ? { fran: Date.now() - dagar * 86_400_000, limit: 60 } : { limit: 20 });
      omgHost.innerHTML = omgangTabellHtml(rounds.map(omgangRad));
      senaste = rounds;
    } catch (err) {
      omgHost.innerHTML = `<p class="msg error">Kunde inte läsa omgångarna: ${esc(err.message)}</p>`;
    }
  };
  kopplaOmgangar(omgHost, () => senaste);
  overlay.querySelector(".brl-omg-period").addEventListener("change", (e) => laddaOmg(Number(e.target.value)));
  if (rad.started) laddaOmg(0);
  else omgHost.innerHTML = `<p class="brl-svag">Eleven har inte tränat i Bråkresan än.</p>`;

  // Alla 50 – en utmaning fälls ut med sina omgångar.
  const tabell = overlay.querySelector(".brl-utm");
  const katSel = overlay.querySelector(".brl-kat");
  const ritaUtm = () => {
    tabell.querySelectorAll("tbody").forEach((t) => t.remove());
    tabell.insertAdjacentHTML("beforeend", utmTabellHtml(utm, katSel.value));
  };
  katSel.addEventListener("change", ritaUtm);
  const fallUt = async (tr) => {
    const nasta = tr.nextElementSibling;
    if (nasta?.classList.contains("brl-u-detalj")) {
      nasta.remove();
      tr.setAttribute("aria-expanded", "false");
      return;
    }
    tr.setAttribute("aria-expanded", "true");
    const detalj = el(`<tr class="brl-u-detalj"><td colspan="7"><div class="spinner">Laddar omgångar…</div></td></tr>`);
    tr.after(detalj);
    const cell = detalj.firstElementChild;
    try {
      const rounds = await api.listRounds(student.id, { challengeId: tr.dataset.u, limit: 30 });
      cell.innerHTML = omgangTabellHtml(rounds.map(omgangRad), { visaUtmaning: false });
      kopplaOmgangar(cell, () => rounds);
    } catch (err) {
      cell.innerHTML = `<p class="msg error">Kunde inte läsa omgångarna: ${esc(err.message)}</p>`;
    }
  };
  tabell.addEventListener("click", (e) => {
    const tr = e.target.closest(".brl-u-rad");
    if (tr) fallUt(tr);
  });
  tabell.addEventListener("keydown", (e) => {
    const tr = e.target.closest(".brl-u-rad");
    if (!tr || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    fallUt(tr);
  });
  ritaUtm();
  if (fokus) {
    const tr = tabell.querySelector(`.brl-u-rad[data-u="${fokus}"]`);
    if (tr) {
      tr.scrollIntoView({ block: "center" });
      tr.focus({ preventScroll: true });
      fallUt(tr);
    }
  }

  const { ritaRekommendationer } = await import("./rek-vy.js");
  ritaRekommendationer(overlay.querySelector(".brl-rek-host"), { cls, students: [student], api, student })
    .catch((err) => (overlay.querySelector(".brl-rek-host").innerHTML = `<p class="msg error">${esc(err.message)}</p>`));
}
