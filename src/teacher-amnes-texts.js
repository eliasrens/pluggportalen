// ============================================================================
// Pluggporten – lärarsidan: fliken "📖 Ämnesläsning" i områdets underrad
// (teacher-amnes-texts.js, issue #673, spec §6.3)
// ----------------------------------------------------------------------------
// Områdets ämnestexter (area.readingTexts) grupperade per nivå, med antal per
// nivå och en varning när en nivå saknar texter (eller har för få). Per text:
//   👁 förhandsgranska i Läsresans läsvy (teacher-amnes-preview.js)
//   ✏️ redigera titel, nivå, typ, text, frågor, alternativ, rätt svar, kategori
//   🗑 ta bort (bekräftas inne i sidan, två steg)
// Överst knappen "📖 Skapa ämnestexter" som fäller ut panelen
// (teacher-amnes-create.js).
//
// SPARNING (samma kontrakt som teacher-area-items.js): färsk kopia → ENBART
// ändringen (src/amneslasning/content.js) → validateArea som grind → saveArea
// med hela dokumentet → onSaved(notis) laddar om tabellen tyst.
// Laddas BARA via import() (#271) – aldrig i den statiska bootgrafen.
// ============================================================================

import * as data from "./data.js";
import { validateArea } from "./validate.js";
import {
  AMNES_LEVELS,
  CATEGORIES,
  OPTIONS_PER_QUESTION,
  blankQuestion,
  levelGaps,
  readingTextsOf,
  removeReadingText,
  updateReadingText,
  wordCount,
} from "./amneslasning/content.js";
import { AMNES_QUESTIONS_BY_LEVEL, AMNES_WORD_RANGES, CATEGORY_LABELS } from "./lasresan/config.js";
import { buildAmnesCreatePanel } from "./teacher-amnes-create.js";
import { openReaderPreview, textMetaHtml } from "./teacher-amnes-preview.js";
import { el, esc, icon } from "./teacher-shared.js";

