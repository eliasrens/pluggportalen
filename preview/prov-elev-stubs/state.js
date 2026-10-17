// ============================================================================
// #740-preview: påhittat provtillfälle med ALLA frågetyper + elevens svar i
// minnet. Styrs från kontrollraden i preview/preview-prov-elev.html via
// window.__prov (nätfel, sparning som hänger, läraren stänger, tid kvar).
// ============================================================================
import { validateProv } from "../../src/prov/prov-validera.js";
import { delaUppProv } from "../../src/prov/prov-modell.js";

const PROV = validateProv({
  namn: "Vikingatiden – prov",
  installningar: { poang: true, stavningskontroll: false },
  fragor: [
    { typ: "text", titel: "Birka", brodtext: "Birka var en handelsstad på ön Björkö i Mälaren. Där bodde kanske 700 människor.\n\nHit kom köpmän från hela världen med silver, pärlor och tyger." },
    { typ: "flerval", fraga: "På vilken ö låg Birka?", alternativ: ["Björkö", "Gotland", "Öland", "Adelsö"], ratt: 0 },
    { typ: "flerval-flera", fraga: "Vilka varor handlade man med i Birka?", alternativ: ["Silver", "Pärlor", "Potatis", "Tyger"], ratt: [0, 1, 3], poang: 2 },
    { typ: "santfalskt", fraga: "Vikingarna hade horn på hjälmarna.", ratt: false },
    { typ: "kortsvar", fraga: "Vad hette vikingarnas guda-värld?", godkanda: ["Asgård"], hjalptext: "Ett ord." },
    { typ: "lucktext", fraga: "Fyll i luckorna.", lucktext: "Vikingarna seglade österut till [[Miklagård|Konstantinopel]] och västerut till [[England]].", poang: 2 },
    { typ: "para", fraga: "Para ihop guden med det hen styrde över.", poang: 3,
      par: [{ vanster: "Tor", hoger: "Åskan" }, { vanster: "Oden", hoger: "Visdomen" }, { vanster: "Freja", hoger: "Kärleken" }] },
    { typ: "ordna", fraga: "Sätt tidsåldrarna i rätt ordning, äldst först.", saker: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], poang: 3 },
    { typ: "fritext", fraga: "Beskriv hur livet på en vikingagård kunde se ut.", poang: 4, bedomningsstod: "Djur, långhus, arbete" },
    { typ: "kortsvar", fraga: "Vad kallades vikingarnas skrivtecken?", godkanda: ["runor"] },
    { typ: "flerval", fraga: "Ungefär när slutade vikingatiden?", alternativ: ["år 800", "år 1050", "år 1500"], ratt: 1 },
    { typ: "santfalskt", fraga: "Leif Eriksson kom till Nordamerika.", ratt: true },
  ],
}).value;

const { fragor } = delaUppProv(PROV);
const p = new URLSearchParams(location.search);

export const S = {
  tf: { id: "tf-demo", classId: "4a", provNamn: PROV.namn, status: "oppet", fragor, installningar: PROV.installningar,
    tidsgransMin: p.get("tid") === "ingen" ? null : 40,
    // #748: ?extra=15 → eleven har 15 minuter extra.
    ...(p.get("extra") ? { extraTid: { elev1: Number(p.get("extra")) } } : {}) },
  svar: null,
  natfel: false,
  hanger: false,
  skrivningar: 0,
  lyssnare: new Set(),
  tillbaka: [{ id: "tf-gammalt", provNamn: "Stenåldern – prov", aterlamnadAt: Date.now() - 3 * 86_400_000, totalPoang: 18, maxPoang: 24 }],
};
// ?kvar=4 → eleven har redan startat och har 4 minuter kvar (gul), 0.8 → röd.
if (p.get("kvar")) {
  const kvar = Number(p.get("kvar")) * 60_000;
  S.svar = { elevId: "elev1", classId: "4a", startad: Date.now() - S.tf.tidsgransMin * 60_000 + kvar, uppdaterad: Date.now() - 30_000, svar: {}, inlamnad: false };
}
// "Servern" överlever en omladdning (sessionStorage) – så syns återställningen.
try { if (!S.svar) S.svar = JSON.parse(sessionStorage.getItem("pv740:svar") || "null"); } catch {}
window.addEventListener("prov-stub", () => sessionStorage.setItem("pv740:svar", JSON.stringify(S.svar)));
window.__prov = S;
