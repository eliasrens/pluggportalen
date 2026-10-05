// ============================================================================
// Pluggporten – lärarsidan: synliga byar per klass (teacher-class-villages.js)
// ----------------------------------------------------------------------------
// Issue #391: läraren väljer vilka ANDRA klassers byar DENNA klass ser i
// världens områdesvy (skolan, varld-omrade.js). Vissa klasser är specgrupper →
// läraren ska kunna dölja dem. Speglar lägen-kontrollen (teacher-class-modes.js):
// ikryssat = synligt, urbockat sparas i classes/{id}.hiddenVillages via
// data.setClassHiddenVillages. Tomt = allt synligt (bakåtkompatibelt).
//
// Listar övriga klasser via deras PUBLIKA fält (namn, ev. by-namn, antal elever)
// – samma fält som elevens områdesvy redan visar (#37). Den egna klassen listas
// inte: den syns alltid för sina elever.
//
// GENVÄG "dölj för alla": under listan kan läraren dölja (eller visa) DEN HÄR
// klassens egen by för alla andra klasser på en gång (t.ex. en specgrupp) –
// data.setVillageHiddenForAll skriver hiddenVillages på varje annan klass i en
// batch. Samma fält som kryssrutorna, bara sett från den dolda byns håll.
//
// Laddas DYNAMISKT från teacher-classes.js (vid klick på "Synliga byar") så att filen
// aldrig hamnar i den statiska bootgrafen (incident #271).
// ============================================================================

import * as data from "./data.js";
import { normalizeHiddenVillages } from "./gamemode-visibility.js";
import { el, esc, emptyState, icon } from "./teacher-shared.js";
import { possessiv } from "./text-format.js";

/** Genitiv för klassnamn: förkortningar/siffror får kolon ("4A:s"), annars "Specgrupps". */
function klassGenitiv(namn) {
  return /[0-9A-ZÅÄÖ]$/.test(String(namn).trim()) ? `${namn}:s` : possessiv(namn);
}

/**
 * Rendera "🏘️ Synliga byar"-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenVillages vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 * @param {object[]} classes  ALLA klasser (lärarens klasslista)
 */
export function renderClassVillages(ctx, cls, host, classes) {
  const others = (Array.isArray(classes) ? classes : []).filter((c) => c.id !== cls.id);

  if (others.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        icon: "school",
        title: "Inga andra byar än",
        text: "När det finns fler klasser kan du välja vilka av deras byar den här klassen ser.",
      })
    );
    return;
  }

  const hidden = new Set(normalizeHiddenVillages(cls.hiddenVillages));
  const rows = others
    .map((c) => {
      const antal = Array.isArray(c.studentIds) ? c.studentIds.length : 0;
      const by = c.by ? ` · ${esc(c.by)}` : "";
      return `<label class="member-row">
        <input type="checkbox" data-village="${esc(c.id)}"${hidden.has(c.id) ? "" : " checked"} />
        <span class="member-avatar">${icon("school", 20)}</span>
        <span class="member-name">${esc(c.name || c.id)}${by}<br><span class="hint">${antal} hus</span></span>
      </label>`;
    })
    .join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de andra klassers byar som <b>${esc(cls.name || cls.id)}</b> ska
      <b>se</b> i världens områdesvy ("Andra byar"). Urbockade byar döljs för klassen.
      Klassens egen by syns alltid. Lämnar du allt ikryssat ser eleverna alla byar.</p>
    <div class="member-grid">${rows}</div>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-villages">${icon("save", 16)}<span>Spara byar</span></button>
      <button class="btn ghost small" data-act="all-villages">Visa alla</button>
      <span class="villages-result"></span>
    </div>
    <div class="villages-own" style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08)">
      <p class="hint" style="margin:0 0 8px"><b>${esc(klassGenitiv(cls.name || cls.id))} egen by</b> –
        <span class="villages-own-status"></span></p>
      <div class="row-inline">
        <button class="btn ghost small" data-act="hide-own-all">${icon("lock", 16)}<span>Dölj för alla andra klasser</span></button>
        <button class="btn ghost small" data-act="show-own-all">${icon("eye", 16)}<span>Visa för alla</span></button>
        <span class="villages-own-result"></span>
      </div>
    </div>
  </div>`);

  const resultEl = box.querySelector(".villages-result");

  box.querySelector('[data-act="all-villages"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-villages"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Urbockade = dolda. (Checked = synligt.)
    const picked = [...box.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(
      (c) => c.dataset.village
    );
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenVillages(cls.id, picked);
      cls.hiddenVillages = saved;
      resultEl.innerHTML = saved.length
        ? `<span class="ok-inline">✓ Sparat (${saved.length} by${saved.length === 1 ? "" : "ar"} dold${saved.length === 1 ? "" : "a"})</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla byar</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  // --- Genväg: den här klassens by, dold/synlig för ALLA andra klasser -------
  const ownStatusEl = box.querySelector(".villages-own-status");
  const ownResultEl = box.querySelector(".villages-own-result");
  const visarStatus = () => {
    const dolda = others.filter((c) => normalizeHiddenVillages(c.hiddenVillages).includes(cls.id));
    ownStatusEl.textContent =
      dolda.length === 0
        ? `syns för alla ${others.length} andra klasser.`
        : dolda.length === others.length
          ? `dold för alla andra klasser.`
          : `dold för ${dolda.length} av ${others.length} andra klasser (${dolda.map((c) => c.name || c.id).join(", ")}).`;
  };
  visarStatus();

  const ownAll = (hide) => async (e) => {
    const btns = box.querySelectorAll(".villages-own button");
    btns.forEach((b) => (b.disabled = true));
    ownResultEl.innerHTML = "";
    try {
      await data.setVillageHiddenForAll(cls.id, hide, others.map((c) => c.id));
      // Spegla skrivningen lokalt så övriga klasskorts paneler stämmer direkt.
      for (const c of others) {
        const list = normalizeHiddenVillages(c.hiddenVillages).filter((id) => id !== cls.id);
        c.hiddenVillages = hide ? [...list, cls.id] : list;
      }
      visarStatus();
      ownResultEl.innerHTML = `<span class="ok-inline">✓ Sparat</span>`;
    } catch (err) {
      ownResultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  };
  box.querySelector('[data-act="hide-own-all"]').addEventListener("click", ownAll(true));
  box.querySelector('[data-act="show-own-all"]').addEventListener("click", ownAll(false));

  host.replaceChildren(box);
}
