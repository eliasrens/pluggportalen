// ============================================================================
// Live – lärarens "Skapa Live-match" (#460, formatväljaren #548)
// ----------------------------------------------------------------------------
// Flödet (spec §3.4), allt ur registren – inget hårdkodat per format:
//   1. format       stora kort ur formatregistret (live-formats.js). Bara ETT
//                   registrerat format → inget val visas, det är auto-valt.
//   2. innehåll     spellägen där formatets compatibleGameModes stämmer
//   3. svarssätt    bara om formatet + spelläget har fler än ett gemensamt
//                   (answerKindsFor) – annars inget val
//   4. klasser      inom formatets minClasses–maxClasses
//   5. inställningar formatets setupFields, ritade generiskt (live-setup-
//                   fields.js; matchlängden vid pacing "tid")
//   6. Skapa        → status "lobby" → lobbyn öppnas direkt
// Klassmatchen är förvald (DEFAULT_FORMAT): samma fält, samma ordning och
// samma antal klick som före #548 (nämnare, trollkarlsval #536, matchlängd,
// mynt-pris #526 är Klassmatchens setupFields).
//
// API: renderCreateForm(host, { classes, uid, createdByName, onCreated(sid) })
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { listGameModes, DEFAULT_GAME_MODE } from "./modes/index.js";
import { requireFormat, listFormats, answerKindsFor, DEFAULT_FORMAT } from "./formats/index.js";
import { createLiveSession } from "./live-data.js";
import { validateSessionInput } from "./live-core.js";
import { defaultSessionName } from "./formats/klassmatch/klassmatch-core.js";
import {
  fieldsFor, setupFieldsHtml, perClassRowsHtml, coerceSetupValue, formatPickerHtml, answerKindHtml, classHint,
} from "./live-setup-fields.js";

export function renderCreateForm(host, opts) {
  const keep = { formatId: DEFAULT_FORMAT, classIds: [], name: "", nameTouched: false, mode: null, perClass: {} };
  drawForm(host, opts, keep);
}

