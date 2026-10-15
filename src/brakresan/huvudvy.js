// ============================================================================
// Bråkresan – huvudvyn (src/brakresan/huvudvy.js) · #713 H
// ----------------------------------------------------------------------------
// Spec §11 "Huvudvy": rubrik + kort intro, översikt X/150 stjärnor och Y/50
// bemästrade, drakkortet (vid sidan på dator, ovanför listan på liten skärm),
// "Börja här" ur lärarens rekommendationer, sök + filter, ankarlänkar till de
// fem ämnesrubrikerna och EN lång lista med alla 50 i föreskriven ordning.
// Kortet: nummer, namn, miniatyr, mål, årskurs, Extra, tre stjärnplatser och
// status som läses utan färg. Listans läge (filter, sök, scroll, fokus)
// sparas när eleven öppnar en utmaning och återställs vid återkomsten.
//
//   createHuvudvy(host, { state, rek, href(id), drakpanel }) → { destroy }
//     state      getState() (data.js) – visas, aldrig skrivs
//     rek        Map(id → kommentarer) ur rekommendationer() (huvudvy-lista.js)
//     href(id)   länken till utmaningsvyn
//     drakpanel  { byt?, jakt?, onVisad? } vidare till drakpanel.js
// ============================================================================

import { h } from "./komponenter/bas.js";
import { CHALLENGES, SECTIONS, extraLabel } from "./schema/katalog.js";
import { CHALLENGE_COUNT, MAX_TOTAL_STARS, dragonLevel } from "./schema/regler.js";
import { FILTER, filtrera, kortStatus, listlage, sammanfattning } from "./huvudvy-lista.js";
import { miniatyrSvg } from "./miniatyr.js";

let cssLaddad = null;
export function ensureHuvudvyCss() {
  if (cssLaddad) return cssLaddad;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./huvudvy.css", import.meta.url).href;
  cssLaddad = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return cssLaddad;
}

const kortId = (id) => `brh-u-${id}`;
const avsnittId = (id) => `brh-avsnitt-${id}`;

/** Flytta till ett element i listan (ankarlänkar fungerar inte med hash-routern). */
function hoppaTill(el, fokus = el) {
  if (!el) return;
  const lugn = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: lugn ? "auto" : "smooth", block: "start" });
  fokus?.focus?.({ preventScroll: true });
}

function stjarnplatser(n) {
  return h("span", { class: "brh-stjarnor", role: "img", "aria-label": `${n} av 3 stjärnor` },
    ...[0, 1, 2].map((i) => h("span", { class: i < n ? "brh-stj brh-stj--full" : "brh-stj", "aria-hidden": "true" }, i < n ? "★" : "☆")));
}

function kort(c, entry, kommentarer, { href, onOppna }) {
  const st = kortStatus(entry);
  const extra = extraLabel(c);
  const a = h("a", { class: `brh-kort brh-kort--${st.status}`, href: href(c.id), onclick: () => onOppna(c.id) },
    h("span", { class: "brh-nr", "aria-hidden": "true" }, c.id),
    h("span", { class: "brh-bild" }),
    h("span", { class: "brh-text" },
      h("h3", { class: "brh-namn" }, h("span", { class: "brh-sr" }, `${c.nr}. `), c.name),
      h("span", { class: "brh-mal" }, c.goal),
      h("span", { class: "brh-etiketter" },
        h("span", { class: "brh-etikett" }, `Åk ${c.grade}`),
        extra ? h("span", { class: "brh-etikett brh-etikett--extra" }, `⬥ ${extra}`) : null,
        kommentarer ? h("span", { class: "brh-etikett brh-etikett--rek" }, "⚑ Rekommenderad") : null)),
    h("span", { class: "brh-status" },
      stjarnplatser(st.stars),
      h("span", { class: "brh-statustext" }, h("span", { "aria-hidden": "true" }, `${st.ikon} `), st.label),
      st.senast ? h("span", { class: "brh-senast" }, st.senast) : null),
    st.status === "bemastrad" ? h("span", { class: "brh-stampel", "aria-hidden": "true" }, "✪") : null);
  a.querySelector(".brh-bild").innerHTML = miniatyrSvg(c.id); // statisk SVG ur egen tabell
  return h("li", { class: "brh-post", id: kortId(c.id), "data-id": c.id }, a);
}

