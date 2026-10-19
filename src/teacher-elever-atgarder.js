// ============================================================================
// Pluggporten – lärarsidan: elevtabellens åtgärder (teacher-elever-atgarder.js)
// ----------------------------------------------------------------------------
// #805 (epic #802 §3.4). Panelerna som öppnas under en rad (valen i menyn ⋯)
// och under knapparna för hela klassen i Mina klasser → Elever:
//   rad:   namn → Ändra namn och avatar · mynt → Ge mynt ·
//          ur → Ta ur klassen · bort → Ta bort konto (båda bekräftas här)
//   klass: mynt → Ge hela klassen mynt · lagg-till → Lägg till elev
//          (skapa nya konton + lägg till befintliga, som förut)
// Samma data-anrop som förra medlemshanteraren (teacher-class-accounts.js);
// felen visas i panelen i stället för alert(), och bekräftelsen är en ruta på
// sidan (teacher-bekrafta.js) i stället för confirm(). Laddas via
// teacher-elever-tabell.js (#271).
// ============================================================================

import * as data from "./data.js";
import { el, errText, esc, icon } from "./teacher-shared.js";
import { coinIcon } from "./icons.js";
import { giveCoinsHtml, renderAddExisting, renderCreateAccounts, renderNameEditor, wireGiveCoins } from "./teacher-class-accounts.js";
import { fordelaMynt } from "./teacher-elever-val.js";
import { bekrafta } from "./teacher-bekrafta.js";

const ram = (host, titel, stang) => {
  const box = el(`<div class="et-panelram">
    <div class="et-panelhuvud"><b>${esc(titel)}</b>
      <button type="button" class="btn ghost small et-stang" aria-label="Stäng">${icon("x", 16)}</button></div>
    <div class="et-panelkropp"></div>
  </div>`);
  box.querySelector(".et-stang").addEventListener("click", stang);
  host.replaceChildren(box);
  host.hidden = false;
  return box.querySelector(".et-panelkropp");
};

/**
 * Panelen under en elevrad för valet `typ` i menyn ⋯.
 * @param {{cls, s, students, stang, namnAndrat, saldo, borta, fel}} o  fel(html) = besked ovanför tabellen
 */
export function oppnaRadpanel(host, typ, { cls, s, students, stang, namnAndrat, saldo, borta, fel }) {
  const namn = esc(s.namn || s.username || s.id);
  const klass = esc(cls.name || cls.id);
  host.hidden = false;
  if (typ === "namn") return renderNameEditor(ram(host, "Ändra namn och avatar", stang), s, namnAndrat);
  if (typ === "mynt") {
    const kropp = ram(host, `Ge mynt till ${s.namn || s.username || s.id}`, stang);
    kropp.innerHTML = giveCoinsHtml();
    wireGiveCoins(kropp, s, saldo);
    return kropp.querySelector(".gc-amount").focus();
  }
  if (typ === "ur") {
    return bekrafta(host, {
      text: `Ta <b>${namn}</b> ur klassen ${klass}? Kontot finns kvar och kan läggas till igen under Lägg till elev.`,
      knapp: "Ta ur klassen",
      onAvbryt: stang,
      onJa: async () => {
        const nextIds = (cls.studentIds || []).filter((id) => id !== s.id);
        await data.setClassStudents(cls.id, nextIds);
        cls.studentIds = nextIds;
        borta();
      },
    });
  }
  if (typ === "bort") {
    return bekrafta(host, {
      text: `Ta bort kontot för <b>${namn}</b>? Detta tar även bort elevens speldata och går inte att ångra.`,
      knapp: "Ta bort konto",
      onAvbryt: stang,
      onJa: async () => {
        // Ur klassen FÖRST: setClassStudents skriver students/{id}.classIds (merge) och
        // återskapade förr ett tomt elevdokument när kontot redan var raderat (#805).
        const nextIds = (cls.studentIds || []).filter((id) => id !== s.id);
        await data.setClassStudents(cls.id, nextIds);
        cls.studentIds = nextIds;
        try {
          await data.deleteStudent(s.id);
        } catch (err) {
          // Eleven är redan ur klassen – rita om (raden försvinner) och säg att kontot finns kvar (#805 F4).
          borta();
          fel(`Kunde inte ta bort kontot för <b>${namn}</b> (${esc(errText(err))}). Eleven är tagen ur klassen ${klass}, men kontot finns kvar – lägg till eleven igen under Lägg till elev, eller försök igen.`);
          return;
        }
        const idx = students.findIndex((x) => x.id === s.id);
        if (idx >= 0) students.splice(idx, 1);
        borta();
      },
    });
  }
  host.hidden = true;
}

