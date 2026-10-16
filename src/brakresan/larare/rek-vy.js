// ============================================================================
// Bråkresan – lärarens rekommendationer (src/brakresan/larare/rek-vy.js) · K #716
// ----------------------------------------------------------------------------
// Spec §12 "Lärarfunktioner": rekommendera en eller flera utmaningar till en
// elev eller hela klassen, med valfri kort kommentar. En klassrekommendation
// gäller klassen enligt classes/{id}.studentIds – även elever som kommer till
// senare – så länge den är aktiv. Individrekommendationer kan tas bort;
// klassrekommendationer avslutas (active: false). Eleven ser dem som etikett
// och i "Börja här" (huvudvyn, H #713). Ingen låsning, ingen ändrad belöning.
//
// ritaRekommendationer(host, { cls?, students, api, student? })
//   student = en elev (individvyn): formuläret riktas bara till eleven och
//   listan visar elevens egna + klassens aktiva rekommendationer.
// ============================================================================

import { CHALLENGES, SECTIONS, challengeMeta } from "../schema/katalog.js";
import { datumText, esc, namnPa } from "./vy-delat.js";
import { ms } from "./statistik.js";

let raknare = 0;

function formHtml(id, { cls, students, student }) {
  const mal = student
    ? `<input type="hidden" class="brr-mal" value="s:${esc(student.id)}"><p class="brl-svag">Till ${esc(namnPa(student))}.</p>`
    : `<label for="${id}-mal">Till</label>
      <select id="${id}-mal" class="brr-mal">
        ${cls ? `<option value="k:${esc(cls.id)}">Hela ${esc(cls.name || "klassen")} – även elever som kommer till senare</option>` : ""}
        ${students.map((s) => `<option value="s:${esc(s.id)}">${esc(namnPa(s))}</option>`).join("")}
      </select>`;
  return `<form class="brr-form" novalidate>
    <div class="brr-falt">${mal}</div>
    <fieldset class="brr-utm"><legend>Utmaningar</legend>
      ${SECTIONS.map((s) => `<div class="brr-grupp"><p class="brr-grupp-namn">${esc(s.name)}</p>
        ${CHALLENGES.filter((c) => c.section === s.id).map((c) => `<label class="brr-val">
          <input type="checkbox" value="${c.id}"><span><b>${c.id}</b> ${esc(c.name)}</span></label>`).join("")}</div>`).join("")}
    </fieldset>
    <div class="brr-falt"><label for="${id}-komm">Kommentar (valfri, syns för eleven)</label>
      <input id="${id}-komm" class="brr-komm input" maxlength="200" placeholder="Till exempel: Börja med de här innan vi ses på fredag"></div>
    <div class="brr-knappar"><button type="submit" class="btn small">Rekommendera</button>
      <span class="brr-msg" role="status" aria-live="polite"></span></div>
  </form>`;
}

function recHtml(r, namnAv, egen) {
  const klass = !!r.classId;
  const utm = r.challengeIds.map((id) => `<span class="brl-chip" title="${esc(challengeMeta(id)?.name || "")}">${esc(id)} ${esc(challengeMeta(id)?.name || "")}</span>`).join("");
  const knapp = egen === false ? "" : `<button type="button" class="btn small ghost brr-bort" data-id="${esc(r.id)}" data-klass="${klass ? 1 : 0}">${klass ? "Avsluta" : "Ta bort"}</button>`;
  return `<li class="brr-rek" data-id="${esc(r.id)}">
    <div class="brr-rek-huvud"><b>${klass ? "Hela klassen" : esc(namnAv(r.studentId))}</b>
      <span class="brl-svag">${esc(datumText(ms(r.createdAt)))}</span>${knapp}</div>
    <div class="brl-chips">${utm}</div>
    ${r.comment ? `<p class="brr-kommentar">”${esc(r.comment)}”</p>` : ""}
  </li>`;
}

export async function ritaRekommendationer(host, { cls = null, students = [], api, student = null }) {
  const id = `brr${++raknare}`;
  const namn = new Map(students.map((s) => [s.id, namnPa(s)]));
  if (student) namn.set(student.id, namnPa(student));
  const namnAv = (sid) => namn.get(sid) || "Elev";
  const hamta = () => api.listRecs({ classId: cls?.id || null, studentIds: student ? [student.id] : students.map((s) => s.id) });
  let lista = await hamta();

  host.innerHTML = `<div class="brr">
    <p class="brl-svag">En rekommendation syns för eleven som en etikett och i ”Börja här”. Den låser inget och ändrar inga belöningar.</p>
    ${formHtml(id, { cls, students, student })}
    <h4 class="brl-h4">Aktiva rekommendationer</h4>
    <ul class="brr-lista"></ul>
  </div>`;
  const ul = host.querySelector(".brr-lista");
  const rita = () => {
    ul.innerHTML = lista.length ? lista.map((r) => recHtml(r, namnAv, student && r.classId ? false : undefined)).join("")
      : `<li class="brl-svag">Inga aktiva rekommendationer.</li>`;
  };
  rita();

  const form = host.querySelector(".brr-form");
  const msg = form.querySelector(".brr-msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const [typ, malId] = form.querySelector(".brr-mal").value.split(/:(.*)/s);
    const ids = [...form.querySelectorAll(".brr-utm input:checked")].map((i) => i.value);
    const knapp = form.querySelector("button[type=submit]");
    knapp.disabled = true;
    msg.textContent = "Sparar …";
    try {
      const rek = await api.createRec({
        classId: typ === "k" ? malId : null, studentId: typ === "s" ? malId : null,
        challengeIds: ids, comment: form.querySelector(".brr-komm").value,
      });
      lista = [rek, ...lista];
      rita();
      form.querySelectorAll(".brr-utm input:checked").forEach((i) => (i.checked = false));
      form.querySelector(".brr-komm").value = "";
      msg.textContent = `✓ Rekommenderat till ${typ === "k" ? "hela klassen" : namnAv(malId)}.`;
    } catch (err) {
      msg.textContent = err.message || "Kunde inte spara.";
    } finally {
      knapp.disabled = false;
    }
  });

  ul.addEventListener("click", async (e) => {
    const b = e.target.closest(".brr-bort");
    if (!b) return;
    if (!b.dataset.bekrafta) {
      b.dataset.bekrafta = "1";
      b.textContent = b.dataset.klass === "1" ? "Bekräfta: avsluta" : "Bekräfta: ta bort";
      return;
    }
    b.disabled = true;
    try {
      if (b.dataset.klass === "1") await api.endRec(b.dataset.id);
      else await api.deleteRec(b.dataset.id);
      lista = lista.filter((r) => r.id !== b.dataset.id);
      rita();
    } catch (err) {
      b.disabled = false;
      b.textContent = `Gick inte: ${err.message}`;
    }
  });
}
