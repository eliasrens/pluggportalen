// ============================================================================
// Pluggportalen – pytteliten DOM-hjälpare (dom.js)
// ----------------------------------------------------------------------------
// Bara `el()`: bygg ett element ur en HTML-sträng. Bruten ut ur ui.js så att
// moduler som BARA behöver el() (t.ex. game-questions.js) kan importera den
// utan att dra in hela ui.js → data.js → firebase-kedjan. Det gör dem också
// enhetstestbara i Node (ui.js importerar firebase via https och kan inte
// laddas där). ui.js re-exporterar el härifrån, så alla befintliga
// importvägar (`import { el } from "./ui.js"`) fortsätter fungera oförändrat.
// ============================================================================

/** Bygg ett element från en HTML-sträng (första elementet returneras). */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
