// ============================================================================
// Pluggporten – lärarsidan: Läsresan-nivåstyrning (teacher-lasresan-niva.js)
// ----------------------------------------------------------------------------
// Issue #506 (epic #482, spec §2–4). Tre kontroller ovanpå #505:s brygga
// (data-lasresan-niva.js):
//   * renderLevelPanel – två kort ovanför Läsresan-tabellen:
//       "Ändra klassens startnivå"  (nya elever + elever som inte börjat)
//       "Ändra nivå för hela klassen" (även elever som är igång) → bekräftelse-
//       dialog med klass, antal elever och nivå → resultat
//   * renderStudentLevelControl – "Ändra nivå" i elevdetaljen
//     (teacher-lasresan-elev.js): nuvarande nivå, väntande nivå, välj 1–10, Spara
// Texterna kommer ur den rena modulen lasresan/teacher-niva.js. CSS-prefix lrn-.
//
// Laddas bara via teacher-lasresan.js (som själv laddas dynamiskt) – aldrig i
// app.js statiska bootgraf (#271). Firestore-bryggan importeras lat, och kan
// injiceras (`api`) så preview-lasresan-larare.html kör utan Firebase.
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import {
  LEVELS,
  LEVEL_RANGE_ERROR,
  NEW_LEVELS_HINT,
  classConfirmText,
  classResultText,
  classStudentIds,
  levelCell,
  parseTeacherLevel,
  startLevelInfo,
  startSavedText,
  studentLevelStatus,
  studentSavedText,
} from "./lasresan/teacher-niva.js";
import { classStartLevelFields } from "./lasresan/level-scale.js";

/** Standard-API: #505:s Firestore-brygga, laddad först vid sparning. */
const lazy = (name) => async (...args) => (await import("./data-lasresan-niva.js"))[name](...args);
export const DEFAULT_LEVEL_API = {
  setStudentLevel: lazy("setStudentLevel"),
  setClassLevel: lazy("setClassLevel"),
  setClassStartLevel: lazy("setClassStartLevel"),
};

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

const levelOptions = (selected) =>
  LEVELS.map((n) => `<option value="${n}"${n === selected ? " selected" : ""}>Nivå ${n}</option>`).join("");

/** Skriv ett meddelande i en status-ruta (role=status läser upp det). */
function say(box, kind, lines) {
  const list = Array.isArray(lines) ? lines : [lines];
  box.innerHTML = list.length ? `<div class="msg ${kind}">${list.map(esc).join("<br>")}</div>` : "";
}

/** Kör en sparning med knappen låst och "Sparar…" som text. */
async function busy(btn, fn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Sparar…";
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}

/**
 * Bekräftelsedialog (modal, role=alertdialog). Fokus börjar på "Avbryt";
 * Escape/klick utanför = avbryt; Tab stannar i dialogen; fokus tillbaka efteråt.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, facts, body, confirm }) {
  const back = document.activeElement;
  const tid = nextId("lrn-cf-title");
  const bid = nextId("lrn-cf-body");
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lrn-confirm" role="alertdialog" aria-modal="true"
      aria-labelledby="${tid}" aria-describedby="${bid}">
    <div class="cx-modal lrn-confirm-box">
      <h2 class="lrn-confirm-title" id="${tid}">${esc(title)}</h2>
      <dl class="lrn-facts">${facts
        .map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`)
        .join("")}</dl>
      <p class="lrn-confirm-body" id="${bid}">${esc(body)}</p>
      <div class="lrn-confirm-actions">
        <button type="button" class="btn ghost" data-svar="nej">Avbryt</button>
        <button type="button" class="btn" data-svar="ja">${esc(confirm)}</button>
      </div>
    </div>
  </div>`);
  return new Promise((resolve) => {
    const buttons = [...overlay.querySelectorAll("button")];
    const done = (answer) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      if (back && back.isConnected) back.focus();
      resolve(answer);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        done(false);
      } else if (e.key === "Tab") {
        const i = buttons.indexOf(document.activeElement);
        e.preventDefault();
        buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) return done(false);
      const b = e.target.closest("[data-svar]");
      if (b) done(b.dataset.svar === "ja");
    });
    // capture: Escape ska stänga dialogen, inte elevdetaljen bakom.
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    buttons[0].focus();
  });
}

/**
 * Klassens två nivåkort ovanför tabellen.
 * @param {HTMLElement} host
 * @param {{
 *   cls: object,                // aktuell klass (muteras: startnivåfälten efter sparning)
 *   classes?: object[],         // lärarens klasser för klassväljaren (förvald = cls)
 *   studentById?: Map,          // id → elev (namn i felrader, filtrerar bort borttagna elever)
 *   api?: typeof DEFAULT_LEVEL_API,
 *   onChanged?: () => void,     // aktuell klass ändrad → tabellen läses om
 * }} opts
 */
