// ============================================================================
// Pluggporten – lärarsidan: fokusläge / klass-lås (teacher-class-lock.js)
// ----------------------------------------------------------------------------
// Issue #436: läraren LÅSER klassen till ETT mål (ett pluggområde ELLER en
// låsbar modul – Läsresan, Ekvationsresan, Hitta rätt!, Mattematchen …) fram
// till ett klockslag. Under låset ser/når eleverna bara målet
// (+ med "Dölj allt annat" försvinner även shop/värld/profil). När klockslaget
// passerar – eller läraren trycker "Lås upp nu" – återgår eleverna automatiskt
// (class-lock-watch.js lyssnar live på klass-dokumentet).
//
// Speglar teacher-class-modules.js (#412). Målen: klassens TILLDELADE områden
// (hela biblioteket om klassen saknar tilldelning, som elevens Plugga-lista)
// med spelbart innehåll + registrets låsbara moduler (STUDENT_MODULES, #734).
// En modul som klassen inte kan nå (opt-in ej påslagen, Mattematchen utan aktiv
// period) visas men går inte att välja. Persistens: data-class-lock.js.
//
// Laddas DYNAMISKT från teacher-classes.js – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { visibleGamemodesForClassArea, normalizeEnabledModules, normalizeHiddenModules } from "./gamemode-visibility.js";
import { el, esc, icon } from "./teacher-shared.js";
import {
  activeLock,
  areaKey,
  buildLock,
  formatKlockslag,
  formatKvar,
  lockLabel,
  lockTargetModule,
  LOCK_TARGET_TYPES,
  tillFromKlockslag,
} from "./class-lock.js";
import { setClassLock, clearClassLock, serverNow, syncServerClock } from "./data-class-lock.js";

const SNABBVAL_MIN = [15, 30, 45, 60]; // "+N min"-knapparna (bonus till klockslaget)

/** Klassens relevanta områden som { id:"subj/area", namn, grupp } (som elevens lista). */
function malOmraden(cls, library) {
  const tilldelade = Array.isArray(cls.assignedAreas) ? cls.assignedAreas : [];
  const bara = tilldelade.length
    ? new Set(tilldelade.map((a) => areaKey(a.subjectId, a.areaId)))
    : null;
  const ut = [];
  for (const subj of library) {
    for (const a of subj.areas || []) {
      const id = areaKey(subj.id, a.id);
      if (bara && !bara.has(id)) continue;
      if (visibleGamemodesForClassArea(a, cls).length === 0) continue;
      ut.push({ id, namn: a.name || a.id, emoji: a.coverEmoji || "📖", grupp: subj.name || subj.id });
    }
  }
  return ut;
}

// Registrets `villkor` → kan klassen nå modulen just nu? (lärarsidan, EN läsning
// per öppnad panel). Fel → inte valbar. Villkor utan rad här = alltid valbar.
const MAL_VILLKOR = {
  mattematchen: {
    skal: "ingen aktiv period",
    ok: async (cls) => {
      const [mm, core] = await Promise.all([
        import("./tavling/mm-teacher-data.js"),
        import("./tavling/mm-core.js"),
      ]);
      return !!core.activeCompetitionFor(await mm.competitionsForClass(cls.id), [cls.id], serverNow());
    },
  },
};

/**
 * Registrets låsbara moduler (utom område-modulen) som { typ, namn, ikon, grupp,
 * skal } – `skal` = varför målet inte går att välja just nu (annars null).
 */
async function malModuler(cls) {
  const pa = new Set(normalizeEnabledModules(cls.enabledModules));
  const dolda = new Set(normalizeHiddenModules(cls.hiddenModules)); // #735
  const moduler = LOCK_TARGET_TYPES.map(lockTargetModule).filter((m) => !m.lockAreas);
  return Promise.all(moduler.map(async (m) => {
    const villkor = MAL_VILLKOR[m.villkor];
    let skal = null;
    if (m.optIn && !pa.has(m.id)) skal = "inte påslagen för klassen";
    else if (dolda.has(m.id)) skal = "dold för klassen";
    else if (villkor && !(await villkor.ok(cls).catch(() => false))) skal = villkor.skal;
    return { typ: m.id, namn: m.label, ikon: m.ikon, grupp: m.lockGrupp || "Moduler", skal };
  }));
}

