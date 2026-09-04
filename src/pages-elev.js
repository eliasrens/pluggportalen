// ============================================================================
// Pluggportalen – elevsidor
// Inloggning, avatarval, startsida, plugga (områdesval), shop/rum-platshållare
// och profil. Router och gemensam layout finns i app.js / ui.js.
// ============================================================================

import * as data from "./data.js";
import { AVATARS, avatarSvg, avatarName, avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { app, el, go, loading, renderTopbar } from "./ui.js";
import { coinIcon } from "./icons.js";

// --- Inloggning -------------------------------------------------------------

export function pageElevLogin() {
  renderTopbar();
  // Redan inloggad? Gå direkt in i hus-scenen.
  if (data.isLoggedIn()) return go("#/elev/hus");

  const view = el(`<div>
    <a class="back-link" id="back">← Tillbaka</a>
    <div class="panel">
      <h1 class="center">Logga in 🎒</h1>
      <div id="msg"></div>
      <form id="form">
        <div class="field">
          <label for="u">Användarnamn</label>
          <input id="u" name="u" autocomplete="username" autocapitalize="none" placeholder="t.ex. elev1" />
        </div>
        <div class="field">
          <label for="p">Lösenord</label>
          <input id="p" name="p" type="password" autocomplete="current-password" placeholder="Ditt lösenord" />
        </div>
        <label class="check" for="remember">
          <input type="checkbox" id="remember" name="remember" checked />
          <span>Kom ihåg mig på den här datorn</span>
        </label>
        <button class="btn stor gron" type="submit" id="submit">Logga in</button>
      </form>
      <p class="hint center" style="margin-top:16px">
        Testkonto: <b>elev1</b> / <b>123123</b>
      </p>
    </div>
  </div>`);

  const msg = view.querySelector("#msg");
  view.querySelector("#back").addEventListener("click", () => go("#/"));
  view.querySelector("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const btn = view.querySelector("#submit");
    btn.disabled = true;
    btn.textContent = "Loggar in…";
    try {
      const res = await data.login(
        view.querySelector("#u").value,
        view.querySelector("#p").value,
        view.querySelector("#remember").checked
      );
      if (res.ok) {
        // Första gången (ingen avatar vald) → låt eleven välja sin figur.
        // Annars: landa direkt i hus-scenen (ingen mellanliggande hem-sida).
        const chosen = await data.hasChosenAvatar().catch(() => true);
        go(chosen ? "#/elev/hus" : "#/elev/avatar");
      } else {
        msg.innerHTML = `<div class="msg error">${res.error}</div>`;
      }
    } catch (err) {
      msg.innerHTML = `<div class="msg error">Något gick fel: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Logga in";
    }
  });

  app.replaceChildren(view);
}

// --- Avatarval (första gången + byta senare) --------------------------------

export async function pageElevAvatar() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let selected = DEFAULT_AVATAR;
  let firstTime = true;
  let sd = null;
  try {
    sd = await data.getStudentData();
    selected = sd.avatarId || DEFAULT_AVATAR;
    firstTime = !sd.avatarChosen;
  } catch {}
  const buttons = Object.keys(AVATARS)
    .map(
      (id) =>
        `<button class="avatar-opt${id === selected ? " selected" : ""}" data-id="${id}" title="${avatarName(id)}">${avatarSvg(id)}</button>`
    )
    .join("");

  const view = el(`<div>
    ${firstTime ? "" : '<a class="back-link" id="back">← Till profilen</a>'}
    <div class="panel center">
      <h1>${firstTime ? "Välj din figur! 🎉" : "Byt figur"}</h1>
      <p class="hint">${firstTime
        ? "Vilken figur vill du vara? Du kan byta när du vill i profilen."
        : "Välj en ny figur. Den syns överallt när du pluggar."}</p>
      <div class="preview" id="preview">${avatarSvg(selected)}</div>
      <div class="avatar-pick" id="grid">${buttons}</div>
      <div id="msg"></div>
      <button class="btn stor gron" id="save">${firstTime ? "Kör igång!" : "Spara"}</button>
    </div>
  </div>`);

  const grid = view.querySelector("#grid");
  const preview = view.querySelector("#preview");
  const msg = view.querySelector("#msg");

  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".avatar-opt");
    if (!b) return;
    selected = b.dataset.id;
    grid.querySelectorAll(".avatar-opt").forEach((x) => x.classList.remove("selected"));
    b.classList.add("selected");
    preview.innerHTML = avatarSvg(selected);
  });

  if (!firstTime) {
    view.querySelector("#back").addEventListener("click", () => go("#/elev/profil"));
  }

  view.querySelector("#save").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Sparar…";
    msg.innerHTML = "";
    try {
      await data.setAvatar(selected);
      await renderTopbar();
      go(firstTime ? "#/elev/hus" : "#/elev/profil");
    } catch (err) {
      msg.innerHTML = `<div class="msg error">Kunde inte spara: ${err.message}</div>`;
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  app.replaceChildren(view);
}

// Hem-hjälten (pageElevHem) är slopad: eleven landar direkt i hus-scenen
// (#/elev/hus, se pages-varld.js) efter inloggning. Plugga och Shoppen nås via
// sidomenyn (NAV_LANKAR i ui.js). #/elev/hem omdirigeras till #/elev/hus i app.js.

// --- Plugga (välj arbetsområde) ---------------------------------------------

export async function pageElevPlugga() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let subjects;
  let assigned = null; // Set av "subjectId/areaId" om klassen har tilldelning, annars null.
  try {
    // Elevens klass (för att ev. filtrera på tilldelade områden) parallellt med ämnen.
    const [subj, cls] = await Promise.all([
      data.getSubjects(),
      data.getClassForStudent().catch(() => null),
    ]);
    subjects = subj;
    const list = cls && Array.isArray(cls.assignedAreas) ? cls.assignedAreas : [];
    if (list.length > 0) {
      assigned = new Set(list.map((a) => `${a.subjectId}/${a.areaId}`));
    }
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda innehållet: ${err.message}</div></div>`)
    );
    return;
  }

  const areaCards = [];
  for (const subj of subjects) {
    const areas = await data.getAreas(subj.id);
    for (const a of areas) {
      // Har klassen en tilldelning? Visa då BARA de tilldelade områdena.
      if (assigned && !assigned.has(`${subj.id}/${a.id}`)) continue;
      areaCards.push(`<button class="big-card orange area-card" data-subj="${subj.id}" data-area="${a.id}">
        <span class="emoji">${a.coverEmoji || "📖"}</span>
        <span class="title">${a.name}</span>
        <span class="sub">${subj.name}</span>
      </button>`);
    }
  }

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>${assigned ? "Det här jobbar vi med nu 📌" : "Plugga ✏️"}</h1>
      <p class="hint">${assigned
        ? "Din lärare har valt ut det här åt klassen. Välj ett område och börja öva!"
        : "Välj ett arbetsområde och börja öva!"}</p>
    </div>
    <div class="card-grid">
      ${areaCards.join("") || '<p class="hint">Inga arbetsområden ännu. Be din lärare fylla på innehåll.</p>'}
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hus"));
  view.querySelectorAll(".area-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const subj = btn.dataset.subj;
      const area = btn.dataset.area;
      go(`#/elev/omrade?subj=${encodeURIComponent(subj)}&area=${encodeURIComponent(area)}`);
    });
  });

  app.replaceChildren(view);
}

