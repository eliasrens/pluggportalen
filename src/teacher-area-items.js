// ============================================================================
// Pluggporten – lärarsidan: utfällda underrader per område (teacher-area-items.js,
// issue #454)
// ----------------------------------------------------------------------------
// Klick på en rad i Innehållsstudions tabell (eller ögat) fäller ut den här
// panelen: områdets innehåll i FLIKAR (#455, flikmotorn i teacher-area-items-tabs.js)
// Quiz & läsförståelse (n) · Para ihop (n) · Lästexter (n) – kompakta listrader
// med ✏️ Redigera och 🗑 Ta bort i en egen scrollyta per flik, "+ Lägg till …"
// alltid synlig under den.
// Generatorområden (Räkna) får en kort rad om räknegeneratorn (ändras via pennan).
// Tidsjakten (#598): fliken "Tidsjakten" listar händelserna (årtal + fråga) med
// samma redigera/ta bort/lägg till, och överst områdets tidsspann med en
// minitidslinje som förhandsvisar ändringen innan den sparas (op "span").
//
// SPARNING (saveArea = full överskrivning): hämta FÄRSK kopia med data.getArea,
// applicera ENBART ändringen (teacher-area-items-ops.js → validateArea som grind)
// och skriv hela dokumentet. Därefter onSaved(notice) → tabellen laddas om tyst
// och fäller ut samma områden igen. Ta bort bekräftas INNE i sidan (två steg).
//
// BOOT-SÄKERT (#271): laddas BARA via import() från teacher-content-list.js.
// ============================================================================

import * as data from "./data.js";
import {
  applyItemOp,
  hasPassageMode,
  isGeneratorArea,
  lastItemWarning,
  tabsFor,
  pickTab,
  ITEM_TABS,
} from "./teacher-area-items-ops.js";
import { buildQuizForm, buildPairForm, buildTextForm, buildTimelineForm } from "./teacher-area-items-forms.js";
import { miniTimelineHtml } from "./teacher-timeline-mini.js";
import { formatYear } from "./validate-timeline.js";
import { createTabs } from "./teacher-area-items-tabs.js";
import { el, esc, icon } from "./teacher-shared.js";
import { generatorSummary } from "./teacher-generator-labels.js";
import { buildAmnesSection } from "./teacher-amnes-texts.js";

const SECTION = {
  quiz: { title: "Quizfrågor", one: "frågan", add: "Lägg till fråga", ic: "📝" },
  pairs: { title: "Par", one: "paret", add: "Lägg till par", ic: "🔗" },
  texts: { title: "Lästexter", one: "texten", add: "Lägg till text", ic: "📄" },
  timeline: { title: "Tidslinjehändelser", one: "händelsen", add: "Lägg till händelse", ic: "⏳" },
};

/** Flikarna i underraden (#455). Quiz-fliken rymmer även läsförståelse-frågorna
 *  (samma quiz[] med passage, #151) – därför EN flik, inte två. */
const TAB = {
  quiz: { label: "Quiz & läsförståelse", ic: "📝" },
  pairs: { label: "Para ihop", ic: "🔗" },
  texts: { label: "Lästexter", ic: "📄" },
  timeline: { label: "Tidsjakten", ic: "⏳" },
  amnes: { label: "Ämnesläsning", ic: "📖" }, // #673: teacher-amnes-texts.js
};

