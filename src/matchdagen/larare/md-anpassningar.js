// ============================================================================
// Lärarsidan – Mina klasser → Elever → "Anpassningar per elev" (md-anpassningar.js) · #867
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §1.2. En rad per elev i klassen med
// Matchdagen på/av (ur classes/{id}.elevModuler – ingen läsning). Klick på en elev
// fäller ut panelen (md-anpassningar-panel.js) under raden; då läses elevens
// matchdagenInst/{uid} (EN getDoc) och biblioteket (en gång per sida, sidans store).
// En panel åt gången. Laddas med import() från teacher-classes-sections.js (#271).
// ============================================================================

import { el, esc } from "../../teacher-shared.js";
import { byNamn } from "../../teacher-class-accounts.js";
import { MATCHDAGEN_IKON } from "../../gamemode-visibility.js";
import { harMatchdagen } from "../md-inst.js";
import { renderPanel } from "./md-anpassningar-panel.js";

/**
 * Rita sektionen för klassen `cls` i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: elevModuler vid spar)
 * @param {HTMLElement} host
 * @param {{state:{students:Array}, loadLibrary:Function, notify?:Function}} store
 */
export function renderAnpassningar(ctx, cls, host, store) {
  const ids = new Set(cls.studentIds || []);
  const elever = store.state.students.filter((s) => ids.has(s.id)).sort(byNamn);
  const wrap = el(`<div class="mda">
    <p class="hint mda-intro">Här anpassar du Pluggporten för en elev i taget. <b>Matchdagen</b> är ett fotbollsspel
      där varje drag kräver ett rätt svar på en fråga som du väljer. Det slås bara på för enskilda elever, aldrig för
      hela klassen, och syns under <i>Öva</i> i elevens meny. Klicka på en elev för att ändra.</p>
    <ul class="mda-lista" role="list"></ul>
  </div>`);
  const lista = wrap.querySelector(".mda-lista");
  if (!elever.length) {
    lista.replaceWith(el(`<p class="hint">Klassen har inga elever än.</p>`));
    host.replaceChildren(wrap);
    return;
  }

  const status = (s) => harMatchdagen(cls, s.id)
    ? `<span class="mda-chip pa"><span class="mda-boll">${MATCHDAGEN_IKON}</span>Matchdagen på</span>`
    : `<span class="mda-chip">Matchdagen av</span>`;
  const rad = (s) => el(`<li class="mda-elev" data-id="${esc(s.id)}">
      <button type="button" class="mda-rad" aria-expanded="false" aria-controls="mda-panel-${esc(s.id)}">
        <span class="mda-namn">${esc(s.namn || s.username || s.id)}</span>
        <span class="mda-status">${status(s)}</span>
        <span class="mda-pil" aria-hidden="true">›</span>
      </button>
      <div class="mda-panel" id="mda-panel-${esc(s.id)}" hidden></div>
    </li>`);
  lista.append(...elever.map(rad));

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
    const s = elever.find((x) => x.id === li.dataset.id);
    const panel = li.querySelector(".mda-panel");
    const avbryt = { aborted: false };
    oppen = { li, avbryt };
    li.classList.add("oppen");
    knapp.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    renderPanel(ctx, {
      cls, elev: s, host: panel, avbryt,
      loadLibrary: () => store.loadLibrary(),
      // Efter spar: radens status följer direkt (ingen ny läsning).
      onSaved: () => {
        li.querySelector(".mda-status").innerHTML = status(s);
        store.notify?.();
      },
    });
  });

  host.replaceChildren(wrap);
}