/** "HH:MM" för `now` + `min` minuter, avrundat uppåt till närmaste 5 min. */
function klockslagOm(min) {
  const d = new Date(serverNow() + min * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return formatKlockslag(d.getTime());
}

/**
 * Rendera "Fokusläge"-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.lock vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 * @param {Array} library     ämnen med sina område-dokument (loadLibrary)
 * @param {{onChange?:Function}} [opts] onChange anropas efter sparat lås/upplåsning
 *   (klassvyn ritar om masterns 🔒 direkt, #449 F1)
 */
export async function renderClassLock(ctx, cls, host, library, { onChange } = {}) {
  await syncServerClock().catch(() => 0);
  const omraden = malOmraden(cls, library);
  const moduler = await malModuler(cls);
  const start = activeLock(cls, serverNow());

  // Mål-dropdown: Plugga-områden grupperade per ämne, sedan Läsning och Moduler
  // (registrets lockGrupp). Ett mål klassen inte når är gråat – utom det som
  // redan är låst, så läraren kan flytta sluttiden.
  const grupper = new Map();
  omraden.forEach((o) => grupper.set(o.grupp, [...(grupper.get(o.grupp) || []), o]));
  const optgroup = (label, html) => `<optgroup label="${esc(label)}">${html}</optgroup>`;
  const omradeOpts = [...grupper]
    .map(([grupp, lista]) => optgroup(`Plugga · ${grupp}`, lista
      .map((o) => `<option value="omrade:${esc(o.id)}">${esc(o.emoji)} ${esc(o.namn)}</option>`)
      .join("")))
    .join("");
  const modGrupper = new Map();
  moduler.forEach((m) => modGrupper.set(m.grupp, [...(modGrupper.get(m.grupp) || []), m]));
  const valbar = (m) => !m.skal || start?.mal.typ === m.typ;
  const modulOpts = [...modGrupper]
    .map(([grupp, lista]) => optgroup(grupp, lista
      .map((m) => `<option value="${esc(m.typ)}"${valbar(m) ? "" : " disabled"}>${esc(m.ikon)} ${esc(m.namn)}${
        m.skal ? ` (${esc(m.skal)})` : ""}</option>`)
      .join("")))
    .join("");

  const box = el(`<div>
    <p class="hint">Lås <b>${esc(cls.name || cls.id)}</b> till <b>ett</b> område eller en modul
      (Läsresan, Ekvationsresan …) fram till ett klockslag. Under tiden ser eleverna bara det –
      andra områden och moduler går inte att öppna, inte ens via en direktlänk. När klockslaget passerar (eller du låser upp) får klassen
      automatiskt tillbaka allt, utan att någon behöver ladda om sidan.</p>
    <div class="lock-status"></div>
    <div class="row-inline" style="margin-top:10px;flex-wrap:wrap;gap:8px">
      <label>Mål
        <select class="select lock-mal" aria-label="Mål för fokusläget">
          ${omradeOpts}
          ${modulOpts}
        </select>
      </label>
      <label>Till klockan
        <input class="cell lock-till" type="time" step="60" aria-label="Sluttid (klockslag)" />
      </label>
    </div>
    <div class="row-inline" style="margin-top:8px;flex-wrap:wrap;gap:6px">
      <span class="hint" style="margin:0">Snabbval:</span>
      ${SNABBVAL_MIN.map((m) => `<button class="btn ghost small" data-snabb="${m}">+${m} min</button>`).join("")}
    </div>
    <label class="member-row" style="margin-top:10px;max-width:520px">
      <input type="checkbox" class="lock-dolj" />
      <span class="member-avatar">${icon("eye", 20)}</span>
      <span class="member-name">Dölj allt annat</span>
    </label>
    <p class="hint" style="margin:4px 0 0">Ikryssat döljs även shoppen, huset, gården och rummet –
      bara målet syns. Annars döljs bara de andra områdena och modulerna (Plugga, Läsresan,
      Ekvationsresan …).</p>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="lock-save">${icon("lock", 16)}<span>Lås klassen</span></button>
      <button class="btn ghost small danger" data-act="lock-clear">Lås upp nu</button>
      <span class="lock-result"></span>
    </div>
  </div>`);

  const statusEl = box.querySelector(".lock-status");
  const malEl = box.querySelector(".lock-mal");
  const tillEl = box.querySelector(".lock-till");
  const doljEl = box.querySelector(".lock-dolj");
  const saveBtn = box.querySelector('[data-act="lock-save"]');
  const clearBtn = box.querySelector('[data-act="lock-clear"]');
  const resultEl = box.querySelector(".lock-result");

  // Förifyll formuläret med ett aktivt lås (annars: första målet, om 45 min).
  if (start) {
    malEl.value = start.mal.typ === "omrade" ? `omrade:${start.mal.id}` : start.mal.typ;
    tillEl.value = formatKlockslag(start.till);
    doljEl.checked = start.doljOvrigt;
  } else {
    tillEl.value = klockslagOm(45);
  }

  // Live-status: aktivt lås + återstående tid (tickar varje sekund medan
  // panelen är öppen; stoppar sig själv när den tagits bort ur DOM:en).
  const ritaStatus = () => {
    const lock = activeLock(cls, serverNow());
    saveBtn.querySelector("span").textContent = lock ? "Uppdatera låset" : "Lås klassen";
    clearBtn.hidden = !lock;
    statusEl.innerHTML = lock
      ? `<div class="msg ok-inline" style="display:block">🔒 <b>Låst</b> till
          <b>${esc(lockLabel(lock))}</b> fram till <b>${formatKlockslag(lock.till)}</b>
          – ${formatKvar(lock.till - serverNow())} kvar${lock.doljOvrigt ? " · allt annat dolt" : ""}</div>`
      : `<p class="hint" style="margin:0">🔓 Klassen är inte låst – eleverna ser alla sina områden.</p>`;
  };
  ritaStatus();
  const tick = setInterval(() => (box.isConnected ? ritaStatus() : clearInterval(tick)), 1000);

  box.querySelectorAll("[data-snabb]").forEach((b) =>
    b.addEventListener("click", () => (tillEl.value = klockslagOm(Number(b.dataset.snabb))))
  );

  const visa = (html) => (resultEl.innerHTML = html);
  const upptagen = async (btn, text, fn) => {
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = text;
    visa("");
    try {
      await fn();
    } catch (err) {
      visa(`<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
      ritaStatus();
    }
  };

  saveBtn.addEventListener("click", () =>
    upptagen(saveBtn, "Låser…", async () => {
      const till = tillFromKlockslag(tillEl.value, serverNow());
      if (!till) {
        visa(`<span class="err-inline">Välj ett klockslag senare idag (t.ex. ${klockslagOm(30)}).</span>`);
        return;
      }
      const val = malEl.value;
      const omrade = val.startsWith("omrade:") ? omraden.find((o) => `omrade:${o.id}` === val) : null;
      const modul = moduler.find((m) => m.typ === val && valbar(m));
      const lock = buildLock(
        omrade
          ? { typ: "omrade", id: omrade.id, namn: omrade.namn, till, doljOvrigt: doljEl.checked }
          : { typ: modul?.typ, till, doljOvrigt: doljEl.checked }
      );
      if (!lock) {
        visa(`<span class="err-inline">Välj ett mål att låsa klassen till.</span>`);
        return;
      }
      cls.lock = await setClassLock(cls.id, lock);
      onChange?.();
      visa(`<span class="ok-inline">✓ Låst – eleverna ser bara ${esc(lockLabel(lock))} till ${formatKlockslag(till)}</span>`);
    })
  );

  clearBtn.addEventListener("click", () =>
    upptagen(clearBtn, "Låser upp…", async () => {
      await clearClassLock(cls.id);
      delete cls.lock;
      onChange?.();
      visa(`<span class="ok-inline">✓ Upplåst – klassen ser alla sina områden igen</span>`);
    })
  );

  host.replaceChildren(box);
}
