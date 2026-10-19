// ============================================================================
// Schackbrädet (#775, spec §2) – en återanvändbar komponent:
//
//   const { skapaSchackbrade } = await import("./schack/schack-bradet.js");
//   const brade = skapaSchackbrade(element, { egenFarg: "w", motstandare: "dator",
//     namn: { w: "Du", b: "Bonden" }, onMove, beforeMove, onGameOver });
//
// Ritar spelarraderna, brädet (rutor, koordinater, pjäser, markeringar,
// pilar, förvandlingsväljaren, slutrutan), statusraden och draglistan.
// Logiken (och nästan hela API:t) ligger i schack-kontroll.js; här finns bara
// DOM, animation och det som hör till ytan (avatarer, slutrutans knappar).
// API:t beskrivs i docs/SCHACK.md. Laddas bara via import() (#271).
// ============================================================================

import { skapaSchackKontroll } from "./schack-kontroll.js";
import { pjasSvg } from "./schack-pjaser.js";
import { rutaEtikett } from "./schack-text.js";
import { kopplaInmatning } from "./schack-bradet-inmatning.js";
import { esc, pilarSvg, spelareHtml, forvandlingHtml, slutHtml } from "./schack-bradet-delar.js";

const FILER = "abcdefgh";
const GLID_MS = 150;
/** Guidens stjärna på en ruta (#790) – guld med mörklila kontur som pjäserna. */
const STJARNA = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8l12.4 25.1 27.7 4-20 19.5 4.7 27.6L50 71.2 25.2 84.2l4.7-27.6-20-19.5 27.7-4z" fill="#f2c94c" stroke="#3B3350" stroke-width="6" stroke-linejoin="round"/></svg>`;
const RUTOR = [];
for (let r = 8; r >= 1; r--) for (const f of FILER) RUTOR.push(f + r);

/** a1 är mörk. */
function mork(ruta) {
  return (FILER.indexOf(ruta[0]) + Number(ruta[1])) % 2 === 1;
}

/**
 * @param {HTMLElement} rot
 * @param {object} [opt]  allt som skapaSchackKontroll tar, plus:
 * @param {{w?: string, b?: string}} [opt.avatar]   avatar-markup per färg
 * @param {Array<{text: string, onClick?: Function}>} [opt.slutKnappar]  extra knappar i slutrutan
 * @param {boolean} [opt.reducedMotion]  tvinga bort glidanimationen (annars prefers-reduced-motion)
 * @param {string} [opt.etikett]  brädets aria-label (standard "Schackbräde")
 * @param {object} [opt.kontroll]  en färdig kontroll med samma API (guidens stjärnjakt, #790);
 *        annars skapaSchackKontroll(opt). Dess tillstånd får också ha `stjarnor: [ruta]`
 *        (ritas som stjärnor) och `rutKlass: { ruta: "ratt" | "fel" | "tips" }` (grön/röd ruta,
 *        eller pusslens tipsring runt pjäsen som ska flyttas, #791).
 */