const SAVED = {
  add: { quiz: "Frågan lades till.", pairs: "Paret lades till.", texts: "Texten lades till.", timeline: "Händelsen lades till." },
  update: { quiz: "Frågan sparades.", pairs: "Paret sparades.", texts: "Texten sparades.", timeline: "Händelsen sparades." },
  remove: { quiz: "Frågan togs bort.", pairs: "Paret togs bort.", texts: "Texten togs bort.", timeline: "Händelsen togs bort." },
  span: { timeline: "Tidsspannet sparades." },
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clip = (s, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const imgTag = (key) => `<span class="ai-tag">${icon("eye", 12)} bild: ${esc(key)}</span>`;

/** Kompakt innehåll i en listrad per typ. */
function itemHtml(kind, it) {
  if (kind === "quiz") {
    const right = (it.options || [])[it.answerIndex];
    return `<div class="ai-text">${esc(it.question || "")}</div>
      <div class="ai-sub">
        <span class="ai-answer">${icon("check", 13)} ${esc(right == null ? "–" : String(right))}</span>
        ${it.passage ? `<span class="ai-tag">📖 Källtext</span>` : ""}
      </div>`;
  }
  if (kind === "pairs") {
    const side = (txt, img) => `${img ? imgTag(img) : ""}${txt ? `<span>${esc(txt)}</span>` : ""}`;
    return `<div class="ai-text ai-pair">
        <span class="ai-term">${side(it.term, it.termImage)}</span>
        <span class="ai-arrow" aria-label="hör ihop med">↔</span>
        <span class="ai-def">${side(it.definition, it.defImage)}</span>
      </div>
      ${it.group ? `<div class="ai-sub"><span class="ai-tag">grupp: ${esc(it.group)}</span></div>` : ""}`;
  }
  if (kind === "timeline") {
    return `<div class="ai-text">${esc(it.event || "")}</div>
      <div class="ai-sub">
        <span class="ai-answer">${icon("check", 13)} ${esc(it.year == null ? "–" : formatYear(it.year))}</span>
        <span>${esc(it.question || "")}</span>
      </div>`;
  }
  return `<div class="ai-text">${esc(it.title || "")}</div>
    <div class="ai-sub ai-excerpt">${esc(clip(String(it.body || it.passage || "")))}</div>`;
}

/**
 * Bygg underraden för ett område.
 * @param {object} area  området som listan visar (från getAreas).
 * @param {{ subjectId:string, notice?:string, onSaved:(notice:string)=>void,
 *   tab?:string, onTabChange?:(id:string)=>void }} deps
 *   tab = senast vald flik (förvalet, tvingas fram), onTabChange = minns den.
 * @returns {HTMLElement & { selectTab:(id:string,opts?:{focus?:boolean})=>HTMLElement|null }}
 */
export function buildItemsPanel(area, { subjectId, subjectName, notice, onSaved, tab, onTabChange }) {
  const panel = el(`<div class="ai-panel" role="region" tabindex="-1" aria-label="Innehåll i ${esc(area.name)}"></div>`);
  if (notice) {
    const n = el(`<div class="msg ok ai-notice" role="status">${icon("check", 15)} ${esc(notice)}</div>`);
    panel.append(n);
    setTimeout(() => n.remove(), 4000);
  }

  // Ett formulär (eller en bekräftelse) åt gången: öppna ny → stäng föregående.
  let closeActive = null;
  const setActive = (close) => {
    if (closeActive && closeActive !== close) closeActive();
    closeActive = close;
  };

  /** Färsk kopia → ENBART ändringen → validateArea → spara hela dokumentet. */
  async function commit(op) {
    try {
      const fresh = await data.getArea(subjectId, area.id);
      if (!fresh) return { ok: false, errors: ["Området finns inte längre. Ladda om sidan."] };
      const res = applyItemOp(fresh, op);
      if (!res.ok) return res;
      await data.saveArea(subjectId, area.id, res.area);
      onSaved(SAVED[op.type][op.kind]);
      return { ok: true, errors: [] };
    } catch (err) {
      return { ok: false, errors: [`Kunde inte spara till databasen: ${err.message}`] };
    }
  }

  /** Scrolla ett öppnat formulär in i synfältet INNE i flikens scrollyta. */
  const reveal = (node) => requestAnimationFrame(() => node.isConnected && node.scrollIntoView({ block: "nearest" }));

  const ref = (it, index) => ({ index, id: it?.id, snapshot: it });
  const FORMS = { quiz: buildQuizForm, pairs: buildPairForm, texts: buildTextForm, timeline: buildTimelineForm };
  const formFor = (kind, item, o) => FORMS[kind](item, o);

  /** Gemensamma form-optioner. passage: obligatorisk om frågan har en, eller
   *  (ny fråga) om ALLA frågor i området är läsförståelse-frågor. */
  function formOpts(kind, item, onSubmit, onCancel) {
    const quiz = Array.isArray(area.quiz) ? area.quiz : [];
    const passageMode = hasPassageMode(area);
    const passageRequired = item
      ? Boolean(String(item.passage || "").trim())
      : passageMode && quiz.every((q) => String(q?.passage || "").trim());
    return { passageMode, passageRequired, onSubmit, onCancel };
  }

  function buildRow(kind, it, index, list) {
    const s = SECTION[kind];
    const li = el(`<li class="ai-item">
      <div class="ai-view">
        <span class="ai-nr">${index + 1}</span>
        <div class="ai-main">${itemHtml(kind, it)}</div>
        <div class="ai-acts">
          <button type="button" class="area-act" data-ai="edit" title="Redigera"
            aria-label="Redigera ${s.one} ${index + 1}">${icon("pencil", 15)}</button>
          <button type="button" class="area-act danger" data-ai="del" title="Ta bort"
            aria-label="Ta bort ${s.one} ${index + 1}">${icon("trash", 15)}</button>
        </div>
      </div>
      <div class="ai-slot" hidden></div>
    </li>`);
    const view = li.querySelector(".ai-view");
    const slot = li.querySelector(".ai-slot");
    const close = () => {
      slot.hidden = true;
      slot.replaceChildren();
      view.hidden = false;
      li.classList.remove("editing", "confirming");
    };

    li.querySelector('[data-ai="edit"]').addEventListener("click", () => {
      setActive(close);
      const cancel = () => {
        close();
        li.querySelector('[data-ai="edit"]').focus();
      };
      const submit = (fields) => commit({ type: "update", kind, ref: ref(it, index), fields });
      slot.replaceChildren(formFor(kind, it, formOpts(kind, it, submit, cancel)));
      view.hidden = true;
      slot.hidden = false;
      li.classList.add("editing");
      reveal(slot);
    });

    li.querySelector('[data-ai="del"]').addEventListener("click", () => {
      setActive(close);
      const warn = lastItemWarning({ [kind]: list }, kind);
      const box = el(`<div class="ai-confirm" role="alertdialog" aria-label="Bekräfta borttagning">
        <span class="ai-confirm-q">${esc(cap(`ta bort ${s.one}?`))}</span>
        ${warn ? `<span class="ai-warn">${esc(warn)}</span>` : ""}
        <div class="ai-confirm-acts">
          <button type="button" class="btn small ai-confirm-yes">${icon("trash", 14)}<span>Ta bort</span></button>
          <button type="button" class="btn ghost small ai-confirm-no">Ångra</button>
        </div>
        <div class="ai-form-errors" role="alert"></div>
      </div>`);
      const no = box.querySelector(".ai-confirm-no");
      const yes = box.querySelector(".ai-confirm-yes");
      no.addEventListener("click", () => {
        close();
        li.querySelector('[data-ai="del"]').focus();
      });
      yes.addEventListener("click", async () => {
        yes.disabled = true;
        const res = await commit({ type: "remove", kind, ref: ref(it, index) });
        if (!res.ok && box.isConnected) {
          yes.disabled = false;
          box.querySelector(".ai-form-errors").innerHTML = `<div class="msg error"><ul class="error-list">${res.errors
            .map((e) => `<li>${esc(e)}</li>`)
            .join("")}</ul></div>`;
        }
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Escape") no.click();
      });
      slot.replaceChildren(box);
      slot.hidden = false;
      li.classList.add("confirming");
      no.focus({ preventScroll: true });
      reveal(slot);
    });
    return li;
  }

  /** Flikpanel för en lista: (notisrad) · egen scrollyta med listan + formulär ·
   *  "+ Lägg till …" UTANFÖR scrollytan så den alltid syns (#455). */
  function buildSection(kind) {
    const s = SECTION[kind];
    const list = Array.isArray(area[kind]) ? area[kind] : [];
    const sec = el(`<section class="ai-section ai-section-${kind}">
      <div class="ai-scroll" tabindex="0" role="group" aria-label="${esc(s.title)}">
        <ol class="ai-list"></ol>
        <div class="ai-add-slot" hidden></div>
      </div>
      <button type="button" class="ai-add" aria-expanded="false">${icon("plus", 14)}<span>${esc(s.add)}</span></button>
    </section>`);
    if (kind === "quiz" && hasPassageMode(area)) {
      sec.prepend(el(`<p class="ai-tabnote">📖 Frågor med källtext används även i Läsförståelse.</p>`));
    }
    if (kind === "timeline") sec.prepend(buildSpanEditor(list));
    const ol = sec.querySelector(".ai-list");
    list.forEach((it, i) => ol.append(buildRow(kind, it, i, list)));
    if (!list.length) ol.replaceWith(el(`<p class="ai-empty">Inga ${esc(s.title.toLowerCase())} ännu.</p>`));

    const addBtn = sec.querySelector(".ai-add");
    const addSlot = sec.querySelector(".ai-add-slot");
    const closeAdd = () => {
      addSlot.hidden = true;
      addSlot.replaceChildren();
      addBtn.setAttribute("aria-expanded", "false");
    };
    sec.openAdd = () => {
      if (!addSlot.hidden) {
        reveal(addSlot);
        addSlot.querySelector("input, textarea, select")?.focus({ preventScroll: true });
        return;
      }
      setActive(closeAdd);
      const cancel = () => {
        closeAdd();
        addBtn.focus();
      };
      const submit = (fields) => commit({ type: "add", kind, fields });
      addSlot.replaceChildren(formFor(kind, null, formOpts(kind, null, submit, cancel)));
      addSlot.hidden = false;
      addBtn.setAttribute("aria-expanded", "true");
      reveal(addSlot);
    };
    addBtn.addEventListener("click", sec.openAdd);
    return sec;
  }

  /** Tidsspannet (#598): från/till + minitidslinje som följer fälten direkt.
   *  Tomt = automatiskt (händelsernas spann med marginal, som elevens linje). */
  function buildSpanEditor(list) {
    const span = area.timelineSpan || null;
    const box = el(`<form class="ai-span" novalidate aria-label="Tidslinjens spann">
      <div class="ai-span-row">
        <span class="ai-span-label">Tidslinjens spann</span>
        <label>Från <input type="number" step="1" name="from" value="${esc(span?.from ?? "")}" /></label>
        <label>Till <input type="number" step="1" name="to" value="${esc(span?.to ?? "")}" /></label>
        <button type="submit" class="btn gron small ai-span-save">${icon("save", 14)}<span>Spara spann</span></button>
        <button type="button" class="btn ghost small ai-span-auto"${span ? "" : " disabled"}>Automatiskt</button>
      </div>
      <div class="ai-span-preview">${miniTimelineHtml(list, span)}</div>
      <p class="ai-hint">Negativt år = f.Kr. Lämna tomt (Automatiskt) så räcker linjen över alla händelser
        med lite marginal. Spannet ska passa hela området – inte centreras kring ett svar.</p>
      <div class="ai-form-errors" role="alert" aria-live="polite"></div>
    </form>`);
    const from = box.elements.from;
    const to = box.elements.to;
    const preview = box.querySelector(".ai-span-preview");
    const errBox = box.querySelector(".ai-form-errors");
    const refresh = () => (preview.innerHTML = miniTimelineHtml(list, { from: from.value, to: to.value }));
    from.addEventListener("input", refresh);
    to.addEventListener("input", refresh);
    async function save(next, btn) {
      btn.disabled = true;
      errBox.innerHTML = "";
      const res = await commit({ type: "span", kind: "timeline", span: next });
      if (!res.ok && box.isConnected) {
        btn.disabled = false;
        errBox.innerHTML = `<div class="msg error"><div>Kunde inte spara spannet. Rätta det här:</div>
          <ul class="error-list">${res.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
      }
    }
    box.addEventListener("submit", (e) => {
      e.preventDefault();
      save({ from: from.value, to: to.value }, box.querySelector(".ai-span-save"));
    });
    box.querySelector(".ai-span-auto").addEventListener("click", (e) => save(null, e.currentTarget));
    return box;
  }

  // --- Räknegenerator: kort rad, ändras via pennan (wizarden) ----------------
  if (isGeneratorArea(area)) {
    const g = generatorSummary(area.generator);
    const variants = g.variants;
    panel.append(el(`<div class="ai-generator">${icon("sliders", 16)}
      <span><b>Räknegenerator:</b> ${esc(g.topics)}${variants ? ` · ${variants} variant${variants > 1 ? "er" : ""}` : ""}</span>
      <span class="ai-hint">Ändras via pennan (Redigera).</span></div>`));
  }

  // --- Flikar (#455): Quiz & läsförståelse · Para ihop · Lästexter -------------
  const tabDef = (t) => ({ ...TAB[t.id], id: t.id, count: t.count });
  const tabList = tabsFor(area, tab ? [tab] : []);
  const tabs = createTabs({
    ariaLabel: `Innehåll i ${area.name}`,
    tabs: tabList.map(tabDef),
    order: ITEM_TABS,
    active: pickTab(tabList, tab),
    render: (id) => (id === "amnes" ? buildAmnesSection(area, { subjectId, subjectName, onSaved }) : buildSection(id)),
    onChange: (id) => onTabChange?.(id),
  });

  /** Visa (och vid behov lägg till) en flik – används av "+ Lästext". */
  function selectTab(id, { focus = false } = {}) {
    if (!tabs.has(id)) tabs.add(tabDef(tabsFor(area, [id]).find((t) => t.id === id)));
    const p = tabs.select(id, { focus });
    onTabChange?.(id);
    return p;
  }

  // Lästexter är ingen övningstyp – saknas de finns "+ Lästext" sist i flikraden.
  if (!tabs.has("texts") && !isGeneratorArea(area)) {
    const addText = el(`<button type="button" class="ai-tab-add">${icon("plus", 13)}<span>Lästext</span></button>`);
    addText.title = "Lägg till lästext";
    addText.addEventListener("click", () => {
      addText.remove();
      selectTab("texts", { focus: true }).querySelector(".ai-section")?.openAdd();
    });
    tabs.row.append(addText);
  }

  if (tabList.length || tabs.row.querySelector(".ai-tab-add")) panel.append(tabs.root);
  if (!tabList.length && !isGeneratorArea(area)) {
    panel.append(el(`<p class="hint">Området har inget innehåll ännu. Klicka pennan för att välja övningstyper.</p>`));
  }
  panel.selectTab = selectTab;
  return panel;
}
