// ============================================================================
// Prov (#764, spec §6.0): knappen "Rätta alla automatiska frågor" och
// sammanfattningen efteråt i rättningsvyn. Logiken (vad som är säkert) bor i
// prov-ratta-alla.js och sparningen i prov-ratta-lager.js – här är bara DOM.
//
//   const r = rattaAllaVy({ lager, fragor, oppnaFraga, onKlar })
//   r.knapp        knappen (överst i rättningsvyn, alla flikar)
//   r.panel        sammanfattningen (dold tills knappen tryckts)
//   r.kor()        tryck på knappen (översiktens knapp öppnar vyn med &rattaAlla=1)
// ============================================================================

import { sammanfattning } from "./prov-ratta-alla.js";
import { h } from "./prov-vy.js";

const TEXT = "Rätta alla automatiska frågor";

/**
 * @param {object} o
 * @param {object} o.lager            prov-ratta-lager.js
 * @param {object[]} o.fragor         tillfällets frågor
 * @param {(fid: string) => void} o.oppnaFraga  länken "behöver din bedömning" → Per fråga
 * @param {(res: object) => void} [o.onKlar]    rita om vyn efter körningen
 */
export function rattaAllaVy({ lager, fragor, oppnaFraga, onKlar = () => {} }) {
  const knapp = h("button", {
    type: "button", class: "btn small provl-r-alla", text: TEXT,
    title: "Flerval, sant/falskt, para, ordna och kortsvar som stämmer med facit. Fritext och det du redan bedömt rörs inte.",
    on: { click: () => kor() },
  });
  const panel = h("div", { class: "panel provl-r-sammanfattning", role: "status", "aria-live": "polite", hidden: true });

  const lank = (text, fid) => h("button", { type: "button", class: "provl-lank provl-r-sf-lank", text, on: { click: () => oppnaFraga(fid) } });

  function visa(res) {
    const rader = sammanfattning(res, fragor);
    panel.replaceChildren(
      h("div", { class: "provl-r-sf-topp" },
        h("b", { text: "Automatisk rättning klar" }),
        h("button", { type: "button", class: "btn ghost small", text: "Stäng", "aria-label": "Stäng sammanfattningen", on: { click: () => { panel.hidden = true; } } })),
      h("ul", { class: "provl-r-sf-rader" }, rader.map((r) => h("li", {},
        h("span", { text: r.text }),
        r.fid ? lank(r.fragor.length > 1 ? "Visa den första" : "Visa", r.fid) : null,
        r.fragor?.length > 1 ? h("span", { class: "provl-r-sf-fragor" }, r.fragor.map((x) => lank(`Fråga ${x.nr} (${x.antal})`, x.fid))) : null))),
      h("p", { class: "hint", text: "Rättat automatiskt syns med etiketten ”Auto”. Du kan ändra allt som vanligt, och trycka igen om du lägger till ett godkänt svar i facit." }));
    panel.hidden = false;
  }

  async function kor() {
    if (knapp.disabled) return;
    knapp.disabled = true;
    knapp.textContent = "Rättar…";
    try {
      const res = await lager.rattaAlla();
      visa(res);
      onKlar(res);
    } finally {
      knapp.disabled = false;
      knapp.textContent = TEXT;
    }
  }

  return { knapp, panel, kor };
}
