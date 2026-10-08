// ============================================================================
// Pluggporten – inredning av ett rum bakom ett adapter-interface (#490)
// ----------------------------------------------------------------------------
// Rita placerade saker, möbellådan, markera/plocka bort och dra-och-släpp –
// utan att veta VAR placeringarna sparas. Ägaren skickar en adapter:
//
//   placements()        → { "<id>" | "<id>#<n>": { x, y, … } } som visas.
//                          Motorn muterar objektet (nya/flyttade/borttagna) och
//                          behåller övriga fält (t.ex. Klasscentrets z).
//   lada(id)            → antal exemplar som får stå i rummet
//   ladaIds()           → sak-id:n som kan finnas i lådan (visningsordning)
//   spara(placements)   → en ändring är gjord (debounce/"osparat" = adapterns sak)
//   kanInreda()         → false = läsläge: ingen låda, ingen drag, ingen 🗑️,
//                          men sakerna syns och hovras (title)
//   sak(id)             → { namn, art (markup), w, h (rums-enheter), golv,
//                          taBort? (false = ingen 🗑️ på just den saken) } | null
//   rang?(nyckel)       → ritordning (stigande); default nyckelordning
//   ovanpa?(nyckel)     → en sak placerades/flyttades (lägg den överst)
//   efterDrag?()        → en drag/ett klick på en sak är avslutad
//
// Klasscentrets rum (klasscenter/kc-rum-vy.js) är första användaren. Drag-
// klamringen, ritordningen, startplatsen, nycklarna och sak-noden är SAMMA
// kärna som Mitt rum (rum-promenad-golv.js) – Mitt rum (varld-rum.js) använder
// kärnan direkt eftersom den ligger i den statiska bootgrafen; denna modul
// laddas bara dynamiskt (#271) och får därför inte importeras därifrån.
// ============================================================================

import {
  kopplaRumDrag, ordnaNycklar, nastaPlats, nyPlaceringsNyckel, rumSakHtml,
} from "./rum-promenad-golv.js";

/** Sak-id ur en placerings-nyckel ("lounge#2" → "lounge"). */
export function sakIdFranNyckel(nyckel) {
  return String(nyckel).split("#")[0];
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Hur många exemplar av `id` som ännu kan ställas in (lådan − placerade). */
export function kvarILadan(adapter, placements, id) {
  const ute = Object.keys(placements).filter((k) => sakIdFranNyckel(k) === id).length;
  return adapter.lada(id) - ute;
}

/**
 * Montera inredningen.
 * @param {object} o
 * @param {HTMLElement} o.stage    rummets scen (.room-stage)
 * @param {HTMLElement} [o.tray]   behållare för möbellådan
 * @param {HTMLElement} [o.trayHint] hint-rad ovanför lådan
 * @param {object} o.adapter       se modulhuvudet
 * @param {() => string} o.bakgrund  bakgrundens markup (ritas först)
 * @param {{tomtRum?:(string|(() => string)), tomLada?:string, allaUte?:string, valj?:string}} [o.text]
 * @returns {{ rita:()=>void, ritaLada:()=>void, pagarDrag:()=>boolean, avmarkera:()=>void }}
 */
export function mountInredning({ stage, tray, trayHint, adapter, bakgrund, text = {} }) {
  let vald = null;
  const pl = () => adapter.placements();
  const sakFor = (nyckel) => adapter.sak(sakIdFranNyckel(nyckel));

  function rita() {
    const kan = adapter.kanInreda();
    if (!kan) vald = null;
    const p = pl();
    let html = bakgrund();
    for (const nyckel of ordnaNycklar(p, (k) => adapter.rang?.(k) ?? 0)) {
      const s = sakFor(nyckel);
      if (!s) continue;
      const pos = p[nyckel];
      html += rumSakHtml({
        key: esc(nyckel), x: pos.x, y: pos.y, titel: esc(s.namn), art: s.art,
        w: s.w, h: s.h, vald: vald === nyckel, taBort: kan && s.taBort !== false,
      });
    }
    const tomt = typeof text.tomtRum === "function" ? text.tomtRum() : text.tomtRum;
    if (Object.keys(p).length === 0 && tomt) html += `<div class="room-empty">${esc(tomt)}</div>`;
    // EN DOM-skrivning per ritning (inte en nod i taget).
    stage.innerHTML = html;
    stage.classList.toggle("inredning-las", !kan);
  }

  function ritaLada() {
    if (!tray) return;
    tray.replaceChildren();
    const p = pl();
    const ids = adapter.ladaIds().filter((id) => adapter.sak(id));
    const kvar = ids.filter((id) => kvarILadan(adapter, p, id) > 0);
    if (trayHint) {
      trayHint.textContent = ids.length === 0 ? (text.tomLada || "Lådan är tom.")
        : kvar.length === 0 ? (text.allaUte || "Alla saker står i rummet. 🎉")
        : (text.valj || "Klicka på en sak för att ställa den i rummet.");
    }
    let html = "";
    for (const id of kvar) {
      const s = adapter.sak(id);
      const n = kvarILadan(adapter, p, id);
      html += `<button class="tray-item" data-place="${esc(id)}" title="${esc(s.namn)}">
        <span class="tray-emoji">${s.art}</span>
        <span class="tray-namn">${esc(n > 1 ? `${s.namn} (${n})` : s.namn)}</span>
      </button>`;
    }
    tray.innerHTML = html;
  }

  function andrat() {
    rita();
    ritaLada();
    adapter.spara(pl());
  }

  // Placera en sak från lådan (klick): spridd startplats i rätt zon.
  tray?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn || !adapter.kanInreda()) return;
    const id = btn.dataset.place;
    const p = pl();
    if (kvarILadan(adapter, p, id) <= 0) return;
    const s = adapter.sak(id);
    const nyckel = nyPlaceringsNyckel(p, id);
    p[nyckel] = nastaPlats(p, !!s.golv, (k) => !!sakFor(k)?.golv);
    adapter.ovanpa?.(nyckel);
    vald = null;
    andrat();
  });

  // Plocka bort (🗑️) → tillbaka i lådan.
  stage.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn || !adapter.kanInreda()) return;
    const nyckel = btn.dataset.remove;
    delete pl()[nyckel];
    if (vald === nyckel) vald = null;
    andrat();
  });

  const drag = kopplaRumDrag(stage, {
    // Läsläge → null = ingen drag (klick markerar inte heller).
    zon: (node) => (adapter.kanInreda() && node.dataset.id ? (sakFor(node.dataset.id)?.golv ? "golv" : "vagg") : null),
    tomYta: () => {
      if (vald === null) return;
      vald = null;
      rita();
    },
    flytt: (d, x, y) => {
      const p = pl();
      p[d.id] = { ...p[d.id], x, y };
    },
    slapp: (d) => {
      if (d.moved) {
        adapter.ovanpa?.(d.id);
        rita();
        adapter.spara(pl());
      } else {
        vald = vald === d.id ? null : d.id;
        rita();
      }
      // Efter kärnans drag = null (nästa mikrotask) så adaptern ser drag:en avslutad.
      queueMicrotask(() => adapter.efterDrag?.());
    },
  });

  return {
    rita,
    ritaLada,
    pagarDrag: () => !!drag.pagar(),
    avmarkera: () => { vald = null; },
  };
}
