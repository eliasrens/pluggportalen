// ============================================================================
// Bråkresan – 12. Resultat och belöning (komponenter/resultat.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 12, §5 "Avslutning", §11 "Belöningskänsla": samma enkla
// språk och stjärnlogik i alla speltyper. Texterna kommer ur schema/regler.js
// (resultMessage) så att servern, sidan och lärarvyn säger samma sak.
//
// createAterkoppling(host, { correct, feedback, message, display }, opts)
//   Återkopplingen efter "Kontrollera": "Rätt!" / "Inte riktigt ännu" med ikon
//   och text (aldrig bara färg), kopplingen till modellen och – efter fel –
//   "Försök igen" (bearbetning) och "Fortsätt". Ingen automatisk växling:
//   "Fortsätt" är ett medvetet klick. Fokus flyttas till rubriken.
//   opts = { onContinue, onRework, continueLabel, kompakt }
//   kompakt: en rad-text utan egna knappar och utan fokusflytt – sidan har
//   knapparna i sin knapprad och en aria-live-plats runt (omgången, #753).
//
// createResultat(host, { correct, reward, starsBefore, results?, suggestions? }, opts)
//   Omgångens slut: "X av 10 rätt", tio markeringar (✓ / ↻), tre stjärnplatser
//   där en ny stjärna fylls (kort ljusanimation, stilla vid reducerad rörelse),
//   mynt bara om de verkligen betalas, "Repetition – …" efter tre stjärnor,
//   och vid 0–5 rätt två förslag att prova. opts = { actions: [{ label, onClick }] }
// ============================================================================

import { h, ensureCss, reduceradRorelse } from "./bas.js";
import { resultMessage, MAX_STARS_PER_CHALLENGE, ROUND_SIZE } from "../schema/regler.js";

const STJARNA = "★";

export function createAterkoppling(host, res, opts = {}) {
  ensureCss();
  const ratt = !!res.correct;
  const rubrik = h("h3", { class: "br-aterkoppling-rubrik", tabindex: "-1" },
    h("span", { class: "br-utfall-ikon", "aria-hidden": "true" }, ratt ? "✓" : "↻"), ratt ? "Rätt!" : "Inte riktigt ännu");
  const knappar = h("div", { class: "br-aterkoppling-knappar" });
  if (!ratt && opts.onRework) knappar.append(h("button", { type: "button", class: "br-knapp br-knapp--hjalp", onclick: opts.onRework }, "Försök igen"));
  if (opts.onContinue) knappar.append(h("button", { type: "button", class: "br-knapp br-knapp--fortsatt", onclick: opts.onContinue }, opts.continueLabel || "Fortsätt"));
  const kompakt = !!opts.kompakt;
  const el = h("section", { class: `br-aterkoppling br-aterkoppling--${ratt ? "ratt" : "fel"}${kompakt ? " br-aterkoppling--kompakt" : ""}`, "aria-live": kompakt ? null : "polite" },
    rubrik,
    res.feedback ? h("p", { class: "br-aterkoppling-text" }, res.feedback) : null,
    !ratt && res.message ? h("p", { class: "br-aterkoppling-forklaring" }, res.message) : null,
    !ratt && res.display ? h("p", { class: "br-aterkoppling-facit" }, "Rätt svar: ", h("strong", null, res.display)) : null,
    knappar.childElementCount ? knappar : null);
  host.append(el);
  if (!kompakt) rubrik.focus({ preventScroll: false });
  return { el, destroy: () => el.remove() };
}

export function createResultat(host, data, opts = {}) {
  ensureCss();
  const { correct, reward, starsBefore = 0 } = data;
  const stilla = reduceradRorelse(opts);
  const ny = reward?.kind === "stjarna";
  const efter = ny ? Math.min(MAX_STARS_PER_CHALLENGE, starsBefore + 1) : starsBefore;
  const text = data.message || resultMessage({ correct, reward: reward || { kind: "ingen" } });

  const stjarnor = h("div", { class: "br-stjarnplatser", role: "img", "aria-label": `${efter} av 3 stjärnor${ny ? ", en ny" : ""}` },
    Array.from({ length: MAX_STARS_PER_CHALLENGE }, (_, i) => h("span", {
      class: `br-stjarnplats${i < efter ? " br-stjarnplats--fylld" : ""}${ny && i === efter - 1 ? " br-stjarnplats--ny" : ""}`,
      "aria-hidden": "true",
    }, i < efter ? STJARNA : "☆")));
  const prickar = Array.isArray(data.results) && data.results.length === ROUND_SIZE
    ? h("ol", { class: "br-resultatprickar", "aria-label": "Uppgifterna" }, data.results.map((r, i) => h("li", {
      class: `br-prick br-prick--${r ? "ratt" : "fel"}`, "aria-label": `Uppgift ${i + 1}: ${r ? "rätt" : "inte rätt"}`,
    }, h("span", { "aria-hidden": "true" }, r ? "✓" : "↻"))))
    : null;
  const mynt = reward?.coins > 0
    ? h("div", { class: `br-mynt${stilla ? "" : " br-mynt--animera"}` }, h("span", { class: "br-myntikon", "aria-hidden": "true" }), `+${reward.coins} mynt`)
    : null;
  const forslag = correct <= 5 && data.suggestions?.length
    ? h("div", { class: "br-forslag" }, h("p", null, "Prova gärna:"),
      h("ul", null, data.suggestions.slice(0, 2).map((x) => h("li", null, x))))
    : null;
  const titel = reward?.kind === "repetition" ? "Repetition" : ny ? "Ny stjärna!" : "Omgången är klar";
  const rubrik = h("h2", { class: "br-resultat-rubrik", tabindex: "-1" }, titel);
  const el = h("section", { class: `br-resultat br-resultat--${reward?.kind || "ingen"}${stilla ? " br-k--stilla" : ""}` },
    rubrik,
    h("p", { class: "br-resultat-antal" }, h("strong", null, `${correct} av ${ROUND_SIZE}`), " rätt"),
    prickar, stjarnor,
    h("p", { class: "br-resultat-text" }, text),
    mynt, forslag,
    opts.actions?.length ? h("div", { class: "br-resultat-knappar" }, opts.actions.map((a) => h("button", {
      type: "button", class: `br-knapp${a.primary ? " br-knapp--fortsatt" : ""}`, onclick: a.onClick,
    }, a.label))) : null);
  host.append(el);
  rubrik.focus({ preventScroll: false });
  return { el, destroy: () => el.remove() };
}
