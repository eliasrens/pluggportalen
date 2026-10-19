// ============================================================================
// Pluggporten – lärarsidan: Mina klasser (teacher-mina-klasser.js)
// ----------------------------------------------------------------------------
// #804 (epic #802 §3.1–3.3). #/larare/mina-klasser ersätter Klasser och
// Statistik (#679): överst en rad med klasserna som knappar (fler än 8 → sökbar
// rullgardin), under den vald klass med fyra flikar – Hur går det? | Vad
// eleverna ser | Fokusläge | Elever (MINA_FLIKAR i teacher-mina-val.js).
// Flikarna visar de befintliga sektionerna ur CLASS_SECTIONS OFÖRÄNDRADE.
//
// Läsningar: klasser + elever EN gång per besök (som förr), biblioteket när en
// sektion behöver det, progress bara för vald klass i Hur går det? – inget nytt.
// Valet speglas i #/larare/mina-klasser?klass=<id>&flik=<f>[&del=<underflik>]
// med history.replaceState (ingen omritning) och klassen i localStorage, så
// läraren kommer tillbaka till samma klass och underflik efter sidbyte och
// omladdning. Laddas med import() från teacher-classes.js (#271).
// ============================================================================

import * as data from "./data.js";
import { el, esc, icon, teacherHead, teacherNav } from "./teacher-shared.js";
import { countLabel, createClassStore, loadLibraryFrom, readSavedClass, saveClass, studentCount } from "./teacher-classes-store.js";
import { CLASS_SECTIONS, withLoading } from "./teacher-classes-sections.js";
import { filterClasses, myRole, studentsInClasses } from "./teacher-role.js";
import { lastStatsTab } from "./teacher-stats-av.js";
import { activeLock } from "./class-lock.js";
import { serverNow } from "./data-class-lock.js";
import { MANGA_KLASSER, MINA_BASE, MINA_FLIKAR, filtreraKlasser, flikSektioner, minaHash, startVal } from "./teacher-mina-val.js";

const sektion = (key) => CLASS_SECTIONS.find((s) => s.key === key);

