// ============================================================================
// Hitta rätt! – frågelistan i formuläret (src/hitta-ratt/larare/lhr-fragor.js) · #634
// ----------------------------------------------------------------------------
// Frågelistan från C (arkitektur §11.10). Kartvalet från E (lhr-kartval.js,
// platssökning + kartklick) läggs in under rubriken; namnlistan för områden
// finns kvar (§11.7, tangentbord och små länder).
//   punkt:  namn, frågetext, "📍 Flytta på kartan" och lat/lon under "Avancerat"
//   område: sökbar namnlista ur <geo>.namn.json → en fråga per område
//   båda:   frivillig bild per fråga (lhr-bilder.js, #637)
//
//   ritaFragor(host, st, { omraden, andrad, kartval, kartvalHost })
//     st.f      formuläret (lhr-modell.js) – items skrivs om här
//     omraden   laddaOmraden(geo) för områdespack, annars null
//     andrad()  anropas vid varje ändring (osparat-läge, facit-varning)
//     kartval   skapaKartval(...) – kartvalHost (med kartan) flyttas in, ritas aldrig om
// Inmatning i ett fält ritar inte om listan (fokus behålls); lägg till och
// ta bort ritar om.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { GRANS } from "../delat/egna.js";
import { laggTillOmrade, sokOmraden, tal, tomFraga } from "./lhr-modell.js";
import { bildHtml, kopplaBild } from "./lhr-bilder.js";

const MAX_TRAFFAR = 12;

const platsText = (it) => {
  const lat = tal(it.lat);
  const lon = tal(it.lon);
  return lat === undefined || lon === undefined ? "" : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
};

function punktRad(it, i, kartval) {
  const plats = platsText(it);
  return `<li class="lhr-fraga" data-i="${i}">
    <span class="lhr-fraga-nr">${i + 1}</span>
    <div class="lhr-fraga-falt">
      <label class="lhr-mini">Namn<input type="text" data-f="name" maxlength="${GRANS.namn}" value="${esc(it.name)}" placeholder="t.ex. Gävle" /></label>
      <label class="lhr-mini"><span>Frågetext <span class="hint">(valfri)</span></span><input type="text" data-f="prompt" maxlength="${GRANS.prompt}" value="${esc(it.prompt)}" placeholder="${esc(`Var ligger ${it.name || "…"}?`)}" /></label>
      ${kartval ? `<button type="button" class="btn small ghost lhr-pa-kartan" data-act="karta">📍 <span>${plats ? "Flytta på kartan" : "Välj på kartan"}</span></button>` : ""}
      <details class="lhr-avancerat"${plats || kartval ? "" : " open"}>
        <summary>Avancerat <span class="lhr-plats ${plats ? "" : "saknas"}" data-v="plats">${plats ? `📍 ${esc(plats)}` : "Plats saknas"}</span></summary>
        <div class="lhr-latlon">
          <label class="lhr-mini">Latitud (N)<input type="text" inputmode="decimal" data-f="lat" value="${esc(it.lat)}" placeholder="60,6749" /></label>
          <label class="lhr-mini">Longitud (E)<input type="text" inputmode="decimal" data-f="lon" value="${esc(it.lon)}" placeholder="17,1413" /></label>
        </div>
        <p class="hint">Decimalgrader. Väst och syd skrivs med minus. Kopiera t.ex. från Wikipedia eller en kartsajt.</p>
      </details>
      ${bildHtml(it)}
    </div>
    <button type="button" class="btn ghost small lhr-ta-bort" data-act="bort" title="Ta bort frågan" aria-label="Ta bort fråga ${i + 1}">${icon("x", 16)}</button>
  </li>`;
}

function omradeRad(it, i, namnFor) {
  return `<li class="lhr-fraga" data-i="${i}">
    <span class="lhr-fraga-nr">${i + 1}</span>
    <div class="lhr-fraga-falt">
      <p class="lhr-omrade-namn">🗺️ ${esc(namnFor(it))}</p>
      <label class="lhr-mini">Namn i frågan<input type="text" data-f="name" maxlength="${GRANS.namn}" value="${esc(it.name)}" /></label>
      <label class="lhr-mini"><span>Frågetext <span class="hint">(valfri)</span></span><input type="text" data-f="prompt" maxlength="${GRANS.prompt}" value="${esc(it.prompt)}" placeholder="${esc(`Hitta ${it.name || "…"}`)}" /></label>
      ${bildHtml(it)}
    </div>
    <button type="button" class="btn ghost small lhr-ta-bort" data-act="bort" title="Ta bort frågan" aria-label="Ta bort fråga ${i + 1}">${icon("x", 16)}</button>
  </li>`;
}

