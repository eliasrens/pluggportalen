// ============================================================================
// Pluggporten – lärarsidan: Mina klasser → Elever (teacher-elever-tabell.js)
// ----------------------------------------------------------------------------
// #805 (epic #802 §3.4). Kompakt elevtabell, EN rad per elev i stället för
// förra medlemshanterarens höga kort:
//   Namn · Användarnamn · Lösenord (Visa) · Mynt (admin, Visa) · ⋯
// Menyn ⋯: Byt lösenord (alla; admin även användarnamn) och för admin Ändra
// namn och avatar, Ge mynt, Ta ur klassen, Ta bort konto. Destruktiva val
// ligger bara i menyn och bekräftas i en ruta under raden (aldrig confirm()).
// Överst knappar för hela klassen: Skriv ut inloggningskort, Ge hela klassen
// mynt (admin), Lägg till elev (admin) – och ett sökfält för namn.
//
// Läsningar: inga nya när fliken öppnas (eleverna kommer ur sidans store).
// Lösenord och mynt hämtas först när läraren klickar Visa, ett dokument för
// just den eleven (samma läsning som Redigera inloggning gjorde förut).
// Behörigheterna är oförändrade – reglerna och Cloud Functionen spärrar på
// riktigt; `admin` styr bara vad som visas. Laddas med import() (#271) från
// teacher-classes-sections.js.
// ============================================================================

import * as data from "./data.js";
import { el, errText, esc, icon } from "./teacher-shared.js";
import { avatarEmoji } from "./avatars.js";
import { coinIcon } from "./icons.js";
import { credentialsPanel } from "./teacher-login-cards.js";
import { byNamn } from "./teacher-class-accounts.js";
import { KLASSKNAPPAR, matcharSok, menyFor } from "./teacher-elever-val.js";
import { oppnaKlasspanel, oppnaRadpanel } from "./teacher-elever-atgarder.js";

/**
 * Rita elevtabellen för klassen `cls` i `host`.
 * @param {object} ctx
 * @param {{cls, state:{students:Array}, host:HTMLElement, admin?:boolean,
 *   onChange?:Function, creds?:{initial, save, clear}}} o
 *   creds = nyss skapade lösenord som ligger kvar över klassbyten (X-08).
 */
