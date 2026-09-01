// ============================================================================
// Pluggportalen – Klassfoto (#/elev/klassfoto)
// ----------------------------------------------------------------------------
// En glad "klassfoto"-vy där den inloggade eleven ser ALLA elevers figurer
// (grundavatar + ev. burna kläder) med namn – som ett gruppfoto. Den egna
// figuren markeras tydligt med "Du!".
//
// Läser bara data: data.getStudentsWithLooks() hämtar avatarId + avatarItems
// för alla elever (parallellt, per-elev catch). Ingen skrivning sker här.
//
// Det finns ännu inga "klasser" i appen – vi visar alla elever. Vyn är byggd så
// att den lätt kan filtreras per klass i framtiden (bara filtrera listan innan
// rendering), men ingen klass-logik finns här (separat uppgift).
//
// Additivt tillägg – håll separat för enkel rebase (jfr #/larare/klass).
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { app, el, go, loading, renderTopbar } from "./ui.js";

/** Minimal HTML-escape för elevnamn som kommer från Firestore. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export async function pageElevKlassfoto() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading("Hämtar klassfotot…");
  await renderTopbar();

  const meId = data.currentStudentId();

  let students;
  try {
    students = await data.getStudentsWithLooks();
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda klassfotot: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  // Sortera på namn (svensk kollation), men lägg alltid den egna figuren först.
  students = students.slice().sort((a, b) => {
    if (a.id === meId) return -1;
    if (b.id === meId) return 1;
    return String(a.namn || "").localeCompare(String(b.namn || ""), "sv");
  });

  const cards = students
    .map((s) => {
      const me = s.id === meId;
      const namn = esc(s.namn || s.username || s.id);
      return `<div class="foto-card${me ? " du" : ""}">
        ${me ? '<span class="foto-du">Du!</span>' : ""}
        <div class="foto-figur">${avatarMarkup(s.avatarId || DEFAULT_AVATAR, s.avatarItems || [])}</div>
        <span class="foto-namn">${namn}</span>
      </div>`;
    })
    .join("");

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>Klassfoto 📸</h1>
      <p class="hint">Här är alla elever och deras figurer. Hitta dig själv – du är märkt med <b>Du!</b></p>
    </div>
    <div class="foto-grid">
      ${cards || '<p class="hint">Det finns inga elever att visa än.</p>'}
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));

  app.replaceChildren(view);
}
