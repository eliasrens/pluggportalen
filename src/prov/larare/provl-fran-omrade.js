// ============================================================================
// Prov (#745, spec §10): rutan "Hämta från område" i provredigeraren.
// 1) Läraren väljer ämne och område – alla områden läraren får läsa (samma
//    lista som Innehållsstudion), "Visa: Mina områden" som där (#680).
// 2) Kryssar i sakerna, grupperade per sort (prov-fran-omrade.js omradetsSaker);
//    saker som inte kan bli en provfråga är gråade med orsaken.
// 3) "Lägg till i provet": fragorFranOmrade → laggTillFragor (sist, nya id
//    vid krock). Inget sparas här – redigeraren sparar som vanligt.
// Laddas bara med import() från provl-redigera.js (#271).
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { getAreas, getSubjects } from "../../data-content.js";
import { gradeLabel } from "../../grades.js";
import { createdByLabel } from "../../teacher-role.js";
import { antalText, fragorFranOmrade, omradetsSaker } from "../prov-fran-omrade.js";
import { laggTillFragor } from "../prov-redigera-ops.js";
import { GRANS } from "../typer/delat.js";

const lista = (xs) => `<ul class="error-list">${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;

/**
 * Öppna rutan.
 * @param {object} prov arbetskopian (läses, ändras inte)
 * @param {object} role myRole()
 * @param {(nyttProv: object, text: string) => void} onKlar
 */
export function oppnaFranOmrade(prov, role, onKlar) {
  const dlg = el(`<dialog class="provl-dialog teacher-dark" aria-label="Hämta från område">
    <form method="dialog" class="provl-dialog-inre provl-fo" novalidate>
      <div class="provl-dialog-topp"><div><h2 class="subhead">${icon("book", 20)} Hämta från område</h2>
        <p class="hint">Välj ett Plugga-område och kryssa i det som ska bli frågor. ${prov.fragor.length ? `De läggs sist i provet (${prov.fragor.length} finns redan).` : ""}</p></div>
        <button type="button" class="btn small ghost" data-stang aria-label="Stäng">${icon("x", 16)}</button></div>
      <div class="provl-grid">
        <label class="provl-falt">Ämne<select name="amne" disabled><option>Laddar…</option></select></label>
        <label class="provl-falt">Visa<select name="agare"><option value="alla">Alla områden</option><option value="mina">Mina områden</option></select></label>
        <label class="provl-falt provl-falt-bred">Område<select name="omrade" disabled><option value="">Välj ett ämne först</option></select></label>
      </div>
      <div class="provl-fo-saker" aria-live="polite"></div>
      <div class="provl-fo-resultat" aria-live="polite"></div>
      <div class="provl-knappar provl-dialog-fot">
        <button type="button" class="btn gron" data-lagg-till disabled>${icon("plus", 16)}<span>Lägg till i provet</span></button>
        <button type="button" class="btn ghost" data-stang>Avbryt</button>
      </div>
    </form>
  </dialog>`);
  const f = dlg.querySelector("form");
  const $ = (s) => dlg.querySelector(s);
  const amneSel = f.elements.amne;
  const omradeSel = f.elements.omrade;
  let omraden = [];
  let area = null;
  let resultat = { fragor: [], varningar: [] };
  const arMin = (a) => (a.createdBy ? a.createdBy === role?.uid : !!role?.admin);

  const fel = (text) => { $(".provl-fo-saker").innerHTML = `<div class="msg error">${esc(text)}</div>`; };

  getSubjects().then((subjects) => {
    amneSel.innerHTML = subjects.length
      ? `<option value="">Välj ämne</option>${subjects.map((s) => `<option value="${esc(s.id)}">${esc(s.icon ? `${s.icon} ` : "")}${esc(s.name || s.id)}</option>`).join("")}`
      : `<option value="">Inga ämnen</option>`;
    amneSel.disabled = !subjects.length;
    amneSel.focus();
  }, (err) => fel(`Ämnena gick inte att läsa: ${err?.message || err}`));

  async function valjAmne() {
    area = null;
    ritaSaker();
    omradeSel.disabled = true;
    if (!amneSel.value) {
      omradeSel.innerHTML = `<option value="">Välj ett ämne först</option>`;
      return;
    }
    omradeSel.innerHTML = `<option value="">Laddar…</option>`;
    try {
      omraden = await getAreas(amneSel.value);
    } catch (err) {
      return fel(`Områdena gick inte att läsa: ${err?.message || err}`);
    }
    ritaOmraden();
  }

  function ritaOmraden() {
    const visas = f.elements.agare.value === "mina" ? omraden.filter(arMin) : omraden;
    omradeSel.innerHTML = visas.length
      ? `<option value="">Välj område (${visas.length})</option>${visas.map((a) => {
        const ak = gradeLabel(a.grade);
        return `<option value="${esc(a.id)}" ${a.id === area?.id ? "selected" : ""}>${esc(a.coverEmoji ? `${a.coverEmoji} ` : "")}${esc(a.name || a.id)}${ak ? ` · ${esc(ak)}` : ""} – ${esc(createdByLabel(a))}</option>`;
      }).join("")}`
      : `<option value="">${omraden.length ? "Inga egna områden i ämnet" : "Inga områden i ämnet"}</option>`;
    omradeSel.disabled = !visas.length;
    if (area && !visas.some((a) => a.id === area.id)) {
      area = null;
      ritaSaker();
    }
  }

  function ritaSaker() {
    const host = $(".provl-fo-saker");
    if (!area) {
      host.replaceChildren();
      return uppdatera();
    }
    const grupper = omradetsSaker(area);
    if (!grupper.length) {
      host.innerHTML = `<p class="hint">Området har inga quizfrågor, par, tidslinjer eller ämnestexter att hämta.</p>`;
      return uppdatera();
    }
    host.innerHTML = grupper.map((g, gi) => {
      const ok = g.saker.filter((s) => !s.problem).length;
      let del = null;
      const rader = g.saker.map((s) => {
        const rubrik = s.del && s.del !== del ? `<li class="provl-fo-del">${esc((del = s.del))}</li>` : "";
        return `${rubrik}<li><label class="provl-check${s.problem ? " provl-fo-ej" : ""}">
          <input type="checkbox" data-sak="${esc(s.nyckel)}" data-grupp="${gi}" ${s.problem ? "disabled" : ""} />
          <span>${esc(s.etikett)}${s.info ? ` <span class="hint">· ${esc(s.info)}</span>` : ""}${s.problem ? ` <span class="provl-fo-orsak">– ${esc(s.problem)}</span>` : ""}</span></label></li>`;
      }).join("");
      return `<fieldset class="provl-grupp provl-fo-grupp"><legend>${esc(g.rubrik)} (${g.saker.length})</legend>
        <label class="provl-check provl-fo-alla"><input type="checkbox" data-alla="${gi}" ${ok ? "" : "disabled"} /><span><b>Välj alla</b>${ok < g.saker.length ? ` <span class="hint">(${ok} går att ta med)</span>` : ""}</span></label>
        <ul class="provl-fo-lista">${rader}</ul></fieldset>`;
    }).join("");
    uppdatera();
  }

  const valda = () => [...dlg.querySelectorAll("[data-sak]:checked")].map((x) => x.dataset.sak);

  function uppdatera() {
    // "Välj alla" följer sakerna (ikryssad / delvis).
    dlg.querySelectorAll("[data-alla]").forEach((alla) => {
      const saker = [...dlg.querySelectorAll(`[data-grupp="${alla.dataset.alla}"]:not(:disabled)`)];
      const n = saker.filter((x) => x.checked).length;
      alla.checked = n > 0 && n === saker.length;
      alla.indeterminate = n > 0 && n < saker.length;
    });
    const nycklar = valda();
    resultat = area && nycklar.length ? fragorFranOmrade(area, nycklar) : { fragor: [], varningar: [] };
    const res = $(".provl-fo-resultat");
    const n = resultat.fragor.length;
    const over = prov.fragor.length + n > GRANS.fragor;
    $("[data-lagg-till]").disabled = !n || over;
    if (!nycklar.length) {
      res.innerHTML = area ? `<p class="hint">Inget valt än.</p>` : "";
      return;
    }
    res.innerHTML = `${n ? `<div class="msg ${over ? "error" : "ok"}">${over
      ? `Det blir ${esc(antalText(resultat.fragor))} – provet får högst ${GRANS.fragor} frågor och textblock (${prov.fragor.length} finns redan).`
      : `Det blir ${esc(antalText(resultat.fragor))}.`}</div>` : ""}
      ${resultat.varningar.length ? `<div class="msg warn"><div>Bra att veta:</div>${lista(resultat.varningar)}</div>` : ""}`;
  }

  amneSel.addEventListener("change", valjAmne);
  f.elements.agare.addEventListener("change", ritaOmraden);
  omradeSel.addEventListener("change", () => {
    area = omraden.find((a) => a.id === omradeSel.value) || null;
    ritaSaker();
  });
  $(".provl-fo-saker").addEventListener("change", (e) => {
    const gi = e.target.dataset.alla;
    if (gi !== undefined) {
      dlg.querySelectorAll(`[data-grupp="${gi}"]:not(:disabled)`).forEach((x) => { x.checked = e.target.checked; });
    }
    uppdatera();
  });

  $("[data-lagg-till]").addEventListener("click", () => {
    if (!resultat.fragor.length) return;
    const r = laggTillFragor(prov, resultat.fragor);
    if (!r.ok) {
      $(".provl-fo-resultat").innerHTML = `<div class="msg error">${esc(r.errors.join(" "))}</div>`;
      return;
    }
    stang();
    onKlar(r.prov, `${antalText(resultat.fragor)} lades till från ”${area.name || area.id}”.`);
  });

  const stang = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.querySelectorAll("[data-stang]").forEach((b) => b.addEventListener("click", stang));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
}