export function ritaFragor(host, st, { omraden = null, andrad = () => {}, kartval = null, kartvalHost = null } = {}) {
  const area = st.f.type === "area";
  const namnFor = (it) => omraden?.lista.find((o) => o.id === it.omrade)?.namn || it.key || it.omrade;
  const fullt = st.f.items.length >= GRANS.items;

  const vy = el(`<div class="lhr-fragor">
    <div class="lhr-fragor-topp">
      <h3 class="subhead">Frågor</h3>
      <span class="hint" data-v="antal">${st.f.items.length} av ${GRANS.items}</span>
    </div>
    ${area ? `<div class="lhr-sok">
      <label class="lhr-mini">Lägg till område
        <input type="search" data-v="sok" placeholder="Sök ett namn, t.ex. ${esc(omraden?.lista[0]?.namn || "")}" autocomplete="off" ${fullt ? "disabled" : ""} /></label>
      <div class="lhr-sok-traffar" role="listbox" aria-label="Områden att lägga till"></div>
    </div>` : ""}
    ${st.f.items.length ? `<ol class="lhr-fraga-lista">${st.f.items.map((it, i) => (area ? omradeRad(it, i, namnFor) : punktRad(it, i, kartval))).join("")}</ol>`
      : `<p class="hint lhr-inga-fragor">${area ? "Inga områden ännu – klicka på kartan eller sök i listan ovan." : kartval ? "Inga frågor ännu – sök en plats eller klicka på kartan." : "Inga frågor ännu."}</p>`}
    ${area ? "" : `<button type="button" class="btn small" data-act="ny" ${fullt ? "disabled" : ""}>${icon("plus", 16)}<span>Lägg till fråga</span></button>`}
  </div>`);

  if (kartvalHost) vy.querySelector(".lhr-fragor-topp").after(kartvalHost);

  const omrita = (fokus) => {
    ritaFragor(host, st, { omraden, andrad, kartval, kartvalHost });
    andrad();
    if (fokus) host.querySelector(fokus)?.focus();
  };

  vy.querySelectorAll(".lhr-fraga").forEach((rad) => {
    const it = st.f.items[Number(rad.dataset.i)];
    rad.querySelectorAll("[data-f]").forEach((inp) =>
      inp.addEventListener("input", () => {
        it[inp.dataset.f] = inp.value;
        if (inp.dataset.f === "name") {
          rad.querySelector('[data-f="prompt"]').placeholder = area ? `Hitta ${inp.value || "…"}` : `Var ligger ${inp.value || "…"}?`;
        }
        const pl = rad.querySelector('[data-v="plats"]');
        if (pl) {
          const p = platsText(it);
          pl.textContent = p ? `📍 ${p}` : "Plats saknas";
          pl.classList.toggle("saknas", !p);
        }
        andrad();
      })
    );
    rad.querySelector('[data-act="karta"]')?.addEventListener("click", () => kartval.valjFraga(it));
    kopplaBild(rad, it, { packId: st.f.id, andrad, omrita: () => omrita() });
    rad.querySelector('[data-act="bort"]').addEventListener("click", () => {
      st.f.items = st.f.items.filter((x) => x !== it);
      omrita(area ? '[data-v="sok"]' : '[data-act="ny"]');
    });
  });

  vy.querySelector('[data-act="ny"]')?.addEventListener("click", () => {
    st.f.items = [...st.f.items, tomFraga("point")];
    omrita('.lhr-fraga:last-child [data-f="name"]');
  });

  const sok = vy.querySelector('[data-v="sok"]');
  if (sok && omraden) {
    const traffar = vy.querySelector(".lhr-sok-traffar");
    let lista = [];
    const valj = (o) => {
      st.f = laggTillOmrade(st.f, o);
      omrita('[data-v="sok"]');
    };
    const visa = () => {
      const q = sok.value;
      lista = q.trim() ? sokOmraden(omraden.lista, q, st.f.items.map((it) => it.omrade)).slice(0, MAX_TRAFFAR) : [];
      traffar.replaceChildren(...lista.map((o) => {
        const b = el(`<button type="button" class="lhr-traff" role="option">${icon("plus", 14)}<span>${esc(o.namn)}</span></button>`);
        b.addEventListener("click", () => valj(o));
        return b;
      }));
      if (q.trim() && !lista.length) traffar.replaceChildren(el(`<p class="hint">Inget område heter så på den här kartan (eller så finns det redan).</p>`));
    };
    sok.addEventListener("input", visa);
    sok.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (lista[0]) valj(lista[0]);
      }
    });
  }

  host.replaceChildren(vy);
}
