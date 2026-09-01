// ============================================================================
// Pluggportalen – Min klass (#/elev/klassfoto)
// ----------------------------------------------------------------------------
// En glad "klassfoto"-vy där den inloggade eleven ser sina KLASSKAMRATER –
// figurerna (grundavatar + ev. burna kläder) med namn, som ett gruppfoto. Den
// egna figuren markeras tydligt med "Du!". Klick på en klasskamrat öppnar deras
// rum i läsläge (#/elev/klasskamrat?id=…). Klick på den egna figuren går till
// det egna (redigerbara) rummet.
//
// Klassen hämtas via data.getClassForStudent(meId) → klassens studentIds.
// Saknar eleven klass, eller är klassen tom, faller vi snällt tillbaka på ALLA
// elever (med ett vänligt meddelande). Ingen skrivning sker här – bara läsning.
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
  loading("Hämtar din klass…");
  await renderTopbar();

  const meId = data.currentStudentId();

  let students;
  let klass = null;
  try {
    [students, klass] = await Promise.all([
      data.getStudentsWithLooks(),
      data.getClassForStudent(meId).catch(() => null),
    ]);
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda din klass: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  // Filtrera till elevens egen klass om den finns och har medlemmar. Annars
  // faller vi snällt tillbaka på alla elever (och säger det i texten).
  const classIds = Array.isArray(klass?.studentIds) ? klass.studentIds : [];
  let visade = students;
  let fallback = true;
  if (classIds.length > 0) {
    const inClass = students.filter((s) => classIds.includes(s.id));
    if (inClass.length > 0) {
      visade = inClass;
      fallback = false;
    }
  }

  // Sortera på namn (svensk kollation), men lägg alltid den egna figuren först.
  visade = visade.slice().sort((a, b) => {
    if (a.id === meId) return -1;
    if (b.id === meId) return 1;
    return String(a.namn || "").localeCompare(String(b.namn || ""), "sv");
  });

  const cards = visade
    .map((s) => {
      const me = s.id === meId;
      const namn = esc(s.namn || s.username || s.id);
      // Egen figur → eget rum. Klasskamrat → läs-vy av deras rum.
      const href = me ? "#/elev/rum" : `#/elev/klasskamrat?id=${encodeURIComponent(s.id)}`;
      const title = me ? "Gå till ditt rum" : `Se ${namn}s rum`;
      return `<button class="foto-card${me ? " du" : ""}" data-href="${href}" title="${title}">
        ${me ? '<span class="foto-du">Du!</span>' : ""}
        <div class="foto-figur">${avatarMarkup(s.avatarId || DEFAULT_AVATAR, s.avatarItems || [])}</div>
        <span class="foto-namn">${namn}</span>
      </button>`;
    })
    .join("");

  const rubrik = fallback ? "Alla elever 👩‍👦‍👦" : `Min klass 👩‍👦‍👦`;
  const klassnamn = !fallback && klass?.name ? ` – ${esc(klass.name)}` : "";
  const hint = fallback
    ? "Du är inte med i någon klass än, så här ser du alla elever. Klicka på en kompis figur för att titta in i deras rum!"
    : "Här är du och dina klasskamrater. Klicka på en kompis figur för att titta in i deras rum! Du är märkt med <b>Du!</b>";

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>${rubrik}${klassnamn}</h1>
      <p class="hint">${hint}</p>
    </div>
    <div class="foto-grid">
      ${cards || '<p class="hint">Det finns inga elever att visa än.</p>'}
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));
  view.querySelector(".foto-grid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-href]");
    if (card) go(card.dataset.href);
  });

  app.replaceChildren(view);
}
