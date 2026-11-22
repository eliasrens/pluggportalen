// ============================================================================
// Pluggporten – lärarsidan: sektionen Veckoschema i fliken Fokusläge (#901)
// ----------------------------------------------------------------------------
// docs/VECKOSCHEMA.md, Del C. ENKELT FÖRST: överst kryssrutan "Aktivera
// veckoschemat" (alltid synlig, ett klick), under den raden om läget, veckan
// (fem kolumner, en lista per dag på smal skärm) och "+ Lägg till lektion" (ämne,
// från, till och flera dagar på en gång). Ett kort → Ändra / Ta bort. Allt sparas
// direkt ("Sparat ✓"), EN skrivning per ändring (data-class-schema.js).
// Ämneskopplingen fylls i automatiskt; bara när gissningen misslyckas syns en
// rad "Vi vet inte vilket ämne … hör till – välj", annars en ihopfälld länk.
// Krockar nekas här (reglerna prövar inte överlapp). Den rena logiken bor i
// klass-schema.js (B) och klass-schema-larare.js.
//
// Laddas DYNAMISKT från teacher-classes-sections.js – aldrig i bootgrafen (#271).
// ============================================================================

import { el, esc, errText } from "./teacher-shared.js";
import { activeLock } from "./class-lock.js";
import { modulesHiddenForStudent, normalizeElevModuler } from "./gamemode-visibility.js";
import {
  KOPPLINGAR,
  MATCHDAGEN_TABELLER,
  SCHEMA_DAGAR,
  amnetsInnehall,
  effektivKoppling,
  normalizeSchema,
  okandaKopplingar,
  tidTillMinuter,
} from "./klass-schema.js";
import { laggTillLektioner, lageRad, lektionText, taBortLektion, tidEfter, veckan } from "./klass-schema-larare.js";
import { serverNow, syncServerClock } from "./data-class-lock.js";
import { setClassSchema } from "./data-class-schema.js";

const KORT_DAG = { 1: "Mån", 2: "Tis", 3: "Ons", 4: "Tor", 5: "Fre" };
const LANG_DAG = { 1: "Måndag", 2: "Tisdag", 3: "Onsdag", 4: "Torsdag", 5: "Fredag" };
const kopia = (s) => ({ pa: s.pa, lektioner: s.lektioner.map((l) => ({ ...l })), koppling: { ...s.koppling } });
const lista = (namn) => (namn.length < 2 ? namn.join("") : `${namn.slice(0, -1).join(", ")} och ${namn.at(-1)}`);

/** Det som ska ha en koppling (Schack aldrig). */
const VALBARA = KOPPLINGAR.filter((k) => k.amnesTips !== null);

/**
 * Rendera sektionen "Veckoschema" för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.schema efter sparning)
 * @param {HTMLElement} host
 * @param {Array} library     ämnen med sina områden (loadLibrary)
 * @param {{onChange?:Function}} [opts] efter varje sparning (klassväljarens 📅)
 */
