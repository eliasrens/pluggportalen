// ============================================================================
// Bråkresan – bygg helheten (komponenter/bygge.js) · #710 E
// ----------------------------------------------------------------------------
// Utmaning 05 "Hitta helheten": en given bit (1/n av en stav, en rektangel
// eller en grupp föremål) visas för sig. Eleven kopierar biten till ett
// byggområde – klick på biten, knappen "Lägg en bit till" eller dra biten dit –
// tills en hel är byggd. Byggområdet har INGA förritade platser och ingen
// slutmarkering: biten ritas alltid lika stor, så helhetens storlek avslöjas
// aldrig (spec §8 05).
//
// view = { component: "bygge", form: "stav" | "rektangel" | "mangd",
//          bit: "1/4",            bitens bråk (given information, visas vid biten)
//          enhet?: k,             mängd: antal föremål i biten (gruppen)
//          item?: "kula" | …,     mängd: föremålet
//          max?: 8 }              högst så många bitar i byggområdet
// Svar: number (input "integer") { text } – antal bitar, eller för en mängd
// antal FÖREMÅL i det byggda (bitar · enhet).
// ============================================================================

import { h, s, skapaBas, svgBrak } from "./bas.js";
import { FOREMAL } from "./mangd.js";

const W = 100;   // en bits bredd i viewBox-enheter (alltid samma – avslöjar inget)
const HS = 64;   // stavbitens höjd
const HR = 100;  // rektangelbitens höjd
const U = 30;    // ett föremål i en grupp

function foremal(cx, cy) {
  return [s("circle", { cx, cy, r: U * 0.36, class: "br-foremal-form" }), s("circle", { cx: cx - 4, cy: cy - 4, r: 3, class: "br-foremal-glans" })];
}

/** En bit som SVG-grupp med övre vänstra hörnet i (x, y). */
function bitNod(view, x, y, i = null) {
  const g = s("g", { class: "br-byggbit", transform: `translate(${x} ${y})`, ...(i !== null ? { "data-bit": String(i) } : {}) });
  if (view.form === "mangd") {
    const k = view.enhet || 1;
    g.append(s("rect", { class: "br-gruppram br-byggram", x: 2, y: 2, width: k * U + 8, height: U + 8, rx: 10 }));
    for (let j = 0; j < k; j++) g.append(s("g", { class: "br-foremal" }, ...foremal(6 + U / 2 + j * U, 6 + U / 2)));
  } else {
    const hh = view.form === "rektangel" ? HR : HS;
    g.append(s("rect", { class: "br-yta br-vald br-byggyta", x: 0, y: 0, width: W, height: hh }),
      s("rect", { class: "br-kontur", x: 0, y: 0, width: W, height: hh }));
  }
  return g;
}

const bitBredd = (view) => (view.form === "mangd" ? (view.enhet || 1) * U + 12 : W);
const bitHojd = (view) => (view.form === "mangd" ? U + 12 : view.form === "rektangel" ? HR : HS);

