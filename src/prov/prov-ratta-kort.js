// ============================================================================
// Prov (#741, spec §6.1–§6.2): ett rättningskort – en elevs svar (eller en
// grupp identiska kortsvar) med Rätt/Delvis/Fel, poäng och kommentar. Samma
// kort i båda lägena; sidan (prov-ratta-sida.js) bestämmer vilka elever
// kortet gäller.
// Halvpoäng (#764, §6.1): sifferfält i steg om 0,5, snabbknappar 0, ½, 1, 1½ …
// max – för frågor över 6 p knapparna − och + i stället. Aldrig > max eller < 0.
// Fritext: poängkriterierna (#762) bredvid svaret. Kortsvar/luckor: "Godkänn
// även 'Björkö'" (facit i efterhand). Rättat av "Rätta alla" = etiketten "Auto".
// En poängsatt fråga värd 0,5 p har ingen "Delvis" (#765, delvisMojlig): det
// finns ingen poäng mellan 0 och max – knappen saknas och tangenten 2 gör inget.
//
//   const k = rattaKort({ ... }); k.el, k.rita(), k.bedom(ratt), k.stega(±1)
// Kortet är fokuserbart (tabindex 0): sidan låter 1/2/3 bedöma kortet i fokus,
// + och − ändra poängen med 0,5 och Tab hoppa till nästa kort (§6.1).
// ============================================================================

import { fragetyp } from "./prov-fragetyper.js";
import { BEDOMNINGAR, arAutoRattad, arForslag, bedomning, delvisMojlig, tolkaPoang, visadRatt } from "./prov-rattning-logik.js";
import { h } from "./prov-vy.js";
import { franHalvor, halvor, klamPoang, poangTal as poangText } from "./prov-poang.js";

// Frågor värda mer än så här får − och + i stället för snabbknappar (§6.1).
export const SNABB_MAX = 6;

/** Snabbknapparna (§6.1, #764): 0, ½, 1, 1½ … max; inga för frågor över 6 p. */
export function snabbPoang(max) {
  const m = halvor(max);
  if (m <= 0 || max > SNABB_MAX) return [];
  return Array.from({ length: m + 1 }, (_, i) => franHalvor(i));
}

/** Snabbknappens text: 0 → "0", 0,5 → "½", 1,5 → "1½". */
export function halvText(p) {
  const n = halvor(p);
  const hel = Math.floor(n / 2);
  return n % 2 ? `${hel || ""}½` : String(hel);
}

