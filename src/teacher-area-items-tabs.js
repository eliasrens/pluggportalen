// ============================================================================
// Pluggporten – lärarsidan: flikmotor för områdets underrad
// (teacher-area-items-tabs.js, issue #455)
// ----------------------------------------------------------------------------
// En understruken flikrad (samma stil som Innehållsstudions ämnesflikar, #453)
// med antal som badge, enligt ARIA-mönstret för flikar: role="tablist"/"tab"/
// "tabpanel", aria-selected + aria-controls, rullande tabindex och piltangenter
// (←/→, Home/End) med automatisk aktivering. Panelerna byggs LAT (render(id)
// första gången fliken visas) och behålls sedan – osparade formulär i en flik
// överlever flikbyten. Vilka flikar som visas och vilken som är förvald avgör
// teacher-area-items-ops.js (tabsFor/pickTab, enhetstestade).
//
// BOOT-SÄKERT (#271): importeras bara av teacher-area-items.js (som i sin tur
// bara laddas med import()).
// ============================================================================

import { esc } from "./teacher-shared.js";

let seq = 0;

/**
 * @param {object} o
 * @param {string} o.ariaLabel  – tablistens namn.
 * @param {{id:string,label:string,ic:string,count?:number|null}[]} o.tabs
 * @param {string[]} [o.order] – flikarnas kanoniska ordning (för flikar som läggs till sent).
 * @param {string|null} o.active – förvald flik.
 * @param {(id:string)=>HTMLElement} o.render – bygger panelens innehåll (en gång).
 * @param {(id:string)=>void} [o.onChange] – anropas när användaren byter flik.
 * @returns {{ root:HTMLElement, row:HTMLElement, select:(id:string,opts?:{focus?:boolean})=>HTMLElement|null,
 *   add:(tab:object)=>void, has:(id:string)=>boolean, readonly active:string|null }}
 */
export function createTabs({ ariaLabel, tabs, order = [], active, render, onChange }) {
  const base = `ai-tabs-${++seq}`;
  const root = document.createElement("div");
  root.className = "ai-tabs";
  root.innerHTML = `<div class="ai-tabs-row">
      <div class="ai-tablist" role="tablist" aria-label="${esc(ariaLabel)}"></div>
    </div>
    <div class="ai-tabpanels"></div>`;
  const row = root.querySelector(".ai-tabs-row");
  const list = root.querySelector(".ai-tablist");
  const panelsEl = root.querySelector(".ai-tabpanels");
  const btns = new Map();
  const panels = new Map();
  let current = null;

  function add(t) {
    if (btns.has(t.id)) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ai-tab";
    b.id = `${base}-tab-${t.id}`;
    b.dataset.tab = t.id;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", "false");
    b.setAttribute("aria-controls", `${base}-panel-${t.id}`);
    b.tabIndex = -1;
    b.innerHTML = `<span aria-hidden="true">${esc(t.ic)}</span><span>${esc(t.label)}</span>${
      t.count == null ? "" : `<span class="ai-count">${esc(String(t.count))}</span>`
    }`;
    b.addEventListener("click", () => {
      select(t.id);
      onChange?.(t.id);
    });
    // Sen flik (t.ex. "+ Lästext") hamnar på sin plats i `order`, inte sist.
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
    const after = [...btns.values()].find((x) => rank(x.dataset.tab) > rank(t.id));
    btns.set(t.id, b);
    list.insertBefore(b, after || null);
  }

  function panelFor(id) {
    let p = panels.get(id);
    if (!p) {
      p = document.createElement("div");
      p.className = `ai-tabpanel ai-tabpanel-${id}`;
      p.id = `${base}-panel-${id}`;
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", `${base}-tab-${id}`);
      p.hidden = true;
      p.append(render(id));
      panels.set(id, p);
      panelsEl.append(p);
    }
    return p;
  }

  /** Visa fliken `id`; returnerar dess panel. */
  function select(id, { focus = false } = {}) {
    const b = btns.get(id);
    if (!b) return null;
    current = id;
    for (const [k, x] of btns) {
      const on = k === id;
      x.classList.toggle("active", on);
      x.setAttribute("aria-selected", String(on));
      x.tabIndex = on ? 0 : -1;
    }
    const p = panelFor(id);
    for (const [k, x] of panels) x.hidden = k !== id;
    if (focus) b.focus({ preventScroll: true });
    // Mobil: flikraden scrollar i sidled – håll vald flik synlig (bara i sidled,
    // så sidan inte hoppar vertikalt).
    const rb = b.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (rb.left < rr.left) row.scrollLeft -= rr.left - rb.left + 12;
    else if (rb.right > rr.right) row.scrollLeft += rb.right - rr.right + 12;
    return p;
  }

  // Piltangenter mellan flikar (automatisk aktivering), Home/End till ändarna.
  list.addEventListener("keydown", (e) => {
    const ids = [...list.querySelectorAll('[role="tab"]')].map((x) => x.dataset.tab);
    const i = ids.indexOf(current);
    const to =
      e.key === "ArrowRight" ? ids[(i + 1) % ids.length]
      : e.key === "ArrowLeft" ? ids[(i - 1 + ids.length) % ids.length]
      : e.key === "Home" ? ids[0]
      : e.key === "End" ? ids[ids.length - 1]
      : null;
    if (!to) return;
    e.preventDefault();
    select(to, { focus: true });
    onChange?.(to);
  });

  tabs.forEach(add);
  if (active) select(active);
  return {
    root,
    row,
    select,
    add,
    has: (id) => btns.has(id),
    get active() {
      return current;
    },
  };
}
