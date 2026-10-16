// ============================================================================
// Prov (#740, spec §5.5): elevens provvy – hela provet på en sida, utan
// Firebase. Provsidan (prov-elev-sida.js) kopplar på sparning, tid och
// inlämning; "Förhandsvisa som elev" (B, §8.1) kan använda den rakt av utan
// att något sparas. Lugn design: vit panel, stor text, inga spelinslag,
// inga ljud och inga belöningar. CSS: prov-elev.css (.provv-).
//
//   const vy = renderaProv({ namn, fragor, installningar, svar, onAndrat, onLamnat, onLamnaIn })
//   vy.el                 elementet att sätta in
//   vy.svar()             elevens svar just nu (rensade, som de sparas)
//   vy.satTid(text, niva) nedräkningen överst ("23 min kvar", "gul"/"rod")
//   vy.satSparstatus(s)   { lage: "sparat"|"sparar"|"fel", tid }
//   vy.las(true)          bara läsa (inlämnat, stängt, tiden slut)
//   vy.visaInlamning()    rutan "Du har svarat på 10 av 12 frågor …"
//   renderaFragor(container, fragor, o)  samma vy insatt i ett element (B:s förhandsvisning)
// ============================================================================

import { arFraga, fragetyp } from "./prov-fragetyper.js";
import { besvarat, fragaLista, fragaNummer, rensaSvar, tomtSvar } from "./prov-modell.js";
import { h, stavAttr, stycken } from "./prov-vy.js";

let raknare = 0;

const klockslag = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Texten i sparraden (§5.5). */
export function sparText(s) {
  if (s?.lage === "fel") return "Kunde inte spara – kontrollera internet. Dina svar finns kvar här.";
  if (s?.lage === "sparar") return "Sparar…";
  if (s?.tid) return `Sparat ${klockslag(s.tid)}`;
  return "";
}

/**
 * @param {object} o
 * @param {string} o.namn                 provets namn
 * @param {object[]} o.fragor             tillfällets frågor (utan facit)
 * @param {object} [o.installningar]      { poang, stavningskontroll }
 * @param {object} [o.svar]               startsvaren
 * @param {(svar: object) => void} [o.onAndrat]  varje ändring
 * @param {() => void} [o.onLamnat]       eleven lämnade en ruta / bytte fråga
 * @param {() => void} [o.onLamnaIn]      eleven bekräftade "Lämna in"
 * @param {string} [o.lamnaInText]        knappens text (förhandsvisningen: annan)
 */
