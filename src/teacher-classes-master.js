// ============================================================================
// Pluggporten – lärarsidan: klassvyns master-lista (teacher-classes-master.js)
// ----------------------------------------------------------------------------
// Issue #440: smal vänstermeny med ENDAST klassnamn + antal elever (K-10/K-11),
// aktiv klass markerad (aria-current), "+ Skapa en ny klass" överst (K-02) och
// tomtillstånd (K-09). Klick = store.select() → detaljytan byts utan sidladdning.
// På smal skärm ersätts listan av en <select> överst (CSS växlar).
// 🔒 visas på klasser med aktivt fokusläge (activeLock + serverklockan – ingen
// extra läsning); kollas om var 15:e s så ett passerat klockslag släcks.
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import { activeLock } from "./class-lock.js";
import { serverNow } from "./data-class-lock.js";
import { countLabel, studentCount } from "./teacher-classes-store.js";

const NEW_VALUE = "__ny";

/** Bygg master-listan. Returnerar { element, update() }. */
export function createClassMaster(store) {
  const root = el(`<nav class="panel cls-master" aria-label="Klasser">
    <div class="cls-master-head">
      <span class="cls-master-title">Klasser</span>
    </div>
    <button type="button" class="btn ghost small cls-new">${icon("plus", 16)}<span>Skapa en ny klass</span></button>
    <ul class="cls-list" role="list"></ul>
    <label class="cls-picker-wrap">
      <span class="sr-only">Välj klass</span>
      <select class="select cls-picker" aria-label="Välj klass"></select>
    </label>
  </nav>`);

  const listEl = root.querySelector(".cls-list");
  const newBtn = root.querySelector(".cls-new");
  const picker = root.querySelector(".cls-picker");

  newBtn.addEventListener("click", () => store.showCreate());
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (btn) store.select(btn.dataset.id);
  });
  picker.addEventListener("change", () =>
    picker.value === NEW_VALUE ? store.showCreate() : store.select(picker.value)
  );

  function update() {
    const classes = store.sorted();
    const activeId = store.creating ? null : store.selectedId;
    const now = serverNow();
    newBtn.classList.toggle("active", store.creating);
    newBtn.setAttribute("aria-pressed", String(store.creating));

    if (!classes.length) {
      listEl.replaceChildren(
        el(`<li class="cls-empty"><b>Inga klasser än</b><span>Skapa din första klass – t.ex. 6A.</span></li>`)
      );
    } else {
      listEl.replaceChildren(
        ...classes.map((cls) => {
          const n = studentCount(cls);
          const on = cls.id === activeId;
          const locked = !!activeLock(cls, now);
          return el(`<li><button type="button" class="cls-item${on ? " active" : ""}" data-id="${esc(cls.id)}"
            ${on ? 'aria-current="true"' : ""} title="${esc(cls.name || cls.id)} – ${countLabel(n)}">
            <span class="cls-item-name">${esc(cls.name || cls.id)}</span>
            ${locked ? `<span class="cls-item-lock" title="Fokusläge på">${icon("lock", 14)}<span class="sr-only">Fokusläge på</span></span>` : ""}
            <span class="cls-item-count" aria-label="${countLabel(n)}">${n}</span>
          </button></li>`);
        })
      );
    }

    picker.innerHTML =
      classes
        .map(
          (cls) =>
            `<option value="${esc(cls.id)}"${cls.id === activeId ? " selected" : ""}>${esc(
              cls.name || cls.id
            )} (${countLabel(studentCount(cls))})</option>`
        )
        .join("") +
      `<option value="${NEW_VALUE}"${store.creating ? " selected" : ""}>+ Skapa en ny klass</option>`;
  }

  // Fokusläget kan gå ut (klockslag) eller ändras i Fokus-sektionen – håll 🔒 färsk.
  const tick = setInterval(() => (root.isConnected ? update() : clearInterval(tick)), 15000);

  update();
  return { element: root, update };
}
