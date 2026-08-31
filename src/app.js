// ============================================================================
// Pluggportalen – app.js
// Enkel hash-router och gemensam layout. Sidor:
//   #/            startsida (välj lärare eller elev)
//   #/elev        elev-inloggning
//   #/elev/hem    elev-startsida (kräver inloggning)
//   #/larare      lärarsida (enkel start – byggs ut i senare issues)
//
// Hash-routing används medvetet så att GitHub Pages inte behöver någon
// server-omskrivning (alla "sidor" ligger i index.html).
// ============================================================================

import * as data from "./data.js";

const app = document.getElementById("app");
const topbarRight = document.getElementById("topbar-right");

// Avatarer (id → emoji). Delas med shop/rum i senare issues.
export const AVATARS = {
  fox: "🦊",
  owl: "🦉",
  cat: "🐱",
  dog: "🐶",
  panda: "🐼",
  frog: "🐸",
  unicorn: "🦄",
  dragon: "🐲",
};

// --- Hjälpare ---------------------------------------------------------------

function go(hash) {
  window.location.hash = hash;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function loading(msg = "Laddar…") {
  app.innerHTML = `<div class="spinner">${msg}</div>`;
}

async function renderTopbar() {
  const session = data.getSession();
  if (session) {
    let coins = 0;
    try {
      coins = await data.getCoins();
    } catch {}
    topbarRight.innerHTML = "";
    const wrap = el(`<div style="display:flex;align-items:center;gap:12px">
      <span class="coins">🪙 ${coins}</span>
      <button class="btn ghost" id="logout-btn">Logga ut</button>
    </div>`);
    wrap.querySelector("#logout-btn").addEventListener("click", () => {
      data.logout();
      go("#/");
    });
    topbarRight.replaceChildren(wrap);
  } else {
    topbarRight.innerHTML = "";
  }
}

// --- Sidor ------------------------------------------------------------------

function pageHome() {
  renderTopbar();
  app.replaceChildren(
    el(`<div>
      <div class="panel center">
        <h1>Välkommen till Pluggportalen! 📚</h1>
        <p class="hint">Öva SO på ett roligt sätt – samla pluggcoins och pynta ditt eget rum.</p>
      </div>
      <div class="card-grid">
        <button class="big-card gron" id="to-elev">
          <span class="emoji">🎒</span>
          <span class="title">Jag är elev</span>
          <span class="sub">Logga in och börja plugga</span>
        </button>
        <button class="big-card bla" id="to-larare">
          <span class="emoji">👩‍🏫</span>
          <span class="title">Jag är lärare</span>
          <span class="sub">Se innehåll och elever</span>
        </button>
      </div>
    </div>`)
  );
  app.querySelector("#to-elev").addEventListener("click", () => go("#/elev"));
  app.querySelector("#to-larare").addEventListener("click", () => go("#/larare"));
}

function pageElevLogin() {
  renderTopbar();
  // Redan inloggad? Gå till hemmet.
  if (data.isLoggedIn()) return go("#/elev/hem");

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
        <button class="btn stor gron" type="submit" id="submit">Logga in</button>
      </form>
      <p class="hint center" style="margin-top:16px">
        Testkonto: <b>elev1</b> / <b>passa123</b>
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
        view.querySelector("#p").value
      );
      if (res.ok) {
        go("#/elev/hem");
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

async function pageElevHem() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();
  const session = data.getSession();

  let sd, subjects, avatar;
  try {
    [sd, subjects] = await Promise.all([data.getStudentData(), data.getSubjects()]);
    avatar = sd.avatarId || "fox";
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda din sida: ${err.message}</div></div>`)
    );
    return;
  }

  const areaCards = [];
  for (const subj of subjects) {
    const areas = await data.getAreas(subj.id);
    for (const a of areas) {
      areaCards.push(`<button class="big-card orange area-card" data-subj="${subj.id}" data-area="${a.id}">
        <span class="emoji">${a.coverEmoji || "📖"}</span>
        <span class="title">${a.name}</span>
        <span class="sub">${subj.name}</span>
      </button>`);
    }
  }

  const view = el(`<div>
    <div class="panel center">
      <div style="font-size:3.4rem">${AVATARS[avatar] || "🦊"}</div>
      <h1>Hej ${session.namn}! 👋</h1>
      <p class="hint">Du har <b>🪙 ${sd.coins || 0}</b> pluggcoins. Välj ett arbetsområde och börja öva!</p>
    </div>
    <h2>Arbetsområden</h2>
    <div class="card-grid">
      ${areaCards.join("") || '<p class="hint">Inga arbetsområden ännu. Be din lärare fylla på innehåll.</p>'}
    </div>
  </div>`);

  view.querySelectorAll(".area-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Gamemodes byggs i senare issues; visa vänlig platshållare tills vidare.
      alert(
        "Här kommer övningarna (quiz, läsförståelse och para ihop) för " +
          btn.querySelector(".title").textContent +
          " snart! 🚧"
      );
    });
  });

  app.replaceChildren(view);
}

function pageLarare() {
  renderTopbar();
  app.replaceChildren(
    el(`<div>
      <a class="back-link" id="back">← Tillbaka</a>
      <div class="panel">
        <h1>Lärarsida 👩‍🏫</h1>
        <p>Här kommer läraren att kunna hantera arbetsområden och elevkonton.</p>
        <p class="hint">Den fulla lärarsidan byggs i ett senare steg. Grunden – databasen,
          datamodellen och elevinloggningen – är på plats.</p>
        <p class="hint">Fyll databasen med exempeldata via
          <a href="./seed/seed.html">seed-sidan</a>.</p>
      </div>
    </div>`)
  );
  app.querySelector("#back").addEventListener("click", () => go("#/"));
}

function pageNotFound() {
  renderTopbar();
  app.replaceChildren(
    el(`<div class="panel center">
      <h1>Hoppsan! 🙈</h1>
      <p>Den här sidan finns inte.</p>
      <button class="btn" id="home">Till startsidan</button>
    </div>`)
  );
  app.querySelector("#home").addEventListener("click", () => go("#/"));
}

// --- Router -----------------------------------------------------------------

const routes = {
  "/": pageHome,
  "/elev": pageElevLogin,
  "/elev/hem": pageElevHem,
  "/larare": pageLarare,
};

function router() {
  const path = (window.location.hash || "#/").slice(1) || "/";
  const handler = routes[path] || pageNotFound;
  handler();
}

document.getElementById("brand").addEventListener("click", () => go("#/"));
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
// DOMContentLoaded kan redan ha hänt (modulen laddas defer):
if (document.readyState !== "loading") router();