export function renderLevelPanel(host, { cls, classes, studentById, api = DEFAULT_LEVEL_API, onChanged = () => {} }) {
  const all = (Array.isArray(classes) && classes.length ? classes : [cls]).filter(Boolean);
  if (!all.some((c) => c.id === cls.id)) all.unshift(cls);
  const nameOfClass = (c) => c.name || c.id;
  const nameOfStudent = (id) => {
    const s = studentById && studentById.get(id);
    return (s && (s.namn || s.username)) || id;
  };
  const ids = { start: nextId("lrn-start"), klass: nextId("lrn-klass"), niva: nextId("lrn-niva") };
  const info = startLevelInfo(cls);

  const view = el(`<section class="lrn-panel" aria-label="Nivåstyrning för Läsresan">
    <div class="lrn-card">
      <h4 class="lrn-card-title">${icon("sliders", 16)}<span>Ändra klassens startnivå</span></h4>
      <p class="lrn-what">Gäller <b>nya elever</b> och elever som <b>inte har börjat</b> Läsresan.
        Elever som redan är igång påverkas inte.</p>
      <p class="hint lrn-scale">${esc(NEW_LEVELS_HINT)}</p>
      <p class="lrn-now">Nuvarande startnivå för ${esc(nameOfClass(cls))}: <b class="lrn-start-now">${esc(info.text)}</b></p>
      <div class="lrn-row">
        <label for="${ids.start}">Startnivå</label>
        <select id="${ids.start}" class="lrn-start-sel">${levelOptions(info.level)}</select>
        <button type="button" class="btn small lrn-start-save">Spara startnivå</button>
      </div>
      <div class="lrn-msg" role="status" aria-live="polite"></div>
    </div>
    <div class="lrn-card">
      <h4 class="lrn-card-title">${icon("users", 16)}<span>Ändra nivå för hela klassen</span></h4>
      <p class="lrn-what">Ändrar <b>även elever som redan är igång</b>. En påbörjad text läses klart först.
        Resultat och pluggcoins finns kvar, och du kan ändra enskilda elever efteråt.</p>
      <div class="lrn-row">
        <label for="${ids.klass}">Klass</label>
        <select id="${ids.klass}" class="lrn-class-sel">${all
          .map((c) => `<option value="${esc(c.id)}"${c.id === cls.id ? " selected" : ""}>${esc(nameOfClass(c))}</option>`)
          .join("")}</select>
        <label for="${ids.niva}">Nivå</label>
        <select id="${ids.niva}" class="lrn-class-lvl">${levelOptions(info.level)}</select>
        <button type="button" class="btn small lrn-class-go">Ändra nivå för klassen…</button>
      </div>
      <div class="lrn-msg" role="status" aria-live="polite"></div>
    </div>
  </section>`);
  const [startCard, classCard] = view.querySelectorAll(".lrn-card");
  const startMsg = startCard.querySelector(".lrn-msg");
  const classMsg = classCard.querySelector(".lrn-msg");

  // --- Klassens startnivå -------------------------------------------------
  const startBtn = startCard.querySelector(".lrn-start-save");
  startBtn.addEventListener("click", async () => {
    const level = parseTeacherLevel(startCard.querySelector(".lrn-start-sel").value);
    if (level === null) return say(startMsg, "error", LEVEL_RANGE_ERROR);
    try {
      const saved = await busy(startBtn, () => api.setClassStartLevel(cls.id, level));
      Object.assign(cls, classStartLevelFields(saved));
      startCard.querySelector(".lrn-start-now").textContent = startLevelInfo(cls).text;
      say(startMsg, "ok", startSavedText(nameOfClass(cls), saved));
      onChanged();
    } catch (err) {
      say(startMsg, "error", `Kunde inte spara startnivån: ${err.message}`);
    }
  });

  // --- Hela klassen -------------------------------------------------------
  const goBtn = classCard.querySelector(".lrn-class-go");
  goBtn.addEventListener("click", async () => {
    const target = all.find((c) => c.id === classCard.querySelector(".lrn-class-sel").value) || cls;
    const level = parseTeacherLevel(classCard.querySelector(".lrn-class-lvl").value);
    if (level === null) return say(classMsg, "error", LEVEL_RANGE_ERROR);
    const studentIds = classStudentIds(target, studentById);
    const className = nameOfClass(target);
    if (studentIds.length === 0) return say(classMsg, "warn", `${className} har inga elever.`);
    say(classMsg, "", []);
    const ok = await confirmDialog(classConfirmText({ className, count: studentIds.length, level }));
    if (!ok) return;
    try {
      const result = await busy(goBtn, () => api.setClassLevel(studentIds, level));
      const { ok: allOk, lines } = classResultText(result, className, nameOfStudent);
      say(classMsg, allOk ? "ok" : "warn", [`${allOk ? "✓ " : ""}${lines[0]}`, ...lines.slice(1)]);
      if (target.id === cls.id) onChanged();
    } catch (err) {
      say(classMsg, "error", `Kunde inte ändra nivån: ${err.message}`);
    }
  });

  host.replaceChildren(view);
}