/** Montera Mina klasser i ctx.app (efter lärarspärren). */
export async function mountMinaKlasser(ctx) {
  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));
  const startHash = window.location.hash;
  let classes, students, role;
  try {
    [classes, students, role] = await Promise.all([data.getClasses(), data.getStudents(), myRole()]);
  } catch (err) {
    ctx.app.replaceChildren(el(`<div class="panel"><div class="msg error">Kunde inte ladda klasser: ${esc(err.message)}</div></div>`));
    return;
  }
  if (window.location.hash !== startHash) return; // läraren hann vidare
  // Årskurskonto: bara kontots klasser och elever (§5.2). Admin: alla.
  if (!role.admin) {
    classes = filterClasses(classes, role);
    students = studentsInClasses(students, classes);
  }
  students = students.slice().sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));

  const store = createClassStore({ classes, students, loadLibrary: () => loadLibraryFrom(data) });
  const val = startVal(store.sorted(), {
    query: new URLSearchParams(startHash.split("?")[1] || ""),
    saved: readSavedClass(),
    statsSaved: lastStatsTab(),
  });
  store.selectedId = val.id;
  const sida = { flik: val.flik, del: val.del, admin: !!role.admin };

  const page = el(`<div class="teacher-page teacher-dark mk-page"></div>`);
  page.append(teacherNav(ctx, "klasser"), teacherHead(ctx, "klasser"));
  page.append(el(`<p class="mk-lead">Välj klass. Allt om klassen finns i flikarna, och klassen du valt är kvar när du byter sida.</p>`));
  const valjare = el(`<div class="mk-klassval" role="group" aria-label="Välj klass"></div>`);
  const panel = el(`<section class="panel mk-klass" aria-label="Vald klass"></section>`);
  page.append(valjare, panel);

  const persist = () => {
    saveClass(store.selectedId);
    const hash = minaHash(store.selectedId, sida.flik, sida.del);
    if (window.location.hash.split("?")[0] === MINA_BASE && window.location.hash !== hash) {
      history.replaceState(history.state, "", hash);
    }
  };
  // Hur går det?: underfliken minns (lastStatsTab) och länken "Vad eleverna ser" byter flik på plats.
  store.statsOpts = {
    get tab() { return sida.del; },
    onTab: (key) => ((sida.del = key), persist()),
    visaSer: () => valjFlik("ser"),
  };

  const ritaValjare = klassValjare(valjare, store);
  let visad = { id: undefined, flik: undefined };
  let head = null;

  function ritaKlass() {
    const cls = store.selected();
    if (!cls) {
      head = null;
      panel.replaceChildren(el(`<div class="cls-detail-empty"><p class="hint">${sida.admin
        ? "Det finns inga klasser än – skapa dem under Admin → Klasser & elevkonton."
        : "Kontot har inga klasser än – admin väljer dem under Lärarkonton."}</p></div>`));
      return;
    }
    const flikar = MINA_FLIKAR.map((f) => `<button type="button" role="tab" class="mk-flik${f.key === sida.flik ? " active" : ""}"
      data-flik="${f.key}" id="mk-flik-${f.key}" aria-controls="mk-innehall" aria-selected="${f.key === sida.flik}"
      tabindex="${f.key === sida.flik ? 0 : -1}"><span class="mk-flik-namn">${esc(f.label)}</span><small>${esc(f.sub)}</small></button>`).join("");
    const box = el(`<div class="mk-klass-inner">
      <header class="mk-head"><h2 class="mk-namn"></h2><span class="class-count mk-antal"></span></header>
      <div class="mk-flikar" role="tablist" aria-label="Allt om klassen">${flikar}</div>
      <div class="mk-innehall" id="mk-innehall" role="tabpanel" aria-labelledby="mk-flik-${sida.flik}"></div>
    </div>`);
    head = { namn: box.querySelector(".mk-namn"), antal: box.querySelector(".mk-antal") };
    ritaHuvud(cls);
    const tablist = box.querySelector(".mk-flikar");
    tablist.addEventListener("click", (e) => {
      const t = e.target.closest("[data-flik]");
      if (t) valjFlik(t.dataset.flik);
    });
    tablist.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      const keys = MINA_FLIKAR.map((f) => f.key);
      const i = keys.indexOf(sida.flik);
      const j = e.key === "Home" ? 0 : e.key === "End" ? keys.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
      e.preventDefault();
      valjFlik(keys[j]);
      panel.querySelector(`#mk-flik-${keys[j]}`)?.focus();
    });
    panel.replaceChildren(box);
    // Läsresan-milstolpar (#528): pokalerna delas ut när klassen öppnas – bara admin (ekonomi, §2.2).
    if (sida.admin) import("./klasscenter/kc-pokal-data.js").then((m) => m.delaUtLasresanMilstolpar(cls.id), () => {});
    ritaFlik(ctx, cls, box.querySelector(".mk-innehall"), store, sida);
  }

  function ritaHuvud(cls) {
    if (!head) return;
    head.namn.textContent = cls.name || cls.id;
    head.antal.textContent = countLabel(studentCount(cls));
  }

  function valjFlik(key) {
    if (key === sida.flik) return;
    sida.flik = key;
    store.notify();
  }

  function update() {
    ritaValjare();
    const cls = store.selected();
    const nu = { id: cls ? cls.id : null, flik: sida.flik };
    if (nu.id === visad.id && nu.flik === visad.flik) {
      if (cls) ritaHuvud(cls); // elevantal/fokusläge – innehållet rörs inte
    } else {
      visad = nu;
      ritaKlass();
    }
    persist();
  }

  store.subscribe(update);
  ctx.app.replaceChildren(page);
  update();
}

/**
 * Flikens innehåll i en NY värd (en långsam sektion för förra klassen/fliken
 * skriver då i ett lösryckt element). Vad eleverna ser = tre numrerade steg.
 */