function drawForm(host, { classes, uid, createdByName, onCreated }, keep) {
  const format = requireFormat(keep.formatId);
  const modes = listGameModes().filter((m) => format.compatibleGameModes(m));
  const fields = fieldsFor(format);
  const modeId = modes.some((m) => m.id === keep.mode) ? keep.mode
    : modes.some((m) => m.id === DEFAULT_GAME_MODE) ? DEFAULT_GAME_MODE : modes[0]?.id;
  const form = el(`<form class="panel live-form" novalidate>
    <h2 class="live-h2">Skapa Live-match</h2>
    ${formatPickerHtml(listFormats(), format.id)}
    <div class="field"><label>Spelläge</label>
      <div class="live-modes">${modes.map((m) => `<label class="live-chip">
        <input type="radio" name="mode" value="${esc(m.id)}" ${m.id === modeId ? "checked" : ""} />
        <span>${esc(m.icon)} ${esc(m.displayName)}</span></label>`).join("")}</div>
    </div>
    <div class="field live-answerkind" hidden></div>
    <div class="field"><label>Klasser <small class="hint">(${esc(classHint(format))})</small></label>
      <div class="live-classes">${classes.map((c) => `<label class="live-chip">
        <input type="checkbox" name="klass" value="${esc(c.id)}" ${keep.classIds.includes(c.id) ? "checked" : ""} />
        <span>${esc(c.name || c.id)} <small>(${(c.studentIds || []).length})</small></span></label>`).join("") ||
        `<p class="hint">Inga klasser ännu – skapa klasser under Klasser &amp; elever.</p>`}</div>
    </div>
    ${setupFieldsHtml(fields)}
    <div class="field"><label for="live-name">Matchnamn</label>
      <input id="live-name" maxlength="80" placeholder="t.ex. 4B mot 5E" /></div>
    <div class="live-form-msg"></div>
    <button class="btn stor gron" type="submit">Skapa lobby</button>
  </form>`);
  host.replaceChildren(form);

  const byId = new Map(classes.map((c) => [c.id, c]));
  const className = (id) => byId.get(id)?.name || id;
  const nameInput = form.querySelector("#live-name");
  nameInput.value = keep.name;
  nameInput.addEventListener("input", () => { keep.nameTouched = true; keep.name = nameInput.value; });
  const boxOf = (f) => form.querySelector(`[data-field="${CSS.escape(f.key)}"]`);
  const selected = () => [...form.querySelectorAll('input[name="klass"]:checked')].map((i) => i.value);
  const selectedMode = () => modes.find((m) => m.id === form.querySelector('input[name="mode"]:checked')?.value);

  // Formatets egna sektioner (custom) laddas latt och synkas när de kommit.
  const customs = fields.filter((f) => f.kind === "custom").map((f) => ({ f, api: null }));
  for (const c of customs) {
    const box = boxOf(c.f);
    c.f.load().then((m) => {
      if (!box.isConnected) return;
      c.api = m.mount(box, box.querySelector(".live-setup-custom"), { className });
      c.api.sync(selected());
    }).catch((err) => console.warn(`Live: ${c.f.key} kunde inte laddas`, err));
  }

  function syncAnswerKinds() {
    const box = form.querySelector(".live-answerkind");
    const prev = form.querySelector('input[name="answerKind"]:checked')?.value;
    const html = answerKindHtml(answerKindsFor(format, selectedMode()), prev);
    box.hidden = !html;
    box.innerHTML = html;
  }

  function syncClasses() {
    const ids = selected();
    keep.classIds = ids;
    for (const f of fields.filter((x) => x.kind === "perClass")) {
      const vals = (keep.perClass[f.key] ||= {});
      for (const id of ids) if (vals[id] == null) vals[id] = f.defaultFor ? f.defaultFor(byId.get(id)) : "";
      const box = boxOf(f);
      box.hidden = !ids.length;
      const rows = box.querySelector(".live-divisor-rows");
      rows.innerHTML = perClassRowsHtml(f, ids.map((id) => ({ id, name: className(id) })), vals);
      rows.querySelectorAll("input[data-id]").forEach((i) => i.addEventListener("input", (e) => (vals[i.dataset.id] = e.target.value)));
    }
    for (const c of customs) c.api?.sync(ids);
    if (!keep.nameTouched) {
      const names = ids.map(className);
      nameInput.value = keep.name = format.defaultSessionName ? format.defaultSessionName(names) : defaultSessionName(names);
    }
    form.querySelectorAll('input[name="klass"]').forEach((i) => {
      i.disabled = !i.checked && ids.length >= format.maxClasses;
    });
  }

  function readSetup() {
    const out = {};
    for (const f of fields) {
      if (f.kind === "perClass") {
        const vals = keep.perClass[f.key] || {};
        out[f.key] = Object.fromEntries(keep.classIds.map((id) => [id, Number(vals[id])]));
      } else if (f.kind === "custom") {
        out[f.key] = customs.find((c) => c.f === f)?.api?.value();
      } else if (f.kind === "choice") {
        out[f.key] = coerceSetupValue(f, boxOf(f).querySelector("input:checked")?.value);
      } else if (f.kind === "toggle") {
        out[f.key] = coerceSetupValue(f, boxOf(f).querySelector("input").checked);
      } else {
        out[f.key] = coerceSetupValue(f, boxOf(f).querySelector("input")?.value);
      }
    }
    return out;
  }

  form.querySelectorAll('input[name="klass"]').forEach((i) => i.addEventListener("change", syncClasses));
  form.querySelectorAll('input[name="mode"]').forEach((i) => i.addEventListener("change", () => {
    keep.mode = selectedMode()?.id;
    syncAnswerKinds();
  }));
  form.querySelectorAll('input[name="format"]').forEach((i) => i.addEventListener("change", () => {
    keep.formatId = i.value;
    keep.mode = selectedMode()?.id;
    keep.classIds = keep.classIds.slice(0, requireFormat(i.value).maxClasses);
    drawForm(host, { classes, uid, createdByName, onCreated }, keep);
  }));
  syncAnswerKinds();
  if (keep.classIds.length) syncClasses();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = form.querySelector(".live-form-msg");
    const ids = selected();
    const mode = selectedMode();
    const kinds = answerKindsFor(format, mode);
    const input = {
      name: nameInput.value,
      format: format.id,
      gameMode: mode?.id,
      answerKind: form.querySelector('input[name="answerKind"]:checked')?.value || kinds[0],
      classIds: ids,
      classNames: Object.fromEntries(ids.map((id) => [id, className(id)])),
      ...readSetup(),
      createdByName,
    };
    const errs = validateSessionInput(input, { knownModes: modes.map((m) => m.id) });
    if (errs.length) {
      msg.innerHTML = `<div class="msg error">${errs.map(esc).join("<br>")}</div>`;
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.innerHTML = "";
    try {
      const sid = await createLiveSession(input, uid);
      onCreated?.(sid);
    } catch (err) {
      msg.innerHTML = `<div class="msg error">Kunde inte skapa matchen: ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}
