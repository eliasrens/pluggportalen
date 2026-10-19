// ============================================================================
// Pluggporten – lärarsidan: Admin-sidan (teacher-admin.js)
// ----------------------------------------------------------------------------
// #805 (epic #802 §3.5). #/larare/admin = en sida med stora kort, ett per
// verktyg (ADMIN_KORT): Skapa klass, Döp om klass, Ta bort klass, Lärarkonton,
// Säsong, Hitta rätt! (paket och bilder) och Mattematchen. Klassverktygen öppnas
// i en panel under korten (?verktyg=skapa|dopom|tabort i adressen); de andra
// korten leder till sina befintliga sidor, oförändrade.
//
// Det som gäller en befintlig klass – elever, mynt och Klasscentret – har
// flyttat till Mina klasser → Elever. Förra Admin → Klasser & elevkonton
// (#/larare/admin/klasser) omdirigeras hit, eller med ?klass= dit.
//
// Skapa klass = samma formulär och kontoeditor som förut (teacher-classes-
// create.js); efteråt landar läraren på klassens Elever med lösenorden kvar
// (OVERLAMNING i teacher-classes-store.js). Döp om och Ta bort klass gör samma
// data-anrop som förut, men i fält och bekräftelseruta på sidan i stället för
// prompt()/confirm().
//
// Läsningar: inga när sidan öppnas. Klasserna läses först när ett klassverktyg
// öppnas, elevkontona bara för Skapa klass (lediga användarnamn) – färre än
// förra sidan, som läste båda direkt. Laddas med import() (#271). Bara admin
// når fliken (lazyPage i teacher-shared.js); reglerna spärrar på riktigt.
// ============================================================================