// Shoppen ligger i pages-shop.js och Mitt rum i pages-rum.js. Profilen nedan.

// --- Profil -----------------------------------------------------------------

export async function pageElevProfil() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();
  const session = data.getSession();

  let stats, avatar, avatarItems;
  try {
    const [sd, s] = await Promise.all([data.getStudentData(), data.getStats()]);
    avatar = sd.avatarId || DEFAULT_AVATAR;
    avatarItems = sd.avatarItems || [];
    stats = s;
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda profilen: ${err.message}</div></div>`)
    );
    return;
  }

  const view = el(`<div>
    <div class="panel center">
      <div class="hero-avatar">${avatarMarkup(avatar, avatarItems)}</div>
      <h1>${session.namn}</h1>
      <p class="hint">Användarnamn: <b>${session.username || ""}</b></p>
      <div class="btn-row center">
        <button class="btn liten" id="byt-avatar">Byt figur</button>
        <button class="btn liten ghost" id="till-rum">🛏️ Mitt rum</button>
      </div>
    </div>

    <h2>Min statistik</h2>
    <div class="stat-grid">
      <div class="stat-card gul">
        <div class="stat-emoji">${coinIcon(35)}</div>
        <div class="stat-tal">${stats.coins}</div>
        <div class="stat-etikett">pluggcoins</div>
      </div>
      <div class="stat-card gron">
        <div class="stat-emoji">✏️</div>
        <div class="stat-tal">${stats.playedExercises}</div>
        <div class="stat-etikett">spelade övningar</div>
      </div>
      <div class="stat-card bla">
        <div class="stat-emoji">⭐</div>
        <div class="stat-tal">${stats.stars}</div>
        <div class="stat-etikett">stjärnor</div>
      </div>
      <div class="stat-card lila">
        <div class="stat-emoji">📚</div>
        <div class="stat-tal">${stats.areas}</div>
        <div class="stat-etikett">områden</div>
      </div>
    </div>
    ${
      stats.playedExercises === 0
        ? '<p class="hint center" style="margin-top:16px">Du har inte spelat någon övning än. Gå till <b>Plugga</b> och kom igång! 🚀</p>'
        : ""
    }
  </div>`);

  view.querySelector("#byt-avatar").addEventListener("click", () => go("#/elev/avatar"));
  view.querySelector("#till-rum").addEventListener("click", () => go("#/elev/rum"));

  app.replaceChildren(view);
}
