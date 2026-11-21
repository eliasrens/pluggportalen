// ============================================================================
// Lärarsidan – Mina klasser → Elever → "Anpassningar per elev" (md-anpassningar.js) · #867
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §1.2. En rad per elev i klassen med
// Matchdagen på/av (ur classes/{id}.elevModuler – ingen läsning). Klick på en elev
// fäller ut panelen (md-anpassningar-panel.js) under raden; då läses elevens
// matchdagenInst/{uid} (EN getDoc) och biblioteket (en gång per sida, sidans store).
// En panel åt gången. Laddas med import() från teacher-classes-sections.js (#271).
// #876: överst raden "Hela klassen" (Matchdagen för klassen + klassens inställningar,
// samma panel med elev = null) och en kryssruta per elev med "Välj alla" och
// "Slå på/av för valda" (EN skrivning av elevModuler, md-inst-data.js sparaElevModuler).
// ============================================================================

import { el, esc, errText } from "../../teacher-shared.js";
import { byNamn } from "../../teacher-class-accounts.js";
import { MATCHDAGEN_IKON } from "../../gamemode-visibility.js";
import { elevPa, klassPa } from "../md-inst.js";
import { renderPanel } from "./md-anpassningar-panel.js";

/**
 * Rita sektionen för klassen `cls` i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: elevModuler, enabledModules, matchdagenInst vid spar)
 * @param {HTMLElement} host
 * @param {{state:{students:Array}, loadLibrary:Function, notify?:Function}} store
 */