let uid = 0;
const nextUid = () => `amn-f${++uid}`;
const errList = (intro, errors) =>
  `<div class="msg error"><div>${esc(intro)}</div><ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;

/** "84 ord (riktlinje 80–150)" för redigeringsformulärets textruta. */
function wordHint(body, level) {
  const n = wordCount(body);
  const r = AMNES_WORD_RANGES[level];
  if (!r) return `${n} ord`;
  const out = n < r[0] || n > r[1];
  return `${n} ord (riktlinje nivå ${level}: ${r[0]}–${r[1]})${out ? " ⚠️" : ""}`;
}

/** Ett frågeblock i redigeringsformuläret. */
function questionHtml(q, nr) {
  const g = nextUid();
  const opts = Array.from({ length: OPTIONS_PER_QUESTION }, (_, i) => String(q.options?.[i] ?? ""));
  return `<fieldset class="amn-q" data-qid="${esc(q.id)}">
    <legend>Fråga ${nr}</legend>
    <button type="button" class="area-act danger amn-q-del" title="Ta bort frågan" aria-label="Ta bort fråga ${nr}">${icon("trash", 15)}</button>
    <div class="ai-field"><label for="${g}-q">Frågan</label>
      <input id="${g}-q" type="text" name="question" autocomplete="off" value="${esc(q.question)}" /></div>
    <div class="ai-field"><span class="amn-sub">Alternativ – markera det rätta</span>
      ${opts.map((o, i) => `<div class="ai-opt">
        <input type="radio" name="${g}-answer" value="${i}" id="${g}-${i}"${i === q.answerIndex ? " checked" : ""}
          aria-label="Alternativ ${i + 1} är rätt svar" />
        <label for="${g}-${i}" class="ai-opt-nr">${"ABCD"[i] || i + 1}</label>
        <input type="text" name="opt" autocomplete="off" value="${esc(o)}" aria-label="Svarsalternativ ${i + 1}" />
      </div>`).join("")}
    </div>
    <div class="ai-field"><label for="${g}-c">Kategori</label>
      <select id="${g}-c" name="category" class="select">
        ${CATEGORIES.map((c) => `<option value="${c}"${c === q.category ? " selected" : ""}>${esc(CATEGORY_LABELS[c] || c)}</option>`).join("")}
        ${q.category && !CATEGORIES.includes(q.category) ? `<option value="${esc(q.category)}" selected>${esc(q.category)} (okänd)</option>` : ""}
      </select></div>
  </fieldset>`;
}

/**
 * Redigeringsformuläret för EN ämnestext. onSubmit(fields) → { ok, errors }.
 */
function buildEditForm(text, { onSubmit, onCancel }) {
  const g = nextUid();
  const f = el(`<form class="ai-form amn-edit" novalidate>
    <div class="ai-form-title">Redigera ämnestext</div>
    <div class="ai-form-grid">
      <div class="ai-field"><label for="${g}-t">Rubrik</label>
        <input id="${g}-t" type="text" name="title" autocomplete="off" value="${esc(text.title)}" /></div>
      <div class="ai-form-2col">
        <div class="ai-field"><label for="${g}-l">Nivå</label>
          <select id="${g}-l" name="level" class="select">
            ${AMNES_LEVELS.map((l) => `<option value="${l}"${l === text.level ? " selected" : ""}>Nivå ${l}</option>`).join("")}
          </select></div>
        <div class="ai-field"><label for="${g}-y">Typ av text</label>
          <select id="${g}-y" name="textType" class="select">
            <option value="fact"${text.textType !== "story" ? " selected" : ""}>Faktatext</option>
            <option value="story"${text.textType === "story" ? " selected" : ""}>Berättelse</option>
          </select></div>
      </div>
      <div class="ai-field"><label for="${g}-b">Text <span class="ai-hint amn-words"></span></label>
        <textarea id="${g}-b" name="body" rows="9">${esc(text.body)}</textarea>
        <span class="ai-hint">Stycken separeras med en tom rad.</span></div>
      <div class="amn-qs-head"><span class="amn-sub">Frågor <span class="amn-qcount"></span></span></div>
      <div class="amn-qs">${(text.questions || []).map((q, i) => questionHtml(q, i + 1)).join("")}</div>
      <button type="button" class="ai-add amn-q-add">${icon("plus", 14)}<span>Lägg till fråga</span></button>
    </div>
    <div class="ai-form-errors" role="alert" aria-live="polite"></div>
    <div class="ai-form-actions">
      <button type="submit" class="btn gron small ai-save">${icon("save", 15)}<span>Spara</span></button>
      <button type="button" class="btn ghost small ai-cancel">Avbryt</button>
    </div>
  </form>`);
  const qs = f.querySelector(".amn-qs");
  const levelOf = () => Number(f.elements.level.value);
  const refresh = () => {
    f.querySelector(".amn-words").textContent = `– ${wordHint(f.elements.body.value, levelOf())}`;
    const n = qs.children.length;
    const [lo, hi] = AMNES_QUESTIONS_BY_LEVEL[levelOf()] || [0, 99];
    f.querySelector(".amn-qcount").textContent = `(${n}, riktlinje ${lo}–${hi}${n < lo || n > hi ? " ⚠️" : ""})`;
    [...qs.children].forEach((fs, i) => (fs.querySelector("legend").textContent = `Fråga ${i + 1}`));
  };
  f.elements.body.addEventListener("input", refresh);
  f.elements.level.addEventListener("change", refresh);
  qs.addEventListener("click", (e) => {
    if (!e.target.closest(".amn-q-del")) return;
    e.target.closest(".amn-q").remove();
    refresh();
  });
  f.querySelector(".amn-q-add").addEventListener("click", () => {
    const used = new Set([...qs.children].map((x) => x.dataset.qid));
    let n = qs.children.length + 1;
    while (used.has(`q${n}`)) n++;
    qs.insertAdjacentHTML("beforeend", questionHtml(blankQuestion(n), qs.children.length + 1));
    refresh();
    qs.lastElementChild.querySelector('input[name="question"]').focus();
  });
  refresh();

  const collect = () => ({
    title: f.elements.title.value,
    level: levelOf(),
    textType: f.elements.textType.value,
    body: f.elements.body.value,
    questions: [...qs.children].map((fs) => {
      const checked = fs.querySelector('input[type="radio"]:checked');
      return {
        id: fs.dataset.qid,
        question: fs.querySelector('input[name="question"]').value,
        options: [...fs.querySelectorAll('input[name="opt"]')].map((x) => x.value),
        answerIndex: checked ? Number(checked.value) : -1,
        category: fs.querySelector('select[name="category"]').value,
      };
    }),
  });
  const errBox = f.querySelector(".ai-form-errors");
  const saveBtn = f.querySelector(".ai-save");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.innerHTML = "";
    saveBtn.disabled = true;
    try {
      const res = await onSubmit(collect());
      if (!res?.ok && f.isConnected) errBox.innerHTML = errList("Kunde inte spara. Rätta det här:", res?.errors || ["Okänt fel."]);
    } finally {
      if (f.isConnected) saveBtn.disabled = false;
    }
  });
  f.querySelector(".ai-cancel").addEventListener("click", onCancel);
  f.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  });
  queueMicrotask(() => f.elements.title.focus());
  return f;
}

/**
 * Fliken Ämnesläsning.
 * @param {object} area
 * @param {{ subjectId:string, subjectName?:string, onSaved:(notice:string)=>void }} deps
 * @returns {HTMLElement & { openCreate:()=>void }}
 */
export function buildAmnesSection(area, { subjectId, subjectName, onSaved }) {
  const texts = readingTextsOf(area);
  const sec = el(`<section class="ai-section amn-section">
    <div class="amn-top">
      <p class="ai-tabnote">📖 Läsförståelsetexter om området på ${AMNES_LEVELS.length} nivåer. Eleven får texter på sin egen läsnivå.</p>
      <button type="button" class="btn gron small amn-open-create" aria-expanded="false">📖 <span>Skapa ämnestexter</span></button>
    </div>
    <div class="amn-create-slot" hidden></div>
    <div class="amn-gaps"></div>
    <div class="ai-scroll amn-scroll" tabindex="0" role="group" aria-label="Ämnestexter per nivå"></div>
  </section>`);
  const createBtn = sec.querySelector(".amn-open-create");
  const createSlot = sec.querySelector(".amn-create-slot");
  const scroll = sec.querySelector(".amn-scroll");

  const gaps = levelGaps(texts);
  if (gaps.length) {
    sec.querySelector(".amn-gaps").innerHTML = `<div class="msg warn amn-gap-msg" role="status">
      <ul class="error-list">${gaps.map((g) => `<li>⚠️ ${esc(g.message)}</li>`).join("")}</ul></div>`;
  }

  let closeActive = null;
  const setActive = (close) => {
    if (closeActive && closeActive !== close) closeActive();
    closeActive = close;
  };

  async function commit(change, notice) {
    try {
      const fresh = await data.getArea(subjectId, area.id);
      if (!fresh) return { ok: false, errors: ["Området finns inte längre. Ladda om sidan."] };
      const next = change(fresh);
      const res = validateArea(next);
      if (!res.ok) return { ok: false, errors: res.errors };
      await data.saveArea(subjectId, area.id, next);
      onSaved(notice);
      return { ok: true, errors: [] };
    } catch (err) {
      return { ok: false, errors: [err.message] };
    }
  }

  function row(t, nr) {
    const li = el(`<li class="ai-item amn-row">
      <div class="ai-view">
        <span class="ai-nr">${nr}</span>
        <div class="ai-main">
          <div class="ai-text">${esc(t.title)}</div>
          <div class="ai-sub">${textMetaHtml(t)}</div>
        </div>
        <div class="ai-acts">
          <button type="button" class="area-act" data-a="preview" title="Förhandsgranska som eleven ser den"
            aria-label="Förhandsgranska ${esc(t.title)}">${icon("eye", 15)}</button>
          <button type="button" class="area-act" data-a="edit" title="Redigera" aria-label="Redigera ${esc(t.title)}">${icon("pencil", 15)}</button>
          <button type="button" class="area-act danger" data-a="del" title="Ta bort" aria-label="Ta bort ${esc(t.title)}">${icon("trash", 15)}</button>
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
    const btn = (a) => li.querySelector(`[data-a="${a}"]`);
    btn("preview").addEventListener("click", (e) => openReaderPreview(t, { returnFocus: e.currentTarget }));
    btn("edit").addEventListener("click", () => {
      setActive(close);
      const cancel = () => {
        close();
        btn("edit").focus();
      };
      const submit = (fields) => commit((fresh) => updateReadingText(fresh, t.id, fields), `Texten "${fields.title || t.title}" sparades.`);
      slot.replaceChildren(buildEditForm(t, { onSubmit: submit, onCancel: cancel }));
      view.hidden = true;
      slot.hidden = false;
      li.classList.add("editing");
      requestAnimationFrame(() => slot.isConnected && slot.scrollIntoView({ block: "nearest" }));
    });
    btn("del").addEventListener("click", () => {
      setActive(close);
      const box = el(`<div class="ai-confirm" role="alertdialog" aria-label="Bekräfta borttagning">
        <span class="ai-confirm-q">Ta bort "${esc(t.title)}"?</span>
        ${texts.filter((x) => x.level === t.level).length === 1 ? `<span class="ai-warn">Nivå ${t.level} har då inga texter kvar.</span>` : ""}
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
        btn("del").focus();
      });
      yes.addEventListener("click", async () => {
        yes.disabled = true;
        const res = await commit((fresh) => removeReadingText(fresh, t.id), `Texten "${t.title}" togs bort.`);
        if (!res.ok && box.isConnected) {
          yes.disabled = false;
          box.querySelector(".ai-form-errors").innerHTML = errList("Kunde inte ta bort:", res.errors);
        }
      });
      box.addEventListener("keydown", (e) => e.key === "Escape" && no.click());
      slot.replaceChildren(box);
      slot.hidden = false;
      li.classList.add("confirming");
      no.focus({ preventScroll: true });
    });
    return li;
  }

  for (const level of AMNES_LEVELS) {
    const list = texts.filter((t) => t.level === level);
    const group = el(`<div class="amn-group">
      <h5 class="amn-level-h">Nivå ${level} <span class="amn-level-n${list.length ? "" : " none"}">${list.length} text${list.length === 1 ? "" : "er"}</span></h5>
    </div>`);
    if (list.length) {
      const ol = el(`<ol class="ai-list"></ol>`);
      list.forEach((t, i) => ol.append(row(t, i + 1)));
      group.append(ol);
    } else {
      group.append(el(`<p class="ai-empty">Inga texter på nivå ${level} ännu.</p>`));
    }
    scroll.append(group);
  }

  const closeCreate = () => {
    createSlot.hidden = true;
    createSlot.replaceChildren();
    createBtn.setAttribute("aria-expanded", "false");
  };
  sec.openCreate = () => {
    if (!createSlot.hidden) {
      createSlot.scrollIntoView({ block: "nearest" });
      return;
    }
    setActive(closeCreate);
    createSlot.replaceChildren(
      buildAmnesCreatePanel(area, {
        subjectId,
        subjectName,
        onSaved,
        onClose: () => {
          closeCreate();
          createBtn.focus();
        },
      })
    );
    createSlot.hidden = false;
    createBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => createSlot.isConnected && createSlot.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  createBtn.addEventListener("click", () => (createSlot.hidden ? sec.openCreate() : closeCreate()));
  return sec;
}
