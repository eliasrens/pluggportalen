// ============================================================================
// Live – lärarens "Skapa Live-match" (#460)
// ----------------------------------------------------------------------------
// Välj spelläge (ur gameMode-registret – inget hårdkodat för multiplikation),
// klasser (klass mot klass; datamodellen klarar upp till 8), matchlängd 5–30
// min och nämnare per klass (förifylld med klassens elevantal, justerbar).
// Skapad session = status "lobby" → syns direkt för eleverna i klasserna.
//
// API: renderCreateForm(host, { classes, uid, createdByName, onCreated(sid) })
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { listGameModes, DEFAULT_GAME_MODE } from "./modes/index.js";
import { createLiveSession } from "./live-data.js";
import { LIVE_DURATIONS_MIN, validateSessionInput, defaultSessionName, MAX_LIVE_CLASSES } from "./live-core.js";

export function renderCreateForm(host, { classes, uid, createdByName, onCreated }) {
  const modes = listGameModes();
  const form = el(`<form class="panel live-form" novalidate>
    <h2 class="live-h2">Skapa Live-match</h2>
    <div class="field"><label>Spelläge</label>
      <div class="live-modes">${modes.map((m) => `<label class="live-chip">
        <input type="radio" name="mode" value="${esc(m.id)}" ${m.id === DEFAULT_GAME_MODE ? "checked" : ""} />
        <span>${esc(m.icon)} ${esc(m.displayName)}</span></label>`).join("")}</div>
    </div>
    <div class="field"><label>Klasser <small class="hint">(klass mot klass – välj minst två)</small></label>
      <div class="live-classes">${classes.map((c) => `<label class="live-chip">
        <input type="checkbox" name="klass" value="${esc(c.id)}" />
        <span>${esc(c.name || c.id)} <small>(${(c.studentIds || []).length})</small></span></label>`).join("") ||
        `<p class="hint">Inga klasser ännu – skapa klasser under Klasser &amp; elever.</p>`}</div>
    </div>
    <div class="live-divisors" hidden>
      <label>Nämnare per klass <small class="hint">(antal elever idag – poäng = rätt / nämnare)</small></label>
      <div class="live-divisor-rows"></div>
    </div>
    <div class="field"><label>Matchlängd</label>
      <div class="live-durations">${LIVE_DURATIONS_MIN.map((m) => `<label class="live-chip">
        <input type="radio" name="dur" value="${m}" ${m === 20 ? "checked" : ""} /><span>${m} min</span></label>`).join("")}</div>
    </div>
    <div class="field"><label for="live-name">Matchnamn</label>
      <input id="live-name" maxlength="80" placeholder="t.ex. 4B mot 5E" /></div>
    <div class="live-form-msg"></div>
    <button class="btn stor gron" type="submit">Skapa lobby</button>
  </form>`);
  host.replaceChildren(form);

  const byId = new Map(classes.map((c) => [c.id, c]));
  const nameInput = form.querySelector("#live-name");
  let nameTouched = false;
  nameInput.addEventListener("input", () => (nameTouched = true));
  const divisors = {};

  const selected = () => [...form.querySelectorAll('input[name="klass"]:checked')].map((i) => i.value);

  function syncDivisors() {
    const ids = selected();
    const rows = form.querySelector(".live-divisor-rows");
    form.querySelector(".live-divisors").hidden = !ids.length;
    rows.replaceChildren(...ids.map((id) => {
      if (divisors[id] == null) divisors[id] = Math.max(1, (byId.get(id)?.studentIds || []).length);
      const row = el(`<label class="live-divisor"><span>${esc(byId.get(id)?.name || id)}</span>
        <input type="number" min="1" max="999" step="1" value="${divisors[id]}" data-id="${esc(id)}" /></label>`);
      row.querySelector("input").addEventListener("input", (e) => (divisors[id] = e.target.value));
      return row;
    }));
    if (!nameTouched) nameInput.value = defaultSessionName(ids.map((id) => byId.get(id)?.name || id));
    form.querySelectorAll('input[name="klass"]').forEach((i) => {
      i.disabled = !i.checked && ids.length >= MAX_LIVE_CLASSES;
    });
  }
  form.querySelectorAll('input[name="klass"]').forEach((i) => i.addEventListener("change", syncDivisors));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = form.querySelector(".live-form-msg");
    const ids = selected();
    const input = {
      name: nameInput.value,
      gameMode: form.querySelector('input[name="mode"]:checked')?.value,
      classIds: ids,
      classNames: Object.fromEntries(ids.map((id) => [id, byId.get(id)?.name || id])),
      durationMin: Number(form.querySelector('input[name="dur"]:checked')?.value),
      divisors: Object.fromEntries(ids.map((id) => [id, Number(divisors[id])])),
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