export function renderElevTabell(ctx, { cls, state, host, admin = false, onChange, creds }) {
  const students = state.students;
  const klassnamn = cls.name || cls.id;
  let sok = "";
  const credsHost = el(`<div class="mm-creds"></div>`);
  const besked = el(`<div class="et-besked" role="alert"></div>`); // fel som gäller tabellen (t.ex. Ta bort konto, #805 F4)
  const showCreds = (created) =>
    credsHost.replaceChildren(credentialsPanel(klassnamn, created, creds && (() => (creds.clear(), credsHost.replaceChildren()))));
  if (creds?.initial) showCreds(creds.initial);

  const wrap = el(`<div class="et">
    <div class="et-verktyg">
      <div class="et-knappar" role="group" aria-label="För hela klassen"></div>
      <label class="et-sok"><span class="sr-only">Sök elev</span>
        <input type="search" class="et-sok-falt" placeholder="Sök elev…" autocomplete="off" /></label>
    </div>
    <div class="et-klasspanel" hidden></div>
    <div class="et-lista"></div>
    <p class="hint et-fot">${admin
      ? "Ta ur klassen och Ta bort konto ligger i menyn ⋯ och måste bekräftas."
      : "Byt lösenord ligger i menyn ⋯. Elevkonton skapas av admin."}</p>
  </div>`);
  const knappar = wrap.querySelector(".et-knappar");
  const klasspanel = wrap.querySelector(".et-klasspanel");
  const lista = wrap.querySelector(".et-lista");

  const medlemmar = () => {
    const ids = new Set(cls.studentIds || []);
    return students.filter((s) => ids.has(s.id)).sort(byNamn);
  };
  const andrat = () => {
    if (onChange) onChange();
    draw();
  };

  // --- Knapparna för hela klassen ------------------------------------------
  const KNAPPIKON = { "skriv-ut": icon("printer", 16), mynt: coinIcon("1em"), "lagg-till": icon("plus", 16) };
  function ritaKnappar() {
    const n = medlemmar().length;
    // Utskrift och mynt kräver elever i klassen; admin-knapparna finns inte alls för årskurslärare.
    knappar.innerHTML = KLASSKNAPPAR.filter((k) => (admin || !k.admin) && (n || k.key === "lagg-till"))
      .map((k) => k.key === "skriv-ut"
        ? `<button type="button" class="btn small et-skriv-ut">${KNAPPIKON[k.key]}<span>${esc(k.label)}</span></button>`
        : `<button type="button" class="btn ghost small" data-klass="${k.key}" aria-expanded="false">${KNAPPIKON[k.key]}<span>${esc(k.label)}</span></button>`)
      .join("");
  }
  knappar.addEventListener("click", (e) => {
    if (e.target.closest(".et-skriv-ut")) {
      import("./teacher-login-print.js").then((m) => m.openPrintPicker(klassnamn, medlemmar()));
      return;
    }
    const b = e.target.closest("[data-klass]");
    if (!b || !admin) return;
    const typ = b.dataset.klass;
    const redanOppen = klasspanel.dataset.typ === typ && !klasspanel.hidden;
    stangKlasspanel();
    if (redanOppen) return;
    b.setAttribute("aria-expanded", "true");
    klasspanel.dataset.typ = typ;
    klasspanel.hidden = false;
    oppnaKlasspanel(klasspanel, typ, {
      cls, students, medlemmar,
      stang: stangKlasspanel,
      // Ge hela klassen mynt: nya saldon syns i Mynt-kolumnen.
      saldo: (id, nytt) => visaVarde(lista.querySelector(`.et-elev[data-id="${CSS.escape(id)}"] .et-mynt`), `${nytt} ${coinIcon("1em")}`),
      skapade: (created, fel) => {
        if (creds) creds.save(created);
        showCreds(created);
        andrat();
        if (fel) visaKlassfel(fel);
      },
      tillagda: andrat,
    });
  });
  function stangKlasspanel() {
    klasspanel.hidden = true;
    klasspanel.replaceChildren();
    delete klasspanel.dataset.typ;
    knappar.querySelectorAll("[data-klass]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  function visaKlassfel(html) {
    besked.replaceChildren(el(`<div class="msg error" tabindex="-1">${html}</div>`));
    besked.firstElementChild.focus();
  }

  // --- Sök ------------------------------------------------------------------
  const sokFalt = wrap.querySelector(".et-sok-falt");
  sokFalt.addEventListener("input", () => {
    sok = sokFalt.value;
    filtrera();
  });
  function filtrera() {
    let synliga = 0;
    lista.querySelectorAll(".et-elev").forEach((rad) => {
      const s = students.find((x) => x.id === rad.dataset.id);
      const syns = !!s && matcharSok(s, sok);
      rad.hidden = !syns;
      if (syns) synliga++;
    });
    const tom = lista.querySelector(".et-ingen");
    if (tom) tom.hidden = synliga > 0 || !lista.querySelector(".et-elev");
  }

  // --- Tabellen -------------------------------------------------------------
  function draw() {
    stangMeny();
    ritaKnappar();
    const rader = medlemmar();
    wrap.querySelector(".et-fot").hidden = !rader.length; // fotnoten om ⋯ bara när det finns rader (#805 F3)
    if (!rader.length) {
      lista.replaceChildren(el(`<p class="hint">Inga elever i klassen än${admin ? " – lägg till med Lägg till elev." : "."}</p>`));
      return;
    }
    const tabell = el(`<div class="et-tabell${admin ? " et-admin" : ""}" role="table" aria-label="Elever i ${esc(klassnamn)}">
      <div class="et-rad et-huvud" role="row">
        <span role="columnheader">Namn</span><span role="columnheader">Användarnamn</span>
        <span role="columnheader">Lösenord</span>${admin ? `<span role="columnheader">Mynt</span>` : ""}
        <span role="columnheader"><span class="sr-only">Fler val</span></span>
      </div>
    </div>`);
    rader.forEach((s) => tabell.append(elevRad(s)));
    lista.replaceChildren(tabell, el(`<p class="hint et-ingen" hidden>Ingen elev matchar sökningen.</p>`));
    filtrera();
  }

  function elevRad(s) {
    const namn = s.namn || s.username || s.id;
    const val = menyFor(admin);
    const rad = el(`<div class="et-elev" data-id="${esc(s.id)}" role="presentation">
      <div class="et-rad" role="row">
        <span class="et-namn" role="cell"><span class="et-ava" aria-hidden="true">${avatarEmoji(s.avatarId)}</span><span class="et-namn-txt"></span></span>
        <span class="et-anv" role="cell"><span class="et-lbl">Användarnamn: </span><span class="et-anv-txt"></span></span>
        <span class="et-los" role="cell"><span class="et-lbl">Lösenord: </span><span class="et-varde"></span></span>
        ${admin ? `<span class="et-mynt" role="cell"><span class="et-lbl">Mynt: </span><span class="et-varde"></span></span>` : ""}
        <span class="et-mer" role="cell">
          <button type="button" class="btn ghost small et-meny-knapp" aria-haspopup="menu" aria-expanded="false"
            aria-label="Fler val för ${esc(namn)}" title="Fler val">⋯</button>
          <div class="et-meny" role="menu" aria-label="Fler val för ${esc(namn)}" hidden>${val.map((v) =>
            `<button type="button" role="menuitem" class="et-menyval${v.farlig ? " danger" : ""}" data-val="${v.key}" tabindex="-1">${icon(v.icon, 16)}<span>${esc(admin && v.adminLabel ? v.adminLabel : v.label)}</span></button>`).join("")}</div>
        </span>
      </div>
      <div class="et-panel" role="region" aria-label="${esc(namn)}" hidden></div>
    </div>`);
    rad.querySelector(".et-namn-txt").textContent = namn;
    rad.querySelector(".et-anv-txt").textContent = s.username || "–";
    visaKnapp(rad.querySelector(".et-los .et-varde"), "lösenord", namn, () => hamtaLosen(s));
    if (admin) visaKnapp(rad.querySelector(".et-mynt .et-varde"), "mynt", namn, () => hamtaMynt(s));

    // Okänt lösenord (gamla konton): "Sätt nytt" öppnar samma dialog som ⋯ → Byt lösenord.
    rad.querySelector(".et-los").addEventListener("click", (e) => {
      if (e.target.closest(".et-satt-nytt")) bytLosen(s, rad);
    });
    rad.querySelector(".et-meny-knapp").addEventListener("click", (e) => {
      e.stopPropagation();
      const oppen = e.currentTarget.getAttribute("aria-expanded") === "true";
      stangMeny();
      if (!oppen) oppnaMeny(rad);
    });
    rad.querySelector(".et-meny").addEventListener("click", (e) => {
      const b = e.target.closest("[data-val]");
      if (!b) return;
      stangMeny(true);
      if (b.dataset.val === "losen") return bytLosen(s, rad);
      oppnaRadpanel(rad.querySelector(".et-panel"), b.dataset.val, {
        cls, s, students,
        stang: () => stangPanel(rad),
        namnAndrat: () => {
          rad.querySelector(".et-namn-txt").textContent = s.namn || s.username || s.id;
          rad.querySelector(".et-ava").textContent = avatarEmoji(s.avatarId);
        },
        saldo: (nytt) => visaVarde(rad.querySelector(".et-mynt .et-varde"), `${nytt} ${coinIcon("1em")}`),
        borta: andrat,
        fel: visaKlassfel,
      });
      lista.querySelectorAll(".et-elev").forEach((r) => r !== rad && stangPanel(r));
    });
    return rad;
  }

  function stangPanel(rad) {
    const p = rad.querySelector(".et-panel");
    p.hidden = true;
    p.replaceChildren();
  }

  /** Byt lösenord (och för admin användarnamn) – samma dialog som förut (teacher-login-edit.js). */
  function bytLosen(s, rad) {
    import("./teacher-login-edit.js").then((m) =>
      m.openLoginEditor(s, {
        passwordOnly: !admin,
        onSaved: () => {
          rad.querySelector(".et-anv-txt").textContent = s.username || "–";
          const namn = s.namn || s.username || s.id;
          visaKnapp(rad.querySelector(".et-los .et-varde"), "lösenord", namn, () => hamtaLosen(s));
        },
      })
    );
  }

  // --- ⋯-menyn: en öppen i taget; klick utanför, Esc eller Tab stänger ------
  let menyRad = null;
  function oppnaMeny(rad) {
    const knapp = rad.querySelector(".et-meny-knapp");
    const meny = rad.querySelector(".et-meny");
    knapp.setAttribute("aria-expanded", "true");
    meny.hidden = false;
    rad.classList.add("meny-oppen");
    menyRad = rad;
    meny.querySelector("[data-val]")?.focus();
  }
  function stangMeny(fokusTillbaka = false) {
    if (!menyRad) return;
    const knapp = menyRad.querySelector(".et-meny-knapp");
    knapp.setAttribute("aria-expanded", "false");
    menyRad.querySelector(".et-meny").hidden = true;
    menyRad.classList.remove("meny-oppen");
    menyRad = null;
    if (fokusTillbaka) knapp.focus();
  }
  const utanfor = (e) => {
    if (!wrap.isConnected) return document.removeEventListener("click", utanfor), document.removeEventListener("keydown", tangent);
    if (menyRad && !menyRad.querySelector(".et-mer").contains(e.target)) stangMeny();
  };
  const tangent = (e) => {
    if (!wrap.isConnected) return document.removeEventListener("click", utanfor), document.removeEventListener("keydown", tangent);
    if (!menyRad) return;
    const items = [...menyRad.querySelectorAll(".et-menyval")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") return e.preventDefault(), stangMeny(true);
    if (e.key === "Tab") return stangMeny();
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) || i < 0) return;
    e.preventDefault();
    const j = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[j].focus();
  };
  document.addEventListener("click", utanfor);
  document.addEventListener("keydown", tangent);

  host.replaceChildren(credsHost, besked, wrap);
  draw();
}