import * as data from "./data.js";
import { el, errText, esc, icon, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "./teacher-shared.js";
import { OVERLAMNING, countLabel, readSavedClass, saveClass, sortClasses, studentCount } from "./teacher-classes-store.js";
import { minaHash } from "./teacher-mina-val.js";

/** Korten i ordning. verktyg = öppnas i panelen här; hash = egen sida. */
export const ADMIN_KORT = [
  { key: "skapa", titel: "Skapa klass", text: "Ny klass, gärna med elevkonton på en gång", icon: "plus", verktyg: true },
  { key: "dopom", titel: "Döp om klass", text: "Byt namn på en klass", icon: "pencil", verktyg: true },
  { key: "tabort", titel: "Ta bort klass", text: "Elevkontona finns kvar", icon: "trash", verktyg: true },
  { key: "konton", titel: "Lärarkonton", text: "Skapa årskurskonton och välj deras klasser", icon: "key", hash: "#/larare/konton" },
  { key: "sasong", titel: "Säsong", text: "Sommar, höst och Halloween", icon: "sparkle", hash: "#/larare/admin/sasong" },
  { key: "hittaratt", titel: "Hitta rätt!", text: "Kartpaket och bilder", icon: "pin", hash: "#/larare/hitta-ratt" },
  { key: "mattematchen", titel: "Mattematchen", text: "Skapa och styr tävlingsperioder", icon: "trophy", hash: "#/larare/mattematchen" },
];

export const ADMIN_BASE = "#/larare/admin";

export async function pageLarareAdmin(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  const startHash = window.location.hash;
  const page = el(`<div class="teacher-page teacher-dark adm-page"></div>`);
  page.append(teacherNav(ctx, "admin"), teacherHead(ctx, "admin"));
  const lead = el(`<p class="mk-lead">Verktyg för hela skolan. Det som gäller en klass – elever, mynt och Klasscentret –
    finns under <a data-hash="#/larare/mina-klasser?flik=elever" href="#/larare/mina-klasser?flik=elever" class="stats-av-lank">Mina klasser → Elever</a>.</p>`);
  const kort = el(`<div class="adm-kort">${ADMIN_KORT.map((k) => k.verktyg
    ? `<button type="button" class="adm-kortet" data-verktyg="${k.key}" aria-expanded="false" aria-controls="adm-panel">${kortInnehall(k)}</button>`
    : `<a class="adm-kortet" data-hash="${k.hash}" href="${k.hash}">${kortInnehall(k)}</a>`).join("")}</div>`);
  const panel = el(`<section class="panel adm-panel" id="adm-panel" hidden></section>`);
  page.append(lead, kort, panel);
  wireHashLinks(ctx, lead);
  wireHashLinks(ctx, kort);

  // Klasser (och för Skapa klass elevkonton) läses först när ett verktyg behöver dem, en gång per besök.
  let klasserP = null;
  let eleverP = null;
  const klasser = () => (klasserP ||= data.getClasses().catch((e) => ((klasserP = null), Promise.reject(e))));
  const elever = () => (eleverP ||= data.getStudents().catch((e) => ((eleverP = null), Promise.reject(e))));

  let oppet = null;
  kort.addEventListener("click", (e) => {
    const b = e.target.closest("[data-verktyg]");
    if (!b) return;
    visa(oppet === b.dataset.verktyg ? null : b.dataset.verktyg);
    if (oppet) panel.scrollIntoView({ block: "nearest", behavior: "smooth" }); // smal skärm: panelen ligger under korten
  });

  function visa(key) {
    oppet = ADMIN_KORT.some((k) => k.key === key && k.verktyg) ? key : null;
    kort.querySelectorAll("[data-verktyg]").forEach((b) => {
      b.setAttribute("aria-expanded", String(b.dataset.verktyg === oppet));
      b.classList.toggle("active", b.dataset.verktyg === oppet);
    });
    const hash = oppet ? `${ADMIN_BASE}?verktyg=${oppet}` : ADMIN_BASE;
    if (window.location.hash.split("?")[0] === ADMIN_BASE && window.location.hash !== hash) history.replaceState(history.state, "", hash);
    if (!oppet) return void ((panel.hidden = true), panel.replaceChildren());
    const k = ADMIN_KORT.find((x) => x.key === oppet);
    panel.hidden = false;
    const kropp = el(`<div class="adm-verktyg"><h2 class="subhead">${icon(k.icon, 20)}<span>${esc(k.titel)}</span></h2><div class="adm-innehall"></div></div>`);
    panel.replaceChildren(kropp);
    const host = kropp.querySelector(".adm-innehall");
    host.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));
    const visat = oppet;
    const rita = { skapa: ritaSkapa, dopom: ritaDopOm, tabort: ritaTaBort }[oppet];
    rita(host).catch((err) => {
      if (oppet === visat) host.replaceChildren(el(`<p class="err-inline">Kunde inte ladda klasser: ${esc(errText(err))}</p>`));
    });
  }

  async function ritaSkapa(host) {
    const [cls, students, m] = await Promise.all([klasser(), elever(), import("./teacher-classes-create.js")]);
    // Samma formulär som förut; "välj klassen" = gå till Mina klasser → Elever, där lösenorden ligger kvar.
    m.renderCreateClass(ctx, {
      classes: cls,
      state: { students },
      creds: OVERLAMNING.creds,
      flashes: OVERLAMNING.flashes,
      addClass: (c) => cls.push(c),
      notify: () => {},
      select: (id) => (saveClass(id), ctx.go(minaHash(id, "elever"))),
    }, host);
  }

  async function ritaDopOm(host) {
    const lista = sortClasses(await klasser());
    if (!lista.length) return host.replaceChildren(tomt());
    host.replaceChildren(...lista.map((c) => {
      const rad = el(`<form class="adm-klassrad" autocomplete="off">
        <label class="adm-klassnamn"><span class="sr-only">Nytt namn på ${esc(c.name || c.id)}</span>
          <input class="cell" value="${esc(c.name || "")}" placeholder="${esc(c.id)}" /></label>
        <span class="class-count">${countLabel(studentCount(c))}</span>
        <button type="submit" class="btn small gron">${icon("save", 16)}<span>Spara namn</span></button>
        <span class="adm-flash" aria-live="polite"></span>
      </form>`);
      const flash = rad.querySelector(".adm-flash");
      rad.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = rad.querySelector("input").value.trim();
        if (!name) return void (flash.innerHTML = `<span class="gc-err">Skriv ett namn.</span>`);
        if (name === c.name) return void (flash.innerHTML = `<span class="hint">Oförändrat.</span>`);
        const btn = rad.querySelector("button");
        btn.disabled = true;
        try {
          await data.upsertClass(c.id, { name });
          c.name = name;
          flash.innerHTML = `<span class="gc-ok">✓ Sparat</span>`;
        } catch (err) {
          flash.innerHTML = `<span class="gc-err">Kunde inte döpa om: ${esc(errText(err))}</span>`;
        } finally {
          btn.disabled = false;
        }
      });
      return rad;
    }));
  }

  async function ritaTaBort(host) {
    const [alla, { bekrafta }] = await Promise.all([klasser(), import("./teacher-bekrafta.js")]);
    const lista = sortClasses(alla);
    if (!lista.length) return host.replaceChildren(tomt());
    const besked = el(`<div class="adm-besked" aria-live="polite"></div>`);
    host.replaceChildren(el(`<p class="hint">Elevkontona finns kvar när en klass tas bort – bara grupperingen försvinner.</p>`), besked,
      ...lista.map((c) => {
        const rad = el(`<div class="adm-klassrad-wrap"><div class="adm-klassrad">
          <span class="adm-klassnamn"><b></b></span><span class="class-count">${countLabel(studentCount(c))}</span>
          <button type="button" class="btn ghost small danger" aria-expanded="false">${icon("trash", 16)}<span>Ta bort…</span></button>
        </div><div class="adm-bekrafta" hidden></div></div>`);
        rad.querySelector("b").textContent = c.name || c.id;
        const knapp = rad.querySelector("button");
        const ruta = rad.querySelector(".adm-bekrafta");
        const stang = () => ((ruta.hidden = true), ruta.replaceChildren(), knapp.setAttribute("aria-expanded", "false"), knapp.focus());
        knapp.addEventListener("click", () => {
          if (!ruta.hidden) return stang();
          knapp.setAttribute("aria-expanded", "true");
          bekrafta(ruta, {
            text: `Ta bort klassen <b>${esc(c.name || c.id)}</b>? Elevkontona finns kvar – bara grupperingen försvinner.`,
            knapp: "Ta bort klassen",
            onAvbryt: stang,
            onJa: async () => {
              await data.deleteClass(c.id);
              const i = alla.indexOf(c);
              if (i >= 0) alla.splice(i, 1);
              if (readSavedClass() === c.id) saveClass(null);
              rad.remove();
              besked.innerHTML = `<div class="msg ok">✓ Klassen "${esc(c.name || c.id)}" togs bort. Elevkontona finns kvar.</div>`;
              if (!alla.length) host.append(tomt());
            },
          });
        });
        return rad;
      }));
  }

  ctx.app.replaceChildren(page);
  const start = new URLSearchParams(startHash.split("?")[1] || "").get("verktyg");
  if (start) visa(start);
}

function kortInnehall(k) {
  return `<span class="adm-kort-ikon" aria-hidden="true">${icon(k.icon, 24)}</span>
    <span class="adm-kort-text"><b>${esc(k.titel)}</b><span>${esc(k.text)}</span></span>`;
}

const tomt = () => el(`<p class="hint">Det finns inga klasser än – skapa en med Skapa klass.</p>`);