export function createBygge(host, view, opts = {}) {
  const max = view.max || 8;
  const enhet = view.form === "mangd" ? view.enhet || 1 : 1;
  const namn = view.form === "mangd" ? "grupp" : "bit";
  const flera = view.form === "mangd" ? "grupper" : "bitar";
  const svar = opts.answer?.type === "number";
  const [bn, bd] = String(view.bit || "").split("/").map(Number);

  // Biten för sig.
  const bitSvg = s("svg", { class: "br-bygge-bit-svg", viewBox: `-6 -6 ${bitBredd(view) + 12} ${bitHojd(view) + 58}`, "aria-hidden": "true" });
  bitSvg.append(bitNod(view, 0, 0));
  if (bd) bitSvg.append(svgBrak(bitBredd(view) / 2, bitHojd(view) + 22, bn, bd, 22));
  const bitKnapp = h("button", { type: "button", class: "br-bygge-bit", "aria-label": `Biten: ${view.bit || ""}. Lägg en kopia i byggområdet.` }, bitSvg);
  const plus = h("button", { type: "button", class: "br-knapp br-verktygknapp" }, `+ Lägg en ${namn} till`);
  const minus = h("button", { type: "button", class: "br-knapp br-verktygknapp" }, `− Ta bort en ${namn}`);
  const status = h("div", { class: "br-kortstatus", "aria-live": "polite" });

  // Byggområdet: en startlinje, inga platser, ingen slutmarkering.
  const per = view.form === "mangd" ? 4 : max;
  const rader = Math.ceil(max / per);
  const yta = s("svg", {
    class: `br-bygge-yta-svg br-bygge-yta-svg--${view.form}`, role: "img",
    viewBox: `-14 -8 ${per * (bitBredd(view) + (view.form === "mangd" ? 10 : 0)) + 28} ${rader * (bitHojd(view) + 10) + 16}`,
  });
  const ytaRam = h("div", { class: "br-bygge-yta" }, h("div", { class: "br-bygge-ytarubrik" }, "Byggområde"), yta);
  const rot = h("div", { class: `br-bygge br-bygge--${view.form}` },
    h("div", { class: "br-bygge-verktyg" }, h("div", { class: "br-bygge-bitrad" }, bitKnapp, h("div", { class: "br-bygge-knappar" }, plus, minus))),
    ytaRam, status);
  const bas = skapaBas(host, rot, view, opts);
  let antal = 0;
  let numrerad = false;

  function rita() {
    yta.replaceChildren(s("line", { class: "br-bygge-start", x1: -6, x2: -6, y1: -4, y2: rader * (bitHojd(view) + 10) + 4 }));
    for (let i = 0; i < antal; i++) {
      const x = view.form === "mangd" ? (i % per) * (bitBredd(view) + 10) : i * W;
      const y = view.form === "mangd" ? Math.floor(i / per) * (bitHojd(view) + 10) : 0;
      const g = bitNod(view, x, y, i);
      if (numrerad) g.append(s("text", { class: "br-nummer", x: bitBredd(view) / 2, y: bitHojd(view) / 2 + 8, "text-anchor": "middle", text: String(i + 1) }));
      yta.append(g);
    }
    const t = antal === 0 ? "Byggområdet är tomt." : view.form === "mangd"
      ? `Du har lagt ${antal} ${antal === 1 ? namn : flera} = ${antal * enhet} ${FOREMAL[view.item || "kula"].flera}.`
      : `Du har lagt ${antal} ${antal === 1 ? namn : flera}.`;
    status.textContent = t;
    yta.setAttribute("aria-label", t);
    plus.disabled = antal >= max;
    minus.disabled = antal <= 0;
    bitKnapp.disabled = antal >= max;
  }
  const andra = (d) => {
    if (bas.last || !bas.interaktiv) return;
    const ny = Math.max(0, Math.min(max, antal + d));
    if (ny === antal) return;
    antal = ny;
    rita();
    bas.andrat();
  };
  // Klick på biten = lägg en kopia. Dra biten och släpp över byggområdet = samma sak.
  let drag = null;
  bitKnapp.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId, spok: null }; });
  window.addEventListener("pointermove", flyttaSpok);
  window.addEventListener("pointerup", slapp);
  bas.stad(() => {
    window.removeEventListener("pointermove", flyttaSpok);
    window.removeEventListener("pointerup", slapp);
    drag?.spok?.remove();
  });
  function flyttaSpok(e) {
    if (!drag || e.pointerId !== drag.id || bas.last) return;
    if (!drag.spok && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) {
      drag.spok = bitSvg.cloneNode(true);
      drag.spok.classList.add("br-spok", "br-bygge-spok");
      document.body.append(drag.spok);
    }
    if (drag.spok) Object.assign(drag.spok.style, { left: `${e.clientX - 30}px`, top: `${e.clientY - 20}px` });
  }
  let svalj = false;
  function slapp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.spok) return;
    d.spok.remove();
    svalj = true;
    setTimeout(() => { svalj = false; }, 0);
    if (document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".br-bygge-yta") === ytaRam) andra(1);
  }
  bitKnapp.addEventListener("click", () => { if (!svalj) andra(1); });
  plus.addEventListener("click", () => andra(1));
  minus.addEventListener("click", () => andra(-1));
  rot.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); andra(-1); }
  });
  if (!bas.interaktiv) for (const b of [bitKnapp, plus, minus]) b.hidden = b !== bitKnapp;
  rita();

  Object.assign(bas.api, {
    getAnswer: () => (svar && antal > 0 ? { text: String(antal * enhet) } : null),
    setAnswer(a) {
      const v = Number(a?.text);
      antal = Number.isSafeInteger(v) && v > 0 ? Math.min(max, Math.round(v / enhet)) : 0;
      rita();
    },
    reset() { antal = 0; rita(); bas.andrat(); },
    validate: () => (antal > 0 ? { ok: true } : { ok: false, message: `Lägg minst en ${namn} i byggområdet.` }),
    highlight(target) {
      bitKnapp.classList.toggle("br-pekad", !!target?.whole || !!target?.bit);
      numrerad = !!target?.count;
      rita();
    },
    /** Antal bitar i byggområdet (testläget). */
    antal: () => antal,
  });
  return bas.api;
}
