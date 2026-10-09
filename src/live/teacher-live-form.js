// ============================================================================
// Live – lärarens "Skapa Live-match" (#460)
// ----------------------------------------------------------------------------
// Välj spelläge (ur gameMode-registret – inget hårdkodat för multiplikation),
// klasser (klass mot klass; datamodellen klarar upp till 8), matchlängd 5–30
// min och nämnare per klass (förifylld med klassens elevantal, justerbar).
// Valfritt mynt-pris (#526) till vinnarklassens klasskassa – låst efter
// skapandet (reglerna), betalas ut automatiskt vid matchslut.
// Exakt två klasser → Trollkarlsduellen-valet (#536): vem är Rasmus/Elias
// (byt-knapp, aldrig samma på båda; sparas i sessionen, kan bytas i lobbyn).
// Skapad session = status "lobby" → syns direkt för eleverna i klasserna.
// Formuläret är Klassmatchens inställningar (#547): sessionen skapas med
// format "klassmatch", klassantal + validering kommer från formatet och bara
// spellägen formatet kan spela visas. (Formatväljaren, spec §3.4, kommer
// ovanpå detta – förvald Klassmatchen så arbetsflödet inte ändras.)
//
// API: renderCreateForm(host, { classes, uid, createdByName, onCreated(sid) })
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { listGameModes, DEFAULT_GAME_MODE } from "./modes/index.js";
import { requireFormat, DEFAULT_FORMAT } from "./formats/index.js";
import { createLiveSession } from "./live-data.js";
import { defaultWizards, swapWizards, validWizards, WIZARD_NAMES } from "./trollkarl/trollkarl-val.js";
import { LIVE_DURATIONS_MIN, validateSessionInput } from "./live-core.js";
import { LIVE_PRIZE_MAX, defaultSessionName } from "./formats/klassmatch/klassmatch-core.js";

export function renderCreateForm(host, { classes, uid, createdByName, onCreated }) {
  const format = requireFormat(DEFAULT_FORMAT);
  const modes = listGameModes().filter((m) => format.compatibleGameModes(m));
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
    <div class="field live-divisors" hidden>
      <label>Nämnare per klass <small class="hint">(antal elever idag – poäng = rätt / nämnare)</small></label>
      <div class="live-divisor-rows"></div>
    </div>
    <div class="field live-wizards" hidden>
      <label>🧙 Trollkarlsduellen <small class="hint">(projektorvy för två klasser – vem är Rasmus och vem är Elias?
        Kan bytas i lobbyn före start.)</small></label>
      <div class="live-wizard-rows"></div>
    </div>
    <div class="field"><label>Matchlängd</label>
      <div class="live-durations">${LIVE_DURATIONS_MIN.map((m) => `<label class="live-chip">
        <input type="radio" name="dur" value="${m}" ${m === 20 ? "checked" : ""} /><span>${m} min</span></label>`).join("")}</div>
    </div>
    <div class="field"><label for="live-prize">Mynt-pris till vinnarklassen <small class="hint">(valfritt – går till
      klassens klasskassa i Klasscentret; oavgjort delas lika. Kan inte ändras efter att matchen skapats.)</small></label>
      <input id="live-prize" class="live-prize-input" type="number" min="0" max="${LIVE_PRIZE_MAX}" step="1" inputmode="numeric"
        placeholder="t.ex. 1000 (tomt = inget pris)" /></div>
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
  let wizards = null;

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
    syncWizards(ids);
    if (!nameTouched) nameInput.value = defaultSessionName(ids.map((id) => byId.get(id)?.name || id));
    form.querySelectorAll('input[name="klass"]').forEach((i) => {
      i.disabled = !i.checked && ids.length >= format.maxClasses;
    });
  }
  function syncWizards(ids) {
    const box = form.querySelector(".live-wizards");
    box.hidden = ids.length !== 2;
    if (ids.length !== 2) return;
    if (!validWizards(wizards, ids)) wizards = defaultWizards(ids);
    const rows = form.querySelector(".live-wizard-rows");
    rows.replaceChildren(el(`<div class="live-wizard-row">${ids.map((id) =>
      `<span class="live-chip"><span>${esc(byId.get(id)?.name || id)}: <b>${WIZARD_NAMES[wizards[id]]}</b></span></span>`).join("")}
      <button type="button" class="btn" data-swap>⇄ Byt</button></div>`));
    rows.querySelector("[data-swap]").addEventListener("click", () => {
      wizards = swapWizards(wizards);
      syncWizards(selected());
    });
  }
  form.querySelectorAll('input[name="klass"]').forEach((i) => i.addEventListener("change", syncDivisors));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = form.querySelector(".live-form-msg");
    const ids = selected();
    const input = {
      name: nameInput.value,
      format: format.id,
      gameMode: form.querySelector('input[name="mode"]:checked')?.value,
      classIds: ids,
      classNames: Object.fromEntries(ids.map((id) => [id, byId.get(id)?.name || id])),
      durationMin: Number(form.querySelector('input[name="dur"]:checked')?.value),
      divisors: Object.fromEntries(ids.map((id) => [id, Number(divisors[id])])),
      coinPrize: form.querySelector("#live-prize").value,
      wizards: ids.length === 2 ? wizards : undefined,
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
