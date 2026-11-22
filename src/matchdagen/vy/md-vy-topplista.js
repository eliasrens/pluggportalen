// ============================================================================
// Matchdagen (#880): TOPPLISTA-fliken – topp 5 per årskurs i hela skolan (bästa division,
// vinster, mål). Elevens egen årskurs visas först; knapparna byter årskurs utan ny läsning
// (alla årskurser står i samma dokument, mdTopplista/skolan – servern bygger det varje timme,
// functions/md-topplista-bygg.js). Placeringspolicyn (som Guldrushen): bara topp 5 med namn;
// den egna placeringen utanför topp 5 visas aldrig – bara "Fortsätt kämpa!".
// Kvoten: EN läsning första gången fliken öppnas (S.topplista, sedan cachat i sessionen).
//
//   topplistaHtml(lista, { ak, uid, egen })   tabellen + knapparna (förhandsvisningen och testerna)
//   visaTopplista(S, el)                      fliken
// Allt ur dokumentet med esc() eller som tal.
// ============================================================================

import { akLabel, divNamn, sorteraNycklar, TOPP } from "../delat/md-topplista.js";
import { chip, esc } from "./md-vy-delat.js";

const tal = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
const KLOCKA = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" });

/** Årskurserna som har en lista, + elevens egen (även tom). */
export function arskursKnappar(lista, egen) {
  const n = new Set(Object.keys(lista?.arskurser || {}).filter((k) => /^([1-9][0-9]?|ovriga)$/.test(k)));
  if (egen) n.add(egen);
  return sorteraNycklar(n);
}

function radHtml(r, uid) {
  const vi = r.uid === uid;
  const ms = tal(r.gm) - tal(r.im);
  const stjarnor = tal(r.ls) ? ` <span class="md-topp-stjarnor" title="${tal(r.ls)} legendklubbar">${"★".repeat(Math.min(tal(r.ls), 5))}</span>` : "";
  return `<tr class="${vi ? "vi" : ""}${tal(r.plats) === 1 ? " etta" : ""}"${vi ? ' aria-current="true"' : ""}>
    <td>${tal(r.plats)}</td>
    <td><span class="md-topp-namn">${esc(r.n)}${vi ? " (du)" : ""}</span><small class="md-topp-lag">${chip(r.f, "liten")} ${esc(r.lag)}${r.k ? ` · ${esc(r.k)}` : ""}${stjarnor}</small></td>
    <td>${esc(divNamn(r.d))}</td><td>${tal(r.v)}</td>
    <td title="Målskillnad ${ms > 0 ? "+" : ""}${ms}">${tal(r.gm)}–${tal(r.im)}</td></tr>`;
}

/** Tabellen för årskursen ak, knapparna och raden om eleven själv. */
export function topplistaHtml(lista, { ak, uid, egen }) {
  const knappar = arskursKnappar(lista, egen);
  const rader = Array.isArray(lista?.arskurser?.[ak]) ? lista.arskurser[ak].slice(0, 8) : [];
  const arMed = rader.some((r) => r.uid === uid);
  const byggd = lista?.byggd ? `Uppdaterad kl. ${KLOCKA.format(lista.byggd)} – listan uppdateras varje timme.` : "Listan uppdateras varje timme.";
  return `<div class="md-panel md-topplista">
    <h2>Topplista – ${esc(akLabel(ak))}</h2>
    <p class="md-svag">De ${TOPP} bästa lagen i ${ak === "ovriga" ? "klasserna utan årskurs" : `årskurs ${esc(ak)}`} på hela skolan: högsta division, sedan flest vinster och bäst målskillnad.</p>
    ${knappar.length > 1 ? `<div class="md-ak" role="group" aria-label="Årskurs">${knappar.map((n) =>
      `<button type="button" data-ak="${esc(n)}" aria-pressed="${n === ak}">${esc(akLabel(n))}</button>`).join("")}</div>` : ""}
    ${rader.length ? `<div class="md-scroll"><table class="md-tabell md-topp-tabell">
      <thead><tr><th scope="col">#</th><th scope="col">Spelare</th><th scope="col">Division</th><th scope="col" title="Vunna matcher">Vinster</th><th scope="col" title="Gjorda–insläppta mål">Mål</th></tr></thead>
      <tbody>${rader.map((r) => radHtml(r, uid)).join("")}</tbody>
    </table></div>` : `<p class="md-svag">Ingen i ${esc(akLabel(ak).toLowerCase())} är på listan än – spela en match så kan du bli först!</p>`}
    ${ak === egen && rader.length && !arMed ? `<p class="md-slut">Du är inte på topp ${TOPP} än – fortsätt kämpa! Vinn matcher och ta dig upp i divisionerna.</p>` : ""}
    ${ak === egen && arMed ? `<p class="md-slut vinst">Du är på topp ${TOPP} i din årskurs – snyggt!</p>` : ""}
    <p class="md-svag md-topp-tid">${byggd}</p>
  </div>`;
}

export async function visaTopplista(S, el) {
  el.innerHTML = `<div class="md-panel"><p class="md-svag">Hämtar topplistan …</p></div>`;
  S.topplista ||= Promise.resolve().then(() => S.data.lasTopplista()).catch((err) => {
    S.topplista = null; // nästa gång fliken öppnas försöker den igen
    console.warn("Matchdagen: topplistan kunde inte läsas", err);
    return { fel: true };
  });
  const lista = await S.topplista;
  if (S.vy !== "topplista") return;
  if (lista?.fel) {
    el.innerHTML = `<div class="md-panel"><h2>Topplista</h2><p class="md-svag">Topplistan kunde inte hämtas just nu. Prova igen om en stund.</p></div>`;
    return;
  }
  if (!lista) {
    el.innerHTML = `<div class="md-panel"><h2>Topplista</h2><p class="md-svag">Topplistan byggs en gång i timmen – titta in igen om en stund.</p></div>`;
    return;
  }
  const egen = S.arskurs;
  const forsta = arskursKnappar(lista, egen)[0];
  S.topplistaAk ||= egen || forsta || "ovriga";
  const rita = () => {
    el.innerHTML = topplistaHtml(lista, { ak: S.topplistaAk, uid: S.uid, egen });
    el.querySelector(".md-ak")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ak]");
      if (b) { S.topplistaAk = b.dataset.ak; rita(); }
    });
  };
  rita();
}