export async function createHuvudvy(host, { state, rek = new Map(), href, drakpanel = {} }) {
  await ensureHuvudvyCss();
  const lage = listlage.las() || { filter: "alla", sok: "", scrollY: 0, fokus: null };
  let filter = lage.filter;
  const sum = sammanfattning(state);

  const spara = (fokus = null) => listlage.spara({ filter, sok: sok.value, scrollY: Math.round(window.scrollY), fokus });
  const onOppna = (id) => spara(id);

  // --- topp: intro + översikt + draken ---
  const drakYta = h("div", { class: "brh-drake" });
  const topp = h("div", { class: "brh-topp" },
    h("header", { class: "brh-intro" },
      h("h1", { class: "brv-titel" }, "Bråkresan"),
      h("p", { class: "brh-ingress" },
        "Träna bråk, decimaltal och procent i 50 utmaningar. Börja var du vill – ordningen är bara ett förslag. " +
        "Tio uppgifter per omgång, och 8 rätt ger en stjärna."),
      h("p", { class: "brh-oversikt" },
        h("span", { class: "brh-siffra" }, h("span", { "aria-hidden": "true" }, "★ "), h("strong", null, String(sum.stars)), ` av ${MAX_TOTAL_STARS} stjärnor`),
        h("span", { class: "brh-siffra" }, h("span", { "aria-hidden": "true" }, "✪ "), h("strong", null, String(sum.mastered)), ` av ${CHALLENGE_COUNT} bemästrade`))),
    drakYta);

  // --- ankarlänkar till ämnesrubrikerna ---
  const ankare = h("nav", { class: "brh-ankare", "aria-label": "Hoppa till ett ämne" },
    h("ul", null, ...SECTIONS.map((s) => h("li", null,
      h("button", { type: "button", class: "brh-ankarlank", onclick: () => hoppaTill(document.getElementById(avsnittId(s.id))) }, s.name)))));

  // --- Börja här (lärarens rekommendationer) ---
  let borja = null;
  if (rek.size) {
    borja = h("section", { class: "brh-borja", "aria-labelledby": "brh-borja-titel" },
      h("h2", { id: "brh-borja-titel" }, "Börja här"),
      h("p", { class: "brh-svag" }, "Din lärare tipsar om de här. Du kan ändå välja vilken utmaning du vill."),
      h("ul", null, ...[...rek].map(([id, kommentarer]) => {
        const c = CHALLENGES.find((x) => x.id === id);
        return h("li", null,
          h("button", { type: "button", class: "brh-borja-lank", onclick: () => hoppaTill(document.getElementById(kortId(id)), document.querySelector(`#${kortId(id)} a`)) },
            `${c.id}. ${c.name}`),
          ...kommentarer.map((k) => h("q", { class: "brh-kommentar" }, k)));
      })));
  }

  // --- sök + filter ---
  const sok = h("input", { type: "search", id: "brh-sok", class: "brh-sok", value: lage.sok, autocomplete: "off", placeholder: "t.ex. tallinje, procent, 19" });
  const filterKnappar = FILTER.map((f) => h("button", {
    type: "button", class: "brh-filter", "aria-pressed": String(f.id === filter), "data-filter": f.id,
    onclick: () => { filter = f.id; uppdatera(); spara(); },
  }, f.label));
  const antal = h("p", { class: "brh-antal", role: "status", "aria-live": "polite" });
  const verktyg = h("div", { class: "brh-verktyg" },
    h("div", { class: "brh-sokrad" }, h("label", { for: "brh-sok" }, "Sök utmaning eller moment"), sok),
    h("div", { class: "brh-filterrad", role: "group", "aria-label": "Visa" }, ...filterKnappar),
    antal);
  sok.addEventListener("input", () => { uppdatera(); spara(); });

  // --- listan: fem diskreta rubriker, alla 50 kort ---
  const tomt = h("div", { class: "brh-tomt", hidden: true },
    h("p", null, "Inga utmaningar passar sökningen."),
    h("button", { type: "button", class: "br-knapp", onclick: () => { filter = "alla"; sok.value = ""; uppdatera(); spara(); sok.focus(); } }, "Visa alla 50"));
  const lista = h("div", { class: "brh-lista" });
  const avsnitt = SECTIONS.map((s) => {
    const ol = h("ol", { class: "brh-kortlista" });
    for (const c of CHALLENGES.filter((x) => x.section === s.id)) {
      ol.append(kort(c, state?.challenges?.[c.id], rek.get(c.id) ? rek.get(c.id) : null, { href, onOppna }));
    }
    const sek = h("section", { class: "brh-avsnitt", "aria-labelledby": avsnittId(s.id) },
      h("h2", { class: "brh-avsnittsrubrik", id: avsnittId(s.id), tabindex: "-1" }, s.name, h("small", null, ` · ungefär årskurs ${s.grade}`)),
      ol);
    lista.append(sek);
    return sek;
  });

  function uppdatera() {
    const synliga = new Set(filtrera(CHALLENGES, { sok: sok.value, filter, state, rek }).map((c) => c.id));
    for (const li of lista.querySelectorAll(".brh-post")) li.hidden = !synliga.has(li.dataset.id);
    for (const sek of avsnitt) sek.hidden = !sek.querySelector(".brh-post:not([hidden])");
    for (const b of filterKnappar) b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
    antal.textContent = synliga.size === CHALLENGES.length ? `Alla ${CHALLENGES.length} utmaningar visas.`
      : `Visar ${synliga.size} av ${CHALLENGES.length} utmaningar.`;
    tomt.hidden = synliga.size > 0;
  }

  const rot = h("section", { class: "brv brh", "aria-labelledby": "brh-titel" }, topp, ankare, borja, verktyg, tomt, lista);
  rot.querySelector(".brv-titel").id = "brh-titel";
  host.replaceChildren(rot);
  uppdatera();

  // --- draken (lat konst) ---
  const { createDrakkort, oppnaDrakpanel } = await import("./drakpanel.js");
  let aktuellt = state;
  const oppna = (fokusTillbaka, forandring = null) => oppnaDrakpanel({
    state: aktuellt, byt: drakpanel.byt, jakt: drakpanel.jakt, fokusTillbaka, forandring,
    onVisad: drakpanel.onVisad,
    onNamn: (namn) => {
      aktuellt = { ...aktuellt, dragon: { ...aktuellt.dragon, name: namn } };
      drakkort.uppdatera(aktuellt);
    },
  });
  const drakkort = await createDrakkort(drakYta, { state, oppna: (knapp) => oppna(knapp) });

  // --- återställ listans läge efter en utmaning ---
  if (lage.scrollY || lage.fokus) {
    requestAnimationFrame(() => {
      window.scrollTo(0, lage.scrollY);
      document.querySelector(`#${kortId(lage.fokus)} a`)?.focus({ preventScroll: true });
    });
    listlage.spara({ filter, sok: sok.value, scrollY: 0, fokus: null });
  }

  // --- kläckning/evolution som inte visats än (servern har redan sparat nivån, §9) ---
  const niva = dragonLevel(state?.totalStars);
  const visad = state?.dragon ? (state.dragon.levelShown || 0) : niva;
  if (state?.dragon && niva > visad) oppna(drakYta.querySelector(".bdp-om"), { fran: visad, till: niva });

  return {
    destroy: () => {
      drakkort.destroy();
      for (const d of document.querySelectorAll("dialog.bdp-dialog[open]")) d.close();
    },
  };
}