export function renderAnpassningar(ctx, cls, host, store) {
  const ids = new Set(cls.studentIds || []);
  const elever = store.state.students.filter((s) => ids.has(s.id)).sort(byNamn);
  const wrap = el(`<div class="mda">
    <p class="hint mda-intro">Här anpassar du Pluggporten för hela klassen eller en elev i taget. <b>Matchdagen</b> är
      ett fotbollsspel där varje drag kräver ett rätt svar på en fråga som du väljer. Slå på det för hela klassen eller
      för enskilda elever – det syns under <i>Öva</i> i elevens meny. Elever utan egna inställningar får klassens.
      Klicka på en rad för att ändra.</p>
    <div class="mda-verktyg">
      <button type="button" class="btn ghost small" data-valj-alla>Välj alla</button>
      <button type="button" class="btn ghost small" data-massa="1" disabled>Slå på för valda</button>
      <button type="button" class="btn ghost small" data-massa="0" disabled>Slå av för valda</button>
      <span class="mda-massa-resultat" role="status"></span>
    </div>
    <ul class="mda-lista" role="list"></ul>
  </div>`);
  const lista = wrap.querySelector(".mda-lista");
  const verktyg = wrap.querySelector(".mda-verktyg");

  const chip = (pa, text) => pa
    ? `<span class="mda-chip pa"><span class="mda-boll">${MATCHDAGEN_IKON}</span>${text}</span>`
    : `<span class="mda-chip">Matchdagen av</span>`;
  const status = (s) => s
    ? (elevPa(cls, s.id) ? chip(true, "Matchdagen på") : klassPa(cls) ? chip(true, "På för klassen") : chip(false))
    : chip(klassPa(cls), "På för hela klassen");
  const KLASS = "__klass"; // raden "Hela klassen" (elev = null)
  const rad = (s) => {
    const id = s ? s.id : KLASS;
    return el(`<li class="mda-elev${s ? "" : " mda-klassrad"}" data-id="${esc(id)}">
      <div class="mda-radrad">
        ${s ? `<label class="mda-valj"><input type="checkbox" data-valj="${esc(s.id)}" aria-label="Välj ${esc(s.namn || s.username || s.id)}" /></label>` : ""}
        <button type="button" class="mda-rad" aria-expanded="false" aria-controls="mda-panel-${esc(id)}">
          <span class="mda-namn">${s ? esc(s.namn || s.username || s.id) : `Hela klassen <small>inställningar för elever utan egna</small>`}</span>
          <span class="mda-status">${status(s)}</span>
          <span class="mda-pil" aria-hidden="true">›</span>
        </button>
      </div>
      <div class="mda-panel" id="mda-panel-${esc(id)}" hidden></div>
    </li>`);
  };
  lista.append(rad(null), ...elever.map(rad));
  if (!elever.length) {
    verktyg.hidden = true;
    lista.after(el(`<p class="hint">Klassen har inga elever än.</p>`));
  }
  const uppdateraStatus = () => lista.querySelectorAll(".mda-elev").forEach((li) => {
    li.querySelector(".mda-status").innerHTML = status(elever.find((x) => x.id === li.dataset.id) || null);
  });

  // "Välj alla" (#876): kryssrutorna väljer elever; på/av för valda = EN skrivning av elevModuler.
  const valjAlla = verktyg.querySelector("[data-valj-alla]");
  const massResultat = verktyg.querySelector(".mda-massa-resultat");
  const valda = () => [...lista.querySelectorAll("input[data-valj]:checked")].map((c) => c.dataset.valj);
  const synka = () => {
    const n = valda().length;
    valjAlla.textContent = n && n === elever.length ? "Avmarkera alla" : "Välj alla";
    verktyg.querySelectorAll("[data-massa]").forEach((b) => (b.disabled = !n));
  };
  lista.addEventListener("change", (e) => {
    if (!e.target.matches("input[data-valj]")) return;
    massResultat.innerHTML = "";
    synka();
  });
  valjAlla.addEventListener("click", () => {
    const alla = valda().length !== elever.length;
    lista.querySelectorAll("input[data-valj]").forEach((c) => (c.checked = alla));
    massResultat.innerHTML = "";
    synka();
  });
  verktyg.addEventListener("click", async (e) => {
    const knapp = e.target.closest("[data-massa]");
    if (!knapp) return;
    const pa = knapp.dataset.massa === "1";
    const uids = valda();
    verktyg.querySelectorAll("button").forEach((b) => (b.disabled = true));
    massResultat.textContent = "Sparar…";
    try {
      await (await import("../md-inst-data.js")).sparaElevModuler(cls, uids, pa);
      stang(); // en öppen panel visar annars gammal på/av
      uppdateraStatus();
      massResultat.innerHTML = `<span class="ok-inline">Sparat ✓ Matchdagen ${pa ? "på" : "av"} för ${uids.length} ${uids.length === 1 ? "elev" : "elever"}</span>`;
      store.notify?.();
    } catch (err) {
      massResultat.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(errText(err))}</span>`;
    } finally {
      valjAlla.disabled = false;
      synka();
    }
  });

  let oppen = null; // { li, avbryt }
  function stang() {
    if (!oppen) return;
    oppen.avbryt.aborted = true;
    const panel = oppen.li.querySelector(".mda-panel");
    panel.hidden = true;
    panel.replaceChildren();
    oppen.li.querySelector(".mda-rad").setAttribute("aria-expanded", "false");
    oppen.li.classList.remove("oppen");
    oppen = null;
  }

  lista.addEventListener("click", (e) => {
    const knapp = e.target.closest(".mda-rad");
    if (!knapp) return;
    const li = knapp.closest(".mda-elev");
    const varOppen = oppen?.li === li;
    stang();
    if (varOppen) return;
    const s = elever.find((x) => x.id === li.dataset.id) || null; // null = Hela klassen
    const panel = li.querySelector(".mda-panel");
    const avbryt = { aborted: false };
    oppen = { li, avbryt };
    li.classList.add("oppen");
    knapp.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    renderPanel(ctx, {
      cls, elev: s, host: panel, avbryt,
      loadLibrary: () => store.loadLibrary(),
      // Efter spar: radernas status följer direkt (ingen ny läsning) – klassens på/av syns på alla.
      onSaved: () => {
        uppdateraStatus();
        store.notify?.();
      },
    });
  });

  host.replaceChildren(wrap);
}