/**
 * "Ändra nivå" i elevdetaljen.
 * @param {HTMLElement} host
 * @param {{
 *   student: object, row: object, lasresa: (object|null),
 *   api?: typeof DEFAULT_LEVEL_API,
 *   onSaved?: (studentId:string) => Promise<{row:object, lasresa:(object|null)}|void>,
 * }} opts  onSaved läser om eleven (tabellen ritas om) och ger den nya raden.
 */
export function renderStudentLevelControl(host, { student, row, lasresa, api = DEFAULT_LEVEL_API, onSaved }) {
  const name = student.namn || student.username || student.id;
  const selId = nextId("lrn-elev");
  const box = el(`<div class="lrn-student">
    <p class="lrn-now">Nuvarande nivå: <b class="lrn-cur"></b><span class="lrn-pending-badge" hidden></span></p>
    <p class="hint lrn-status"></p>
    <div class="lrn-row">
      <label for="${selId}">Ny nivå</label>
      <select id="${selId}" class="lrn-student-sel"></select>
      <button type="button" class="btn small lrn-student-save">Spara nivå</button>
    </div>
    <div class="lrn-msg" role="status" aria-live="polite"></div>
  </div>`);
  const msg = box.querySelector(".lrn-msg");
  const sel = box.querySelector("select");

  const paint = (r, l) => {
    const cell = levelCell(r);
    box.querySelector(".lrn-cur").textContent = `Nivå ${r.level}`;
    const badge = box.querySelector(".lrn-pending-badge");
    badge.hidden = cell.pending === null;
    badge.textContent = cell.pending === null ? "" : `Väntande nivå ${cell.pending}`;
    box.querySelector(".lrn-status").textContent = studentLevelStatus(r, l);
    sel.innerHTML = levelOptions(cell.pending ?? r.level);
  };
  paint(row, lasresa);

  const btn = box.querySelector(".lrn-student-save");
  btn.addEventListener("click", async () => {
    const level = parseTeacherLevel(sel.value);
    if (level === null) return say(msg, "error", LEVEL_RANGE_ERROR);
    try {
      const res = await busy(btn, () => api.setStudentLevel(student.id, level));
      say(msg, "ok", studentSavedText(name, res));
      const fresh = onSaved && (await onSaved(student.id));
      if (fresh && fresh.row) paint(fresh.row, fresh.lasresa);
    } catch (err) {
      say(msg, "error", `Kunde inte spara nivån: ${err.message}`);
    }
  });
  host.replaceChildren(box);
}
