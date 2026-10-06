// Preview-scenario för preview-pixi-skola.html (#421, epic #396). Klasserna
// återanvänds ur preview/by-stubs/data.js (#391-previewn); eleverna genereras
// här. Inloggad elev = "alva" i 4A. Dolda byar väljs med URL:en: ?dold=spec,5a
// (läggs i 4A:s hiddenVillages – exakt fältet läraren skriver, #391).
import { classes } from "/preview/by-stubs/data.js";

export const ME = "alva";
export { classes };

const AVATARER = ["fox", "owl", "cat", "dog", "panda", "frog", "unicorn", "dragon", "lion", "penguin", "koala", "robot"];
const PALETTER = ["persika", "mint", "himmel", "rosa", "sol", "lavendel", "korall", "skog", "hav", "korsbar"];
const KLADER = [[], ["krona"], ["keps"], [], ["halsduk"], []];

let dolda = [];
try {
  dolda = (new URLSearchParams(location.search).get("dold") || "").split(",").map((s) => s.trim()).filter(Boolean);
} catch { /* ingen location */ }
export const DOLDA = dolda;
const egen = classes.find((c) => c.studentIds.includes(ME));
if (egen) egen.hiddenVillages = dolda.filter((id) => id !== egen.id);

const namn = (id) => id.charAt(0).toUpperCase() + id.slice(1);

/** En projektions-entry (boende) i samma form som class-projection.js ger. */
export function entry(id, i) {
  return {
    id,
    namn: namn(id),
    username: id,
    avatarId: AVATARER[i % AVATARER.length],
    avatarItems: KLADER[i % KLADER.length],
    paletteId: PALETTER[(i * 3) % PALETTER.length],
    husSkalId: null,
    stars: (i * 7) % 23,
    xp: 40 * i,
    completed: i % 5,
    // Andra eleven i varje klass har låst hus (husLast → 🔒, ingen förrendering).
    locked: i === 1,
  };
}

/** Logg över stubbade "Firestore-läsningar" (räknas i klick-testet). */
export const lasningar = [];
export function lasning(fn, arg) {
  lasningar.push({ fn, arg, t: Math.round(performance.now()) });
}