/** Poängen ett steg (±0,5) från `p` (saknas = 0), aldrig under 0 eller över max. */
export const stegaPoang = (p, steg, max) => klamPoang((Number.isFinite(Number(p)) && p !== null ? Number(p) : 0) + steg * 0.5, max);

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
 * @param {string[]} [o.kriterier]    fritextens poängkriterier (#762) – visas bredvid svaret
 * @param {{ text: string, lucka: number|null }[]} [o.godkannbara]  svar som kan läggas till i facit (#764)
 * @param {(g: { text, lucka }) => Promise<boolean>} [o.onGodkannAven]
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
  const delvisOk = delvisMojlig(max, o.poangsatt);
  const bedomningar = BEDOMNINGAR.filter((b) => delvisOk || b.ratt !== "delvis");
  const knappar = bedomningar.map((b) => h("button", {
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
  const snabbLista = snabbPoang(max);
  const snabb = snabbLista.map((p) => h("button", {
    type: "button", class: "provl-r-snabb", tabindex: "-1", text: halvText(p), "aria-label": `${poangText(p)} poäng`,
    on: { click: () => { o.onAndring({ poang: p }); rita(); } },
  }));
  // Över 6 p (§6.1): − och + i steg om 0,5.
  const steg = snabbLista.length ? [] : [-1, 1].map((d) => h("button", {
    type: "button", class: "provl-r-steg", tabindex: "-1", text: d < 0 ? "−" : "+",
    "aria-label": d < 0 ? "Ett halvt poäng mindre" : "Ett halvt poäng mer", on: { click: () => stega(d) },
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
      h("span", { class: "provl-r-snabbar" }, snabb, steg)) : null,
    h("label", { class: "provl-r-kommentar" }, kommentar));

  // Poängkriterierna bredvid svaret (§6.1, fritext) – bara stöd, läraren sätter poängen.
  const kriterier = o.kriterier?.length ? h("aside", { class: "provl-r-kriterier", "aria-label": "Poängkriterier" },
    h("b", { text: "Poängkriterier" }), h("ul", {}, o.kriterier.map((k) => h("li", { text: k })))) : null;
  // Facit i efterhand (§6.0): läggs i privat/facit och används nästa gång "Rätta alla" körs.
  const tillagg = o.godkannbara?.length && o.onGodkannAven ? h("div", { class: "provl-r-tillagg" }, o.godkannbara.map((g) => {
    const text = `Godkänn även ”${g.text}”${g.lucka == null ? "" : ` i lucka ${g.lucka + 1}`}`;
    const b = h("button", {
      type: "button", class: "btn ghost small provl-r-godkann-aven", tabindex: "-1", text,
      title: "Läggs till i facit för det här tillfället. Tryck sedan ”Rätta alla automatiska frågor”.",
      on: { click: async () => {
        b.disabled = true;
        const ok = await o.onGodkannAven(g).catch(() => null);
        if (ok === null) b.disabled = false;
        else b.textContent = `✓ ”${g.text}” finns i facit`;
      } },
    });
    return b;
  })) : null;

  el.append(
    h("header", { class: "provl-r-kort-huvud" },
      h("div", { class: "provl-r-vem" }, h("b", { text: o.titel }), o.under ? h("span", { class: "provl-r-under", text: o.under }) : null),
      lageEl),
    o.huvud || "",
    kriterier ? h("div", { class: "provl-r-svarrad" }, papper, kriterier) : papper,
    kontroller, tillagg || "", lastText);

  function bedom(ratt) {
    if (o.lage().last || (ratt === "delvis" && !delvisOk)) return;
    o.onAndring({ ratt });
    rita();
  }

  // + och − (§6.1): ±0,5 från nuvarande poäng (inget/olika = 0). Inget utan poäng.
  function stega(d) {
    const { post, blandat, last } = o.lage();
    if (last || !o.poangsatt || max <= 0) return;
    const fore = blandat ? null : post?.poang ?? null;
    const p = stegaPoang(fore, d, max);
    if (p === fore) return;
    o.onAndring({ poang: p });
    rita();
  }

  function rita() {
    const { post, blandat, last } = o.lage();
    const visad = post ? visadRatt(post, max, o.poangsatt) : undefined; // full poäng = rätt (#765)
    const b = bedomning(visad);
    const forslag = arForslag(post);
    const autoRattad = !blandat && arAutoRattad(post);
    el.classList.toggle("provl-r-forslag", forslag);
    el.classList.toggle("provl-r-bedomd", !!b && !forslag && !blandat);
    el.classList.toggle("provl-r-last-kort", last);
    lageEl.replaceChildren(blandat
      ? h("span", { class: "provl-r-tagg provl-r-tagg-blandat", text: "Olika bedömningar" })
      : forslag
        ? h("span", { class: "provl-r-tagg provl-r-tagg-auto", title: "Automatiskt förslag – godkänn eller ändra" }, "Auto · ", `${b.ikon} ${b.namn}`)
        : b ? h("span", { class: "provl-r-taggar" },
          h("span", { class: `provl-r-tagg provl-r-tagg-${b.id}`, text: `${b.ikon} ${b.namn}` }),
          autoRattad ? h("span", { class: "provl-r-auto", title: "Rättad automatiskt – du kan ändra som vanligt", text: "Auto" }) : null)
          : h("span", { class: "provl-r-tagg provl-r-tagg-ej", text: "? Inte rättad" }));
    knappar.forEach((k, i) => {
      const valt = !blandat && !!post && visad === bedomningar[i].ratt;
      k.setAttribute("aria-pressed", valt && !forslag ? "true" : "false");
      k.classList.toggle("provl-r-b-forslag", valt && forslag);
      k.disabled = last;
    });
    if (document.activeElement !== poangFalt) poangFalt.value = blandat || post?.poang == null ? "" : poangText(post.poang);
    poangFalt.disabled = last;
    snabb.forEach((s, i) => {
      s.disabled = last;
      s.classList.toggle("provl-r-snabb-vald", !blandat && post?.poang === snabbLista[i]);
    });
    const nu = blandat ? null : post?.poang ?? null;
    steg.forEach((s, i) => { s.disabled = last || stegaPoang(nu, i ? 1 : -1, max) === nu; });
    if (document.activeElement !== kommentar) kommentar.value = blandat ? "" : post?.kommentar || "";
    kommentar.placeholder = blandat ? "Olika kommentarer – skriv för att ge alla samma" : "Kommentar till eleven (valfri)";
    kommentar.disabled = last;
    lastText.hidden = !last;
  }

  rita();
  const api = { el, rita, bedom, stega };
  el.__kort = api;
  return api;
}