export async function renderClassSchema(ctx, cls, host, library, { onChange } = {}) {
  await syncServerClock().catch(() => 0);
  const subjects = library.map(({ areas, ...s }) => s);
  const finnsAmne = new Set(subjects.map((s) => s.id));
  const amnenMedOmraden = library.filter((s) => (s.areas || []).length).map((s) => s.id);
  // Det klassens elever annars ser (dolda + opt-in som inte är påslagna) – klassen som en elev.
  const dolda = new Set(modulesHiddenForStudent([{ ...cls, studentIds: ["_"] }], "_"));
  const matchdagenFinns = !dolda.has("matchdagen") || Object.keys(normalizeElevModuler(cls.elevModuler)).length > 0;
  const relevant = (k) => (k.id === MATCHDAGEN_TABELLER ? matchdagenFinns : !dolda.has(k.id));

  let sparat = normalizeSchema(cls.schema) || { pa: false, lektioner: [], koppling: {} };
  let s = kopia(sparat);
  let oppenMeny = null; // lektions-id vars Ändra/Ta bort-ruta är öppen
  let redigerar = null; // null = stängd, "" = ny lektion, annars id:t som ändras
  const senast = { amne: subjects[0]?.id || "", start: "08:00", slut: "09:00" };

  const box = el(`<section class="vs" aria-label="Veckoschema">
    <h3 class="vs-rubrik">📅 Veckoschema</h3>
    <div class="vs-topp">
      <label class="vs-pa">
        <input type="checkbox" class="vs-pa-ruta" />
        <span><b>Aktivera veckoschemat</b> – under lektionstid ser eleverna bara lektionens ämne.</span>
      </label>
      <span class="vs-sparat" aria-live="polite"></span>
    </div>
    <p class="vs-lage hint"></p>
    <div class="vs-vecka"></div>
    <p class="vs-okanda hint"></p>
    <div class="vs-knapprad"><button type="button" class="btn gron small vs-ny">+ Lägg till lektion</button></div>
    <form class="vs-ruta" hidden>
      <h4 class="vs-ruta-titel"></h4>
      <div class="vs-falt">
        <label>Ämne <select class="select vs-amne" aria-label="Ämne"></select></label>
        <label>Från <input type="time" class="cell vs-fran" step="60" aria-label="Från" required /></label>
        <label>Till <input type="time" class="cell vs-till" step="60" aria-label="Till" required /></label>
      </div>
      <fieldset class="vs-dagar">
        <legend>Dagar</legend>
        ${SCHEMA_DAGAR.map((d) => `<label><input type="checkbox" value="${d}" /> ${KORT_DAG[d]}</label>`).join("")}
      </fieldset>
      <p class="vs-fel err-inline" role="alert" hidden></p>
      <div class="row-inline vs-ruta-knappar">
        <button type="submit" class="btn gron small vs-ok"></button>
        <button type="button" class="btn ghost small vs-avbryt">Avbryt</button>
      </div>
    </form>
    <details class="vs-koppling">
      <summary>Vilket ämne hör Läsresan, Mattematchen och de andra till?</summary>
      <div class="vs-koppling-lista"></div>
    </details>
  </section>`);

  const $ = (sel) => box.querySelector(sel);
  const paEl = $(".vs-pa-ruta");
  const sparatEl = $(".vs-sparat");
  const lageEl = $(".vs-lage");
  const veckaEl = $(".vs-vecka");
  const okandaEl = $(".vs-okanda");
  const form = $(".vs-ruta");
  const felEl = $(".vs-fel");
  const kopplingEl = $(".vs-koppling");

  $(".vs-amne").innerHTML = subjects.length
    ? subjects.map((x) => `<option value="${esc(x.id)}">${esc(x.name || x.id)}</option>`).join("")
    : `<option value="" disabled selected>Det finns inga ämnen än</option>`;

  const medSchema = () => ({ ...cls, schema: s });
  /** Lektionens ämne har inget i klassen → lektionen filtrerar inget (B.4). */
  const filtrerarInget = (amne) => {
    const inn = amnetsInnehall(medSchema(), amne, { amnenMedOmraden, subjects, dolda: [...dolda] });
    return !inn.omraden && !inn.moduler.length;
  };

  function ritaLage() {
    const now = serverNow();
    const r = lageRad(s, now, { subjects, fokus: !!activeLock(cls, now), filtrerarInget });
    lageEl.hidden = !s.lektioner.length && !s.pa;
    lageEl.innerHTML = r.delar ? `${esc(r.delar.fore)}<b>${esc(r.delar.amne)}</b>${esc(r.delar.efter)}` : esc(r.text);
  }

  function kortHtml(l) {
    const borta = !finnsAmne.has(l.amne);
    const not = borta ? "ämnet finns inte längre" : filtrerarInget(l.amne) ? "inga områden valda – allt syns" : "";
    const oppen = oppenMeny === l.id;
    return `<div class="vs-kort-plats">
      <button type="button" class="vs-kort${borta ? " vs-kort-borta" : ""}" data-id="${esc(l.id)}" aria-expanded="${oppen}">
        <span class="vs-kort-text">${esc(lektionText(l, subjects))}</span>
        ${not ? `<span class="vs-kort-not">${esc(not)}</span>` : ""}
      </button>
      ${oppen ? `<div class="vs-meny">
        <button type="button" class="btn ghost small" data-act="andra" data-id="${esc(l.id)}">Ändra</button>
        <button type="button" class="btn ghost small danger" data-act="bort" data-id="${esc(l.id)}">Ta bort</button>
      </div>` : ""}
    </div>`;
  }

  function rita() {
    const har = s.lektioner.length > 0;
    paEl.checked = s.pa;
    ritaLage();
    veckaEl.hidden = !har;
    veckaEl.classList.toggle("vs-blek", !s.pa);
    const dagar = veckan(s.lektioner);
    veckaEl.innerHTML = har
      ? SCHEMA_DAGAR.map((d) => `<div class="vs-dag">
          <h4 class="vs-dag-namn"><span class="vs-dag-kort" aria-hidden="true">${KORT_DAG[d]}</span><span class="vs-dag-lang">${LANG_DAG[d]}</span></h4>
          <div class="vs-dag-lektioner">${dagar[d].map(kortHtml).join("") || `<p class="vs-dag-tom">–</p>`}</div>
        </div>`).join("")
      : "";
    const okanda = har ? okandaKopplingar(s, subjects).map((id) => VALBARA.find((k) => k.id === id))
      .filter((k) => k && relevant(k)) : [];
    okandaEl.hidden = !okanda.length;
    okandaEl.innerHTML = okanda.length
      ? `Vi vet inte vilket ämne ${lista(okanda.map((k) => `<b>${esc(k.label)}</b>`))} hör till –
        <button type="button" class="vs-lank" data-act="valj">välj</button>`
      : "";
    kopplingEl.hidden = !har;
    const eff = effektivKoppling(s, subjects);
    $(".vs-koppling-lista").innerHTML = VALBARA.map((k) => `<label class="vs-koppling-rad">
        <span>${esc(k.label)}</span>
        <select class="select" data-koppling="${esc(k.id)}" aria-label="Ämne för ${esc(k.label)}">
          <option value="">Inget ämne</option>
          ${subjects.map((x) => `<option value="${esc(x.id)}"${eff[k.id] === x.id ? " selected" : ""}>${esc(x.name || x.id)}</option>`).join("")}
        </select>
      </label>`).join("");
  }

  // --- Sparandet: direkt, i tur och ordning, "Sparat ✓" -------------------------
  let kedja = Promise.resolve();
  let vantar = 0;
  function spara(nytt) {
    s = nytt;
    rita();
    const snapshot = kopia(s);
    vantar++;
    sparatEl.innerHTML = `<span class="hint">Sparar…</span>`;
    kedja = kedja.then(() => setClassSchema(cls.id, snapshot)).then(
      (ut) => {
        sparat = ut;
        cls.schema = ut;
        onChange?.();
        if (--vantar === 0) sparatEl.innerHTML = `<span class="ok-inline">Sparat ✓</span>`;
      },
      (err) => {
        if (--vantar === 0) {
          s = kopia(sparat); // tillbaka till det som faktiskt är sparat
          rita();
        }
        sparatEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(errText(err))}</span>`;
      }
    );
  }

  // --- Rutan "Lägg till lektion" / "Ändra lektion" -----------------------------
  function oppnaRuta(id) {
    redigerar = id;
    oppenMeny = null;
    const l = id ? s.lektioner.find((x) => x.id === id) : null;
    $(".vs-ruta-titel").textContent = l ? "Ändra lektion" : "Lägg till lektion";
    $(".vs-ok").textContent = l ? "Spara ändringen" : "Lägg till";
    const amneEl = $(".vs-amne");
    amneEl.value = l?.amne || senast.amne;
    if (!amneEl.value && subjects.length) amneEl.value = subjects[0].id;
    $(".vs-fran").value = l?.start || senast.start;
    $(".vs-till").value = l?.slut || senast.slut;
    // Ny lektion: alla dagar förbockade (en lektion varje dag = inga extra klick).
    form.querySelectorAll(".vs-dagar input").forEach((c) => (c.checked = l ? Number(c.value) === l.dag : true));
    felEl.hidden = true;
    form.hidden = false;
    rita();
    amneEl.focus();
  }
  function stangRuta() {
    redigerar = null;
    form.hidden = true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = {
      id: redigerar || undefined,
      amne: $(".vs-amne").value,
      start: $(".vs-fran").value,
      slut: $(".vs-till").value,
      dagar: [...form.querySelectorAll(".vs-dagar input:checked")].map((c) => Number(c.value)),
    };
    const r = laggTillLektioner(s.lektioner, val, { subjects });
    if (r.fel) {
      felEl.textContent = r.fel;
      felEl.hidden = false;
      return;
    }
    // Nästa lektion börjar där den här slutade, lika lång.
    const langd = Math.max(5, tidTillMinuter(val.slut) - tidTillMinuter(val.start));
    Object.assign(senast, { amne: val.amne, start: val.slut, slut: tidEfter(val.slut, langd) });
    stangRuta();
    spara({ ...s, lektioner: r.lektioner });
  });
  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") stangRuta();
  });
  $(".vs-avbryt").addEventListener("click", stangRuta);
  $(".vs-ny").addEventListener("click", () => (redigerar === "" && !form.hidden ? stangRuta() : oppnaRuta("")));

  paEl.addEventListener("change", () => spara({ ...s, pa: paEl.checked }));

  box.addEventListener("click", (e) => {
    const kort = e.target.closest(".vs-kort");
    if (kort) {
      oppenMeny = oppenMeny === kort.dataset.id ? null : kort.dataset.id;
      rita();
      box.querySelector(`.vs-kort[data-id="${CSS.escape(kort.dataset.id)}"]`)?.focus();
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "andra") oppnaRuta(act.dataset.id);
    else if (act.dataset.act === "bort") {
      oppenMeny = null;
      if (redigerar === act.dataset.id) stangRuta();
      spara({ ...s, lektioner: taBortLektion(s.lektioner, act.dataset.id) });
    } else if (act.dataset.act === "valj") {
      kopplingEl.open = true;
      const forsta = okandaKopplingar(s, subjects).find((id) => relevant(VALBARA.find((k) => k.id === id) || {}));
      kopplingEl.querySelector(`[data-koppling="${CSS.escape(forsta || "")}"]`)?.focus();
    }
  });
  box.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-koppling]");
    if (sel) spara({ ...s, koppling: { ...s.koppling, [sel.dataset.koppling]: sel.value || null } });
  });

  rita();
  // Raden om läget följer klockan medan sektionen är öppen (stannar när den lämnar DOM:en).
  const tick = setInterval(() => (box.isConnected ? ritaLage() : clearInterval(tick)), 15000);
  host.replaceChildren(box);
}
