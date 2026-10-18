// ============================================================================
// Prov (#741, spec §6.1–§6.2): ett rättningskort – en elevs svar (eller en
// grupp identiska kortsvar) med Rätt/Delvis/Fel, poäng (sifferfält +
// snabbknappar 0 … max) och kommentar. Samma kort i båda lägena; sidan
// (prov-ratta-sida.js) bestämmer vilka elever kortet gäller.
//
//   const k = rattaKort({ ... }); k.el, k.rita(), k.bedom(ratt)
// Kortet är fokuserbart (tabindex 0): sidan låter 1/2/3 bedöma kortet i fokus
// och Tab hoppa till nästa kort (§6.1).
// ============================================================================

import { fragetyp } from "./prov-fragetyper.js";
import { BEDOMNINGAR, arForslag, bedomning, tolkaPoang } from "./prov-rattning-logik.js";
import { h } from "./prov-vy.js";
import { poangTal as poangText } from "./prov-poang.js";

/** Snabbknapparna (§6.1): 0 … max, och halva/max för stora frågor. */
export function snabbPoang(max) {
  if (max <= 0) return [];
  if (max <= 6) return Array.from({ length: max + 1 }, (_, i) => i);
  return [0, Math.round(max / 2), max];
}

/**
 * @param {object} o
 * @param {string} o.titel            "Alva" / "”Birka” – 12 elever"
 * @param {string} [o.under]          namnen i gruppen
 * @param {object} o.fraga            tillfällets fråga
 * @param {any} o.svar                svaret som visas (gruppens första)
 * @param {any} o.facit               facit för frågan (markeringarna)
 * @param {boolean} [o.facitRad]      facit-raden i svaret (per elev: ja)
 * @param {Node} [o.huvud]            frågan överst (per elev)
 * @param {boolean} o.poangsatt
 * @param {() => { post: object|null, blandat: boolean, last: boolean }} o.lage
 * @param {(andring: object) => void} o.onAndring
 */
export function rattaKort(o) {
  const typ = fragetyp(o.fraga.typ);
  const max = Number(o.fraga.poang) || 0;
  const el = h("article", { class: "provl-r-kort", tabindex: "0", "aria-label": o.titel });
  el.__kort = null;

  const papper = h("div", { class: "provv-rot provl-r-papper" },
    typ.renderRattning(o.fraga, o.svar, { facit: o.facit, facitRad: o.facitRad === true }));
  const lageEl = h("span", { class: "provl-r-lage" });
  const knappar = BEDOMNINGAR.map((b) => h("button", {
    type: "button", class: `provl-r-b provl-r-b-${b.id}`, tabindex: "-1", "aria-pressed": "false",
    title: `${b.namn} (${b.tangent})`, on: { click: () => bedom(b.ratt) },
  }, h("span", { class: "provl-r-b-ikon", "aria-hidden": "true", text: b.ikon }), h("span", { text: b.namn }), h("kbd", { text: b.tangent })));
  const poangFalt = h("input", { type: "text", inputmode: "decimal", class: "provl-r-poang-falt", size: "3", "aria-label": `Poäng (av ${poangText(max)})` });
  poangFalt.addEventListener("change", () => {
    const p = tolkaPoang(poangFalt.value, max);
    if (p == null) return rita();
    o.onAndring({ poang: p });
    rita();
  });
  const snabb = snabbPoang(max).map((p) => h("button", {
    type: "button", class: "provl-r-snabb", tabindex: "-1", text: poangText(p), "aria-label": `${poangText(p)} poäng`,
    on: { click: () => { o.onAndring({ poang: p }); rita(); } },
  }));
  const kommentar = h("input", { type: "text", class: "provl-r-kommentar-falt", maxlength: "1000", placeholder: "Kommentar till eleven (valfri)", "aria-label": "Kommentar" });
  let tid = null;
  kommentar.addEventListener("input", () => {
    clearTimeout(tid);
    tid = setTimeout(() => o.onAndring({ kommentar: kommentar.value }), 600);
  });
  kommentar.addEventListener("change", () => { clearTimeout(tid); o.onAndring({ kommentar: kommentar.value }); });
  const lastText = h("p", { class: "provl-r-last hint", text: "Tillbakalämnat – ångra tillbakalämningen under Per elev för att ändra." });

  const kontroller = h("div", { class: "provl-r-kontroller" },
    h("div", { class: "provl-r-bedom", role: "group", "aria-label": "Bedömning" }, knappar),
    o.poangsatt && max > 0 ? h("div", { class: "provl-r-poang" },
      h("label", { class: "provl-r-poang-etikett" }, "Poäng ", poangFalt, ` av ${poangText(max)}`),
      h("span", { class: "provl-r-snabbar" }, snabb)) : null,
    h("label", { class: "provl-r-kommentar" }, kommentar));

  el.append(
    h("header", { class: "provl-r-kort-huvud" },
      h("div", { class: "provl-r-vem" }, h("b", { text: o.titel }), o.under ? h("span", { class: "provl-r-under", text: o.under }) : null),
      lageEl),
    o.huvud || "",
    papper, kontroller, lastText);

  function bedom(ratt) {
    if (o.lage().last) return;
    o.onAndring({ ratt });
    rita();
  }

  function rita() {
    const { post, blandat, last } = o.lage();
    const b = bedomning(post?.ratt);
    const forslag = arForslag(post);
    el.classList.toggle("provl-r-forslag", forslag);
    el.classList.toggle("provl-r-bedomd", !!b && !forslag && !blandat);
    el.classList.toggle("provl-r-last-kort", last);
    lageEl.replaceChildren(blandat
      ? h("span", { class: "provl-r-tagg provl-r-tagg-blandat", text: "Olika bedömningar" })
      : forslag
        ? h("span", { class: "provl-r-tagg provl-r-tagg-auto", title: "Automatiskt förslag – godkänn eller ändra" }, "Auto · ", `${b.ikon} ${b.namn}`)
        : b ? h("span", { class: `provl-r-tagg provl-r-tagg-${b.id}`, text: `${b.ikon} ${b.namn}` })
          : h("span", { class: "provl-r-tagg provl-r-tagg-ej", text: "? Inte rättad" }));
    knappar.forEach((k, i) => {
      const valt = !blandat && !!post && post.ratt === BEDOMNINGAR[i].ratt;
      k.setAttribute("aria-pressed", valt && !forslag ? "true" : "false");
      k.classList.toggle("provl-r-b-forslag", valt && forslag);
      k.disabled = last;
    });
    if (document.activeElement !== poangFalt) poangFalt.value = blandat || post?.poang == null ? "" : poangText(post.poang);
    poangFalt.disabled = last;
    snabb.forEach((s, i) => {
      s.disabled = last;
      s.classList.toggle("provl-r-snabb-vald", !blandat && post?.poang === snabbPoang(max)[i]);
    });
    if (document.activeElement !== kommentar) kommentar.value = blandat ? "" : post?.kommentar || "";
    kommentar.placeholder = blandat ? "Olika kommentarer – skriv för att ge alla samma" : "Kommentar till eleven (valfri)";
    kommentar.disabled = last;
    lastText.hidden = !last;
  }

  rita();
  const api = { el, rita, bedom };
  el.__kort = api;
  return api;
}