/**
 * Panelen under knapparna för hela klassen (bara admin).
 * @param {{cls, students, medlemmar, stang, saldo, skapade, tillagda}} o
 */
export function oppnaKlasspanel(host, typ, { cls, students, medlemmar, stang, saldo, skapade, tillagda }) {
  if (typ === "lagg-till") {
    const kropp = ram(host, "Lägg till elev", stang);
    const delar = el(`<div class="et-lagg-till">
      <details class="mm-add" open><summary>${icon("plus", 16)} Skapa nya elevkonton i klassen</summary>
        <div class="mm-add-body et-skapa"></div></details>
      <details class="mm-add"><summary>${icon("link", 16)} Lägg till befintliga elever</summary>
        <div class="mm-add-body mm-existing"></div></details>
    </div>`);
    kropp.replaceChildren(delar);
    renderCreateAccounts(delar.querySelector(".et-skapa"), { cls, students, onCreated: (c, fel) => (stang(), skapade(c, fel)) });
    renderAddExisting(delar.querySelector(".mm-existing"), { cls, students, onAdded: () => (stang(), tillagda()) });
    return;
  }
  if (typ !== "mynt") return stang();
  const kropp = ram(host, "Ge hela klassen mynt", stang);
  kropp.innerHTML = `<p class="hint">Alla ${medlemmar().length} elever i ${esc(cls.name || cls.id)} får lika många mynt var.</p>
    ${giveCoinsHtml()}<div class="et-mynt-bekrafta"></div>`;
  const amountEl = kropp.querySelector(".gc-amount");
  const flash = kropp.querySelector(".gc-flash");
  const bekraftaHost = kropp.querySelector(".et-mynt-bekrafta");
  kropp.querySelectorAll(".gc-quick").forEach((b) => b.addEventListener("click", () => ((amountEl.value = b.dataset.add), amountEl.focus())));
  kropp.querySelector(".gc-give").addEventListener("click", () => {
    const { antal, fel } = fordelaMynt(amountEl.value);
    if (fel) return void (flash.innerHTML = `<span class="gc-err">${esc(fel)}</span>`, amountEl.focus());
    flash.innerHTML = "";
    const elever = medlemmar();
    bekrafta(bekraftaHost, {
      text: `Ge <b>${antal}</b> ${coinIcon("1em")} till var och en av ${elever.length} elever i ${esc(cls.name || cls.id)}?`,
      knapp: "Ja, ge mynt",
      farlig: false,
      onAvbryt: () => bekraftaHost.replaceChildren(),
      onJa: async (ruta) => {
        const msg = ruta.querySelector(".et-bekrafta-msg");
        const misslyckade = [];
        // En elev i taget (samma addCoins som Ge mynt per elev): inga parallella transaktioner.
        for (let i = 0; i < elever.length; i++) {
          msg.innerHTML = `<span class="hint">Ger mynt… ${i + 1}/${elever.length}</span>`;
          try {
            saldo(elever[i].id, await data.addCoins(antal, elever[i].id));
          } catch {
            misslyckade.push(elever[i].namn || elever[i].username || elever[i].id);
          }
        }
        const klara = elever.length - misslyckade.length;
        bekraftaHost.replaceChildren();
        flash.innerHTML = `<span class="gc-ok">✓ ${klara} elev${klara === 1 ? "" : "er"} fick ${antal} ${coinIcon("1em")} var.</span>` +
          (misslyckade.length ? ` <span class="gc-err">Gick inte för: ${esc(misslyckade.join(", "))}.</span>` : "");
      },
    });
  });
  amountEl.focus();
}