export function skapaSchackbrade(rot, opt = {}) {
  const k = opt.kontroll || skapaSchackKontroll(opt);
  let avatar = { ...(opt.avatar || {}) };
  let extra = { ...(opt.spelarExtra || {}) }; // t.ex. schackklockan i spelarraden (Etapp 2)
  let slutKnappar = opt.slutKnappar || [];
  let slutStangd = false;
  let ingenGlid = false;
  let fokusRuta = null;
  let senastInmatning = 0;
  const cache = new Map(); // ruta → nyckel för pjäsen som står där

  rot.classList.add("schack");
  rot.innerHTML =
    `<div class="schack-spelare" data-plats="topp"></div>` +
    `<div class="schack-ram">` +
    `<div class="schack-bradet" role="grid" aria-label="${esc(opt.etikett || "Schackbräde")}"></div>` +
    `<svg class="schack-pilar" viewBox="0 0 800 800" aria-hidden="true"></svg>` +
    `<div class="schack-forvandling" role="dialog" aria-label="Välj vad bonden ska bli" hidden></div>` +
    `<div class="schack-slut" hidden></div>` +
    `</div>` +
    `<div class="schack-spelare" data-plats="botten"></div>` +
    `<p class="schack-status" role="status" aria-live="polite"><span class="schack-status-text"></span>` +
    `<span class="schack-status-orsak"></span></p>` +
    `<div class="schack-drag">` +
    `<button type="button" class="btn ghost liten schack-drag-knapp" aria-expanded="false">Visa drag</button>` +
    `<p class="schack-draglista" tabindex="0" aria-label="Dragen" hidden></p></div>`;

  const $ = (s) => rot.querySelector(s);
  const bradet = $(".schack-bradet");
  const pilar = $(".schack-pilar");
  const forv = $(".schack-forvandling");
  const slutEl = $(".schack-slut");
  const statusEl = $(".schack-status");
  const dragKnapp = $(".schack-drag-knapp");
  const dragListaEl = $(".schack-draglista");
  const spelarEl = { topp: $('[data-plats="topp"]'), botten: $('[data-plats="botten"]') };

  // 8 rader (role=row, display: contents) med 8 rutor var. Rutorna skapas en
  // gång; vändningen sätter bara om deras plats i rutnätet.
  const rutaEl = new Map();
  for (let i = 0; i < 8; i++) {
    const rad = document.createElement("div");
    rad.setAttribute("role", "row");
    rad.className = "schack-rad";
    for (let j = 0; j < 8; j++) {
      const ruta = RUTOR[i * 8 + j];
      const el = document.createElement("div");
      el.className = `schack-ruta ${mork(ruta) ? "mork" : "ljus"}`;
      el.dataset.ruta = ruta;
      el.setAttribute("role", "gridcell");
      el.tabIndex = -1;
      el.innerHTML = `<span class="schack-pjasplats"></span><span class="schack-koord-rad"></span><span class="schack-koord-fil"></span>` +
        `<span class="schack-stjarna" hidden>${STJARNA}</span>`;
      rad.appendChild(el);
      rutaEl.set(ruta, el);
    }
    bradet.appendChild(rad);
  }

  const stilla = () =>
    opt.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  function fokusera(ruta) {
    fokusRuta = ruta;
    for (const [r, el] of rutaEl) el.tabIndex = r === ruta ? 0 : -1;
    rutaEl.get(ruta)?.focus();
  }

  function glid(from, to) {
    const el = rutaEl.get(to);
    const pjas = el?.querySelector(".schack-pjas");
    if (!pjas || typeof pjas.animate !== "function") return;
    const a = rutaEl.get(from).getBoundingClientRect();
    const b = el.getBoundingClientRect();
    el.classList.add("glider");
    const anim = pjas.animate(
      [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }],
      { duration: GLID_MS, easing: "ease-out" },
    );
    anim.onfinish = anim.oncancel = () => el.classList.remove("glider");
  }

  function ritaRutor(s) {
    const pjasPa = new Map(s.pjaser.map((p) => [p.ruta, p]));
    if (s.pagaende) {
      pjasPa.delete(s.pagaende.from);
      pjasPa.set(s.pagaende.to, { ...s.pagaende.pjas, vantar: true });
    }
    const mal = new Map(s.mal.map((m) => [m.to, m]));
    const stjarnor = new Set(s.stjarnor || []);
    const rutKlass = s.rutKlass || {};
    const vand = s.orientering === "b";
    for (const [ruta, el] of rutaEl) {
      const fil = FILER.indexOf(ruta[0]);
      const rad = Number(ruta[1]);
      el.style.gridColumn = String(vand ? 8 - fil : fil + 1);
      el.style.gridRow = String(vand ? rad : 9 - rad);
      el.children[1].textContent = (vand ? fil === 7 : fil === 0) ? String(rad) : "";
      el.children[2].textContent = (vand ? rad === 8 : rad === 1) ? FILER[fil] : "";
      const p = pjasPa.get(ruta);
      const nyckel = p ? p.color + p.type : "";
      if (cache.get(ruta) !== nyckel) {
        el.children[0].innerHTML = p ? pjasSvg(p.color, p.type) : "";
        cache.set(ruta, nyckel);
      }
      const m = mal.get(ruta);
      const senast = s.senast && (s.senast.from === ruta || s.senast.to === ruta);
      el.classList.toggle("vald", s.vald === ruta);
      el.classList.toggle("senast", !!senast);
      el.classList.toggle("mal", !!m && !m.tar);
      el.classList.toggle("mal-tar", !!m && m.tar);
      el.classList.toggle("i-schack", s.schackRuta === ruta);
      el.classList.toggle("vantar", !!p?.vantar);
      el.classList.toggle("kan-valjas", k.kanValja(ruta));
      el.classList.toggle("ratt", rutKlass[ruta] === "ratt");
      el.classList.toggle("fel", rutKlass[ruta] === "fel");
      el.classList.toggle("tips", rutKlass[ruta] === "tips");
      el.children[3].hidden = !stjarnor.has(ruta);
      const extra = [];
      if (stjarnor.has(ruta)) extra.push("stjärna");
      if (rutKlass[ruta] === "tips") extra.push("tips: flytta den här pjäsen");
      if (s.vald === ruta) extra.push("markerad");
      if (m) extra.push(m.tar ? "kan tas" : "möjligt drag");
      if (s.schackRuta === ruta) extra.push("i schack");
      if (senast) extra.push("senaste draget");
      el.setAttribute("aria-label", rutaEtikett(ruta, p, extra));
      el.setAttribute("aria-selected", s.vald === ruta ? "true" : "false");
    }
    if (!fokusRuta) fokusRuta = s.orientering === "w" ? "e2" : "e7";
    for (const [r, el] of rutaEl) el.tabIndex = r === fokusRuta ? 0 : -1;
  }

  function ritaForvandling(s) {
    const oppen = !!s.forvandling;
    if (oppen && forv.hidden) {
      forv.innerHTML = forvandlingHtml(s.forvandling.farg);
      forv.hidden = false;
      // Fokus till damen bara när eleven arbetar med just det här brädet.
      if (rot.contains(document.activeElement) || Date.now() - senastInmatning < 1500) {
        forv.querySelector(".forvald")?.focus({ preventScroll: true });
      }
    } else if (!oppen && !forv.hidden) {
      const hadeFokus = forv.contains(document.activeElement);
      forv.hidden = true;
      forv.innerHTML = "";
      if (hadeFokus && fokusRuta) fokusera(fokusRuta);
    }
  }

  function ritaSlut(s) {
    if (!s.slut) {
      slutEl.hidden = true;
      slutStangd = false;
      return;
    }
    if (slutStangd) return;
    slutEl.innerHTML = slutHtml(s.status, [...slutKnappar, { text: "Titta på brädet" }]);
    slutEl.hidden = false;
  }

  function rita(s, h = {}) {
    ritaRutor(s);
    bradet.classList.toggle("interaktiv", !s.slut && s.interaktiv !== false);
    pilar.innerHTML = pilarSvg(s.pilar, s.orientering);
    ritaForvandling(s);
    ritaSlut(s);
    const topp = s.orientering === "w" ? "b" : "w";
    const botten = topp === "w" ? "b" : "w";
    for (const [plats, f] of [["topp", topp], ["botten", botten]]) {
      spelarEl[plats].dataset.farg = f;
      spelarEl[plats].classList.toggle("pa-tur", !s.slut && s.tur === f);
      spelarEl[plats].innerHTML = spelareHtml(f, s, avatar[f]) + `<span class="schack-spelare-extra">${extra[f] || ""}</span>`;
    }
    statusEl.className = `schack-status schack-ton-${s.status.ton}`;
    statusEl.children[0].textContent = s.status.text;
    statusEl.children[1].textContent = s.status.orsak ? ` ${s.status.orsak}` : "";
    // Ett dragpar i taget får inte brytas ("6. Lc4 e6" på samma rad).
    dragListaEl.innerHTML = s.dragRader.length ? s.dragRader.map((r) => `<span>${esc(r)}</span>`).join(" ") : "Inga drag än.";
    dragListaEl.scrollTop = dragListaEl.scrollHeight; // senaste dragen syns
    if (h.typ === "vantar") ingenGlid = true;
    if (h.typ === "drag") {
      if (!ingenGlid && !stilla()) {
        glid(h.drag.from, h.drag.to);
        const rock = { k: ["h", "f"], q: ["a", "d"] }[h.drag.flags.includes("k") ? "k" : h.drag.flags.includes("q") ? "q" : ""];
        if (rock) glid(rock[0] + h.drag.to[1], rock[1] + h.drag.to[1]);
      }
      ingenGlid = false;
    }
    // Nekat, eller väntan avbruten av ny ställning/ångra/slut: nästa drag glider igen.
    if (["nekad", "position", "angra", "slut"].includes(h.typ)) ingenGlid = false;
  }

  const avregistrera = k.subscribe(rita);
  const koppla = kopplaInmatning({
    bradet, k, rutaEl: (r) => rutaEl.get(r), fokusera, viaDrag: () => { ingenGlid = true; },
  });

  // Väljaren: klick på en pjäs, Avbryt, Escape eller klick utanför.
  forv.addEventListener("click", (e) => {
    const knapp = e.target.closest("[data-pjas]");
    if (knapp) k.valjForvandling(knapp.dataset.pjas);
    else if (e.target.closest(".schack-forvandling-avbryt")) k.avbrytForvandling();
  });
  forv.addEventListener("keydown", (e) => {
    if (e.key === "Escape") k.avbrytForvandling();
  });
  const utanfor = (e) => {
    if (!forv.hidden && !forv.contains(e.target)) k.avbrytForvandling();
  };
  rot.addEventListener("pointerdown", utanfor, true);
  const markeraInmatning = () => { senastInmatning = Date.now(); };
  rot.addEventListener("pointerdown", markeraInmatning, true);
  slutEl.addEventListener("click", (e) => {
    const i = e.target.closest("[data-slut]")?.dataset.slut;
    if (i == null) return;
    const knapp = [...slutKnappar, { text: "Titta på brädet" }][Number(i)];
    if (knapp.onClick) knapp.onClick();
    else {
      slutStangd = true;
      slutEl.hidden = true;
      fokusera(fokusRuta || "e2"); // fokus tillbaka till brädet, inte till body
    }
  });
  dragKnapp.addEventListener("click", () => {
    const visa = dragListaEl.hidden;
    dragListaEl.hidden = !visa;
    dragKnapp.setAttribute("aria-expanded", String(visa));
    dragKnapp.textContent = visa ? "Dölj drag" : "Visa drag";
  });

  rita(k.getState());

  const { subscribe, ...api } = k;
  return {
    ...api,
    subscribe,
    element: rot,
    /** Spelarna: { egenFarg, motstandare, namn: {w,b}, avatar: {w,b} }. */
    setSpelare(s = {}) {
      if (s.avatar) avatar = { ...avatar, ...s.avatar };
      k.setSpelare(s);
    },
    /**
     * Extra innehåll längst till höger i spelarraden per färg (klockan i kompisläget):
     * { w?: html, b?: html }. Skrivs direkt i raden – brädet ritas inte om.
     */
    setSpelarExtra(e = {}) {
      extra = { ...extra, ...e };
      for (const el of Object.values(spelarEl)) {
        const f = el.dataset.farg;
        const yta = el.querySelector(".schack-spelare-extra");
        if (yta && f in e && yta.innerHTML !== (extra[f] || "")) yta.innerHTML = extra[f] || "";
      }
    },
    /** Extra knappar i slutrutan: [{ text, onClick }]. "Titta på brädet" finns alltid sist. */
    setSlutKnappar(lista = []) {
      slutKnappar = lista;
      slutStangd = false;
      ritaSlut(k.getState());
    },
    destroy() {
      avregistrera();
      koppla();
      rot.removeEventListener("pointerdown", utanfor, true);
      rot.removeEventListener("pointerdown", markeraInmatning, true);
      rot.innerHTML = "";
      rot.classList.remove("schack");
    },
  };
}