// --- Visa lösenord / mynt: en läsning för EN elev, först vid klick ----------

function visaKnapp(cell, vad, namn, hamta) {
  cell.innerHTML = `<button type="button" class="btn ghost small et-visa" aria-label="Visa ${vad} för ${esc(namn)}">${icon("eye", 14)}<span>Visa</span></button>`;
  cell.querySelector("button").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    cell.innerHTML = `<span class="hint">Hämtar…</span>`;
    try {
      cell.innerHTML = await hamta();
    } catch (err) {
      cell.innerHTML = `<span class="gc-err" title="${esc(errText(err))}">Kunde inte hämta</span>`;
    }
  });
}

function visaVarde(cell, html) {
  if (cell) cell.innerHTML = `<span class="et-visat">${html}</span>`;
}

async function hamtaLosen(s) {
  const m = await import("./data-student-login.js");
  const pw = (await m.getStudentCredentials([s.id])).get(s.id)?.password;
  return pw
    ? `<code class="et-visat et-kod">${esc(pw)}</code>`
    : `<span class="et-okant">okänt</span> <button type="button" class="btn ghost small et-satt-nytt">${icon("key", 14)}<span>Sätt nytt</span></button>`;
}

async function hamtaMynt(s) {
  data.invalidateStudentData(s.id); // färskt saldo, inte en gammal cachad läsning
  return `<span class="et-visat">${await data.getCoins(s.id)} ${coinIcon("1em")}</span>`;
}