export function renderaProv(o) {
  const uid = `provv${++raknare}`;
  const fragor = o.fragor || [];
  const nr = fragaNummer(fragor);
  const svar = { ...tomtSvar(fragor), ...(o.svar || {}) };
  const attr = stavAttr(o.installningar?.stavningskontroll);
  const visaPoang = o.installningar?.poang !== false;
  let last = false;

  const tid = h("div", { class: "provv-tid", role: "timer", "aria-live": "off", hidden: true });
  const spar = h("div", { class: "provv-spar", role: "status", "aria-live": "polite" });
  const topp = h("header", { class: "provv-topp" },
    h("h1", { class: "provv-namn", text: o.namn || "Prov" }),
    h("div", { class: "provv-topp-info" }, tid, spar));

  const listaKnappar = new Map();
  const lista = h("nav", { class: "provv-lista", "aria-label": "Frågor" },
    h("div", { class: "provv-lista-rubrik", text: "Frågor" }),
    h("div", { class: "provv-lista-knappar" }, fragor.filter(arFraga).map((f) => {
      const b = h("button", { type: "button", class: "provv-lista-nr", text: String(nr[f.id]), "aria-label": `Fråga ${nr[f.id]}` });
      b.addEventListener("click", () => {
        const sek = huvud.querySelector(`[data-fraga="${CSS.escape(f.id)}"]`);
        sek?.scrollIntoView({ behavior: "smooth", block: "start" });
        sek?.querySelector("input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])")?.focus({ preventScroll: true });
      });
      listaKnappar.set(f.id, b);
      return b;
    })),
    h("div", { class: "provv-lista-forklaring" },
      h("span", {}, h("span", { class: "provv-prick provv-prick-klar" }), " besvarad"),
      h("span", {}, h("span", { class: "provv-prick" }), " obesvarad")));

  const huvud = h("div", { class: "provv-fragor" });
  const sektioner = [];
  const markera = (f) => {
    const klar = fragetyp(f.typ).arBesvarad(svar[f.id], f);
    listaKnappar.get(f.id)?.classList.toggle("provv-klar", klar);
    const b = listaKnappar.get(f.id);
    if (b) b.setAttribute("aria-label", `Fråga ${nr[f.id]}${klar ? ", besvarad" : ", obesvarad"}`);
  };
  const rita = () => {
    sektioner.length = 0;
    huvud.replaceChildren(...fragor.map((f) => {
      const typ = fragetyp(f.typ);
      if (!typ) return null;
      if (!arFraga(f)) {
        const s = h("section", { class: "provv-textblock", "data-fraga": f.id }, typ.renderElev(f, null, { uid, attr, lasLage: last }));
        return s;
      }
      const k = {
        uid, attr, lasLage: last,
        onChange: (v) => {
          svar[f.id] = v;
          markera(f);
          o.onAndrat?.(rensaSvar(svar, fragor));
        },
        onLamna: () => o.onLamnat?.(),
      };
      const s = h("section", { class: "provv-fraga", "data-fraga": f.id, "aria-labelledby": `${uid}-${f.id}-rubrik` },
        h("div", { class: "provv-fraga-huvud" },
          h("span", { class: "provv-nr", text: `${nr[f.id]}` }),
          h("div", { class: "provv-fragetext", id: `${uid}-${f.id}-rubrik` }, stycken(f.fraga)),
          visaPoang && f.poang ? h("span", { class: "provv-poang", text: `${f.poang} p` }) : null),
        f.hjalptext ? h("p", { class: "provv-hjalp", text: f.hjalptext }) : null,
        h("div", { class: "provv-svar" }, typ.renderElev(f, svar[f.id], k)));
      // Byter eleven fråga (fokus lämnar sektionen) sparas det direkt (§5.5).
      s.addEventListener("focusout", (e) => { if (!s.contains(e.relatedTarget)) o.onLamnat?.(); });
      sektioner.push(s);
      markera(f);
      return s;
    }).filter(Boolean));
  };
  rita();

  const lamnaIn = h("button", { type: "button", class: "provv-lamna-in", text: o.lamnaInText || "Lämna in" });
  const ruta = h("div", { class: "provv-ruta", role: "dialog", "aria-modal": "false", "aria-labelledby": `${uid}-ruta`, hidden: true });
  const fot = h("footer", { class: "provv-fot" }, ruta, lamnaIn);
  lamnaIn.addEventListener("click", () => visaInlamning());

  function visaInlamning() {
    const { besvarade, antal, obesvarade } = besvarat(fragor, svar);
    const tillbaka = h("button", { type: "button", class: "provv-knapp-sekundar", text: "Gå tillbaka" });
    const ok = h("button", { type: "button", class: "provv-lamna-in", text: o.lamnaInText || "Lämna in" });
    ruta.replaceChildren(
      h("p", { class: "provv-ruta-rubrik", id: `${uid}-ruta`, text: `Du har svarat på ${besvarade} av ${antal} frågor.` }),
      obesvarade.length ? h("p", { text: `${fragaLista(obesvarade)} ${obesvarade.length === 1 ? "är obesvarad" : "är obesvarade"}.` }) : null,
      h("p", { class: "provv-ruta-hint", text: "När du har lämnat in kan du inte ändra dina svar." }),
      h("div", { class: "provv-ruta-knappar" }, tillbaka, ok));
    ruta.hidden = false;
    lamnaIn.hidden = true;
    tillbaka.addEventListener("click", () => { ruta.hidden = true; lamnaIn.hidden = false; lamnaIn.focus(); });
    ok.addEventListener("click", () => {
      ok.disabled = true;
      tillbaka.disabled = true;
      o.onLamnaIn?.();
    });
    ok.focus();
    ruta.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const el = h("div", { class: "provv-sida" },
    topp,
    h("div", { class: "provv-kropp" }, lista, h("main", { class: "provv-huvud" }, huvud, fot)));

  return {
    el,
    svar: () => rensaSvar(svar, fragor),
    satTid(text, niva = "") {
      tid.hidden = !text;
      tid.textContent = text || "";
      tid.dataset.niva = niva;
    },
    satSparstatus(s) {
      spar.textContent = sparText(s);
      spar.dataset.lage = s?.lage || "";
    },
    las(pa = true) {
      if (last === pa) return;
      last = pa;
      rita();
      fot.hidden = pa;
    },
    visaInlamning,
    /** Rutan efter "Lämna in" om inlämningen misslyckades. */
    inlamningMisslyckades(text) {
      ruta.querySelectorAll("button").forEach((b) => (b.disabled = false));
      ruta.append(h("p", { class: "provv-fel", role: "alert", text }));
    },
  };
}

/**
 * Provet i ett element (B:s "Förhandsvisa som elev", #739): samma vy som
 * eleven ser, men utan Firebase – utan onAndrat sparas ingenting.
 * @param {HTMLElement} container  töms och får provet
 * @param {object[]} fragor        elevens frågor (delaUppProv(prov).fragor)
 * @param {{ namn?, svar?, installningar?, onAndrat?, lasLage?, lamnaInText?, onLamnaIn? }} [o]
 * @returns vyn från renderaProv (svar(), las() …)
 */
export function renderaFragor(container, fragor, o = {}) {
  const vy = renderaProv({ ...o, fragor, namn: o.namn || "Förhandsvisning" });
  if (o.lasLage) vy.las(true);
  container.replaceChildren(vy.el);
  return vy;
}