function ritaFlik(ctx, cls, host, store, sida) {
  const flik = MINA_FLIKAR.find((f) => f.key === sida.flik) || MINA_FLIKAR[0];
  const keys = flikSektioner(flik, sida.admin);
  if (flik.key === "ser") {
    return withLoading(host, "Vad eleverna ser", async () =>
      (await import("./teacher-mina-ser.js")).renderVadElevernaSer(ctx, cls, host, store));
  }
  if (keys.length === 1) {
    const sec = sektion(keys[0]);
    return withLoading(host, sec.what, () => sec.render(ctx, cls, host, store));
  }
  // Flera sektioner (admin: Elever + Klasscentret) staplade med var sin rubrik.
  host.replaceChildren(...keys.map((k) => {
    const sec = sektion(k);
    const block = el(`<section class="cls-block mk-block"><h3 class="subhead">${icon(sec.icon, 18)}<span>${esc(sec.label)}</span></h3><div></div></section>`);
    const inner = block.lastElementChild;
    withLoading(inner, sec.what, () => sec.render(ctx, cls, inner, store));
    return block;
  }));
}

/** Klassväljaren: knappar (≤ 8 klasser) eller sök + rullgardin. Returnerar rita(). */
function klassValjare(root, store) {
  let sok = "";
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-klass]");
    if (b && b.dataset.klass !== store.selectedId) store.select(b.dataset.klass);
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches(".mk-klass-select") && e.target.value) store.select(e.target.value);
  });
  root.addEventListener("input", (e) => {
    if (!e.target.matches(".mk-sok-falt")) return;
    sok = e.target.value;
    fyllSelect();
  });
  root.addEventListener("keydown", (e) => {
    if (!e.target.matches(".mk-sok-falt") || e.key !== "Enter") return;
    e.preventDefault();
    const forsta = filtreraKlasser(store.sorted(), sok)[0];
    if (forsta) store.select(forsta.id);
  });

  const lasIkon = (cls, now) =>
    activeLock(cls, now) ? `<span class="mk-las" title="Fokusläge på">${icon("lock", 14)}<span class="sr-only">Fokusläge på</span></span>` : "";

  function fyllSelect() {
    const sel = root.querySelector(".mk-klass-select");
    if (!sel || (document.activeElement === sel && !sok && sel.value === store.selectedId)) return; // öppen lista ritas inte om
    const now = serverNow();
    const traffar = filtreraKlasser(store.sorted(), sok);
    const vald = traffar.some((c) => c.id === store.selectedId);
    sel.innerHTML = (vald ? "" : `<option value="" selected disabled>${traffar.length ? `${traffar.length} klasser matchar – välj` : "Ingen klass matchar"}</option>`) +
      traffar.map((c) => `<option value="${esc(c.id)}"${c.id === store.selectedId ? " selected" : ""}>${activeLock(c, now) ? "🔒 " : ""}${esc(c.name || c.id)} (${countLabel(studentCount(c))})</option>`).join("");
  }

  function rita() {
    const klasser = store.sorted();
    if (klasser.length > MANGA_KLASSER) {
      delete root.dataset.html;
      if (!root.querySelector(".mk-klass-select")) {
        root.classList.add("mk-klassval-sok");
        root.innerHTML = `<label class="mk-sok"><span class="sr-only">Sök klass</span>
          <input type="search" class="mk-sok-falt" placeholder="Sök klass…" autocomplete="off" /></label>
          <label class="mk-sok-val"><span class="sr-only">Välj klass</span><select class="select mk-klass-select" aria-label="Välj klass"></select></label>`;
      }
      return fyllSelect();
    }
    const now = serverNow();
    root.classList.remove("mk-klassval-sok");
    const html = klasser.map((c) => `<button type="button" class="mk-klassknapp" data-klass="${esc(c.id)}"
      aria-pressed="${c.id === store.selectedId}" title="${esc(c.name || c.id)} – ${countLabel(studentCount(c))}">
      <span class="mk-klassknapp-namn">${esc(c.name || c.id)}</span>${lasIkon(c, now)}</button>`).join("");
    if (root.dataset.html === html) return;
    // Fokus stannar på samma klassknapp efter omritningen (tangentbord).
    const fokus = root.contains(document.activeElement) ? document.activeElement.dataset.klass : null;
    root.dataset.html = html;
    root.innerHTML = html;
    if (fokus) root.querySelector(`[data-klass="${CSS.escape(fokus)}"]`)?.focus();
  }

  // Fokusläget kan gå ut (klockslag) – håll 🔒 färsk som i förra klasslistan.
  const tick = setInterval(() => (root.isConnected ? rita() : clearInterval(tick)), 15000);
  return rita;
}
