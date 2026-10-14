// ============================================================================
// Pluggporten – elevsidor
// Inloggning, avatarval, startsida, plugga (områdesval), shop/rum-platshållare
// och profil. Router och gemensam layout finns i app.js / ui.js.
// ============================================================================

import * as data from "./data.js";
import { AVATARS, avatarSvg, avatarName, avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { app, el, go, loading, renderTopbar, getLockGate, escHtml } from "./ui.js";
import { coinIcon } from "./icons.js";
// isTeacher re-exporteras inte via data.js – auth.js ligger redan i bootgrafen.
import { isTeacher, takeSessionLostNotice } from "./auth.js";
// Synlighetsgaten (browser-fri, re-exporteras via game-shared.js precis som i
// gamemodes.js – redan i bootgrafen) avgör om ett område har SPELBART innehåll
// för just den här eleven (issue #308).
import { visibleGamemodesForClassArea, areaStarModes } from "./game-shared.js";

// --- Inloggning: porten (issue #338) -----------------------------------------
// Elevernas inloggning är sidans "framdörr": en trägrind i spelvärldens stil
// som ramar in login-kortet. Live-porten är den MAJESTÄTISKA Variant B
// (art-port-majestic.js, valdes i #344) – Variant A (art-port.js) lämnas kvar
// oanvänd i repot så vi enkelt kan byta tillbaka. Grind-SVG:n laddas DYNAMISKT
// så bootgrafen inte växer (#271) – misslyckas laddningen visas kortet i en
// vanlig panel i stället (inloggningen fungerar alltid). Lärarens inloggning
// bor på sin egen route (#/larare → lärarspärren), skild från porten.

export async function pageElevLogin() {
  // Redan inloggad? Gå direkt in i hus-scenen (lärare till lärarsidan) INNAN
  // topbaren ritas om: renderTopbar() på #/ gömmer sidomenyn, och den levande
  // hus-scenens visaNiva-genväg ritar aldrig om den → menyn blev kvar gömd.
  if (data.isLoggedIn()) return go("#/elev/hus");
  if (isTeacher()) return go("#/larare/klasser");
  renderTopbar();

  // Login-kortet: byggs (och riggas) EN gång och placeras sedan antingen
  // framför grinden eller i fallback-panelen. KOMPAKT skylt-panel i portens
  // öppning (lead-feedback): inga synliga fältetiketter (placeholder +
  // aria-label i stället) så porten syns runt omkring formuläret.
  const card = el(`<div class="port-login">
    <div id="msg"></div>
    <form id="form">
      <input id="u" name="u" autocomplete="username" autocapitalize="none"
        placeholder="Användarnamn" aria-label="Användarnamn" />
      <input id="p" name="p" type="password" autocomplete="current-password"
        placeholder="Lösenord" aria-label="Lösenord" />
      <label class="check" for="remember">
        <input type="checkbox" id="remember" name="remember" checked />
        <span>Kom ihåg mig</span>
      </label>
      <button class="btn stor gron" type="submit" id="submit">Logga in</button>
    </form>
  </div>`);

  const msg = card.querySelector("#msg");
  // Sessionen tappades medan eleven var inne (#464, t.ex. utloggad i en annan flik).
  if (takeSessionLostNotice()) {
    msg.innerHTML = `<div class="msg error">Du har loggats ut. Logga in igen.</div>`;
  }
  card.querySelector("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.innerHTML = "";
    const btn = card.querySelector("#submit");
    btn.disabled = true;
    btn.textContent = "Loggar in…";
    try {
      const res = await data.login(
        card.querySelector("#u").value,
        card.querySelector("#p").value,
        card.querySelector("#remember").checked
      );
      if (res.ok) {
        // Första gången (ingen avatar vald) → låt eleven välja sin figur.
        // Annars: landa direkt i hus-scenen (ingen mellanliggande hem-sida).
        const chosen = await data.hasChosenAvatar().catch(() => true);
        // Porten öppnas + zoom in i världen (#339). Ren dekor som ALDRIG får
        // blockera inloggningen: modulen förladdades vid sidrenderingen, och
        // startaPortOvergang lyfter scenen till ett självstädande overlay –
        // navigeringen nedan sker direkt oavsett om övergången kunde starta
        // (reduced motion / fallback-panel / fel → false, samma go()).
        // Förstagångs-eleven går till avatarvalet UTAN animation – porten
        // "kliver man in genom" först när man landar i världen.
        if (chosen && overgangP) {
          try {
            const mod = await overgangP;
            mod?.startaPortOvergang(card.closest(".port-scen"));
          } catch {}
        }
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

  // Grind-scenen: dynamisk import med snäll fallback (se kommentaren ovan).
  let scenSvg = "";
  try {
    const mod = await import("./art-port-majestic.js");
    scenSvg = mod.portScenMajestic();
  } catch (err) {
    console.error("Porten kunde inte laddas – visar enkel inloggning:", err);
  }

  // Övergångs-modulen (#339) förladdas i bakgrunden medan eleven skriver sitt
  // lösenord, så inloggningsklicket aldrig väntar på ett modul-fetch. Dynamisk
  // import (bootgrafen växer inte, #271) + catch → null = ingen animation.
  const overgangP = scenSvg
    ? import("./port-overgang.js").catch(() => null)
    : null;

  // Diskret direktlänk till lärarens egen inloggningssida (vanlig hash-länk –
  // routern lyssnar på hashchange, ingen extra rigg behövs).
  const larareRad = `<p class="port-larare-rad">
    <a class="port-larare-lank" href="#/larare">Lärare →</a>
  </p>`;

  let view;
  if (scenSvg) {
    // Scenen är position:fixed och fyller HELA viewporten (lead-beslut #338:
    // färgad helskärm, ingen centrerad ruta) – skylten och lärarlänken ligger
    // därför INUTI scenen (absolut positionerade i styles.css).
    view = el(`<div class="port-sida">
      <div class="port-scen">${scenSvg}${larareRad}</div>
    </div>`);
    view.querySelector(".port-scen").appendChild(card);
  } else {
    view = el(`<div>
      <div class="panel port-fallback"></div>
      ${larareRad}
    </div>`);
    view.querySelector(".port-fallback").appendChild(card);
  }
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

  // Korten (#702): ämnesfärg, "X av Y ★" och "Ny!" byggs i plugga-framsteg.js –
  // bara dynamiskt (#271). Saknas den blir korten orange utan stapel, som förr.
  const framstegMod = import("./plugga-framsteg.js").catch(() => null);

  let subjects;
  let studentClass = null; // elevens klass – för tilldelning OCH lägessynlighet.
  let assigned = null; // Map "subjectId/areaId" → tilldelningsraden om klassen har tilldelning, annars null.
  let las = null; // fokusläget (#436): aktivt klass-lås → bara målområdet listas
  let progress = {}; // studentData.progress – cachad läsning, samma som sidomenyn (#231)
  try {
    // Elevens klass (för att ev. filtrera på tilldelade områden) parallellt med ämnen.
    const [subj, cls, gate, prog] = await Promise.all([
      data.getSubjects(),
      data.getClassForStudent().catch(() => null),
      getLockGate(),
      data.getProgress().catch(() => ({})),
    ]);
    las = gate;
    subjects = subj;
    studentClass = cls;
    progress = prog || {};
    const list = cls && Array.isArray(cls.assignedAreas) ? cls.assignedAreas : [];
    if (list.length > 0) {
      assigned = new Map(list.map((a) => [`${a.subjectId}/${a.areaId}`, a]));
    }
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda innehållet: ${err.message}</div></div>`)
    );
    return;
  }
  const mod = await framstegMod;

  const areaCards = [];
  for (const [subjIndex, subj] of subjects.entries()) {
    const areas = await data.getAreas(subj.id);
    for (const a of areas) {
      // Fokusläge (#436)? Visa BARA låsets mål. Annars: har klassen en
      // tilldelning? Visa då BARA de tilldelade områdena.
      if (las) {
        if (!las.allowsArea(subj.id, a.id)) continue;
      } else if (assigned && !assigned.has(`${subj.id}/${a.id}`)) continue;
      // Dölj områden utan SPELBART innehåll för den här eleven (#308) – samma
      // resolution som områdesöversikten (visibleGamemodesForClassArea: underlag
      // minus lägen läraren bockat ur). Lärarvyn listar fortfarande tomma områden.
      if (visibleGamemodesForClassArea(a, studentClass).length === 0) continue;
      areaCards.push(areaCardHtml(mod, { subj, subjIndex, area: a, progress, studentClass,
        assignment: assigned?.get(`${subj.id}/${a.id}`) || null }));
    }
  }

  const view = el(`<div>
    <div class="pl-huvud">
      <h1>${las ? "Fokus just nu" : "Plugga"}</h1>
      <p>${las
        ? `Din lärare har låst klassen till <b>${escHtml(las.label)}</b> till ${las.klockslag}. Sen är allt öppet igen!`
        : assigned
        ? "Din lärare har valt ut det här åt klassen."
        : "Välj ett område och börja öva!"}</p>
    </div>
    <div class="sektion-rubrik"><h2>Dina områden</h2></div>
    <div class="kompakt-grid">
      ${areaCards.join("") || '<p class="hint">Inga arbetsområden ännu. Be din lärare fylla på innehåll.</p>'}
    </div>
  </div>`);

  view.querySelectorAll(".omrade-kort").forEach((btn) => {
    btn.addEventListener("click", () => {
      const subj = btn.dataset.subj;
      const area = btn.dataset.area;
      go(`#/elev/omrade?subj=${encodeURIComponent(subj)}&area=${encodeURIComponent(area)}`);
    });
  });

  app.replaceChildren(view);
}

/**
 * Ett kompakt områdeskort (#702): emoji-ruta, ämnet i små versaler, namnet och
 * en framstegsrad "★ X av Y" (samma areaStarCount som "Ditt framsteg" inne i
 * området). Inga stjärn-lägen → ingen stapel. `mod` = plugga-framsteg.js eller
 * null (laddningen misslyckades → orange kort utan stapel/märke).
 */
function areaCardHtml(mod, { subj, subjIndex, area, progress, studentClass, assignment }) {
  const color = mod ? mod.subjectColor(subj, subjIndex) : "orange";
  let framsteg = "";
  const starModes = mod ? areaStarModes(area, studentClass).map((gm) => gm.id) : [];
  if (starModes.length) {
    const { stars, maxStars, pct } = mod.areaStarCount({ areaId: area.id, progress, starModes });
    framsteg = `<span class="framsteg" aria-label="${stars} av ${maxStars} stjärnor">
        <span class="stapel" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span aria-hidden="true">★ ${stars} av ${maxStars}</span></span>`;
  }
  const ny = mod && mod.isAreaNew({ area, assignment, progress }) ? `<span class="nymarke">Ny!</span>` : "";
  return `<button class="big-card ${color} kompakt omrade-kort" data-subj="${escHtml(subj.id)}" data-area="${escHtml(area.id)}">
      ${ny}<span class="emoji" aria-hidden="true">${area.coverEmoji || "📖"}</span>
      <span class="txt">
        <span class="amne">${escHtml(subj.name || subj.id)}</span>
        <span class="title">${escHtml(area.name || area.id)}</span>
        ${framsteg}
      </span>
    </button>`;
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
