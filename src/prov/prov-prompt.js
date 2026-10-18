// ============================================================================
// Prov (#739, spec §8.2): prompten för "Skapa med AI". Samma flöde som för
// Plugga-områdena (prompts.js/prompt-parts.js): läraren kopierar prompten
// till en AI, klistrar in svaret (JSON) och det går genom validateProv.
//
//   buildProvPrompt({ amne, arskurs, antal, typer, poang, onskemal, material })
//
// Schemat och exemplen finns per frågetyp i SCHEMA_TYP/EXEMPEL_TYP och bara de
// valda typerna kommer med. Ny frågetyp ⇒ en rad i båda (testet fäller annars).
// Laddas bara med import() (#271).
// ============================================================================

import { DEFAULT_GRADE_NR, gradeAge, gradeNr } from "../grades.js";
import { FRAGETYPER, fragetyp } from "./prov-fragetyper.js";
import { GRANS } from "./typer/delat.js";

export const ANTAL_MIN = 1;
export const ANTAL_MAX = 40;
export const ANTAL_STANDARD = 10;

/** Fälten per typ, som de ska stå i JSON:en (gemensamma fält läggs till separat). */
export const SCHEMA_TYP = {
  flerval: `"alternativ": [2–6 texter], "ratt": index för det rätta alternativet (0 = första)`,
  "flerval-flera": `"alternativ": [2–8 texter], "ratt": [index för ALLA rätta alternativ] (minst ett, 0 = första)`,
  santfalskt: `"ratt": true (påståendet är sant) eller false (falskt). "fraga" är ett påstående, inte en fråga.`,
  kortsvar: `"godkanda": [alla svar som ska räknas som rätt – stavningsvarianter, synonymer, tal med och utan enhet], "exaktStavning": true eller false (false = ett stavfel ger delpoäng), "skiftlage": true bara när stor/liten bokstav spelar roll`,
  lucktext: `"lucktext": texten där varje lucka skrivs [[svar]] eller [[svar|annat godkänt svar]] (högst ${GRANS.luckor} luckor), "exaktStavning", "skiftlage" som för kortsvar`,
  para: `"par": [{ "vanster": begrepp, "hoger": förklaring }, …] (3–10 par, alla olika)`,
  ordna: `"saker": [3–10 texter i RÄTT ordning] – eleven får dem blandade`,
  fritext: `"bedomningsstod": vad ett bra svar innehåller eller ett exempelsvar (bara läraren ser det), "kriterier": [poängkriterier, en text per rad, t.ex. "1 p: nämner en orsak"] (valfritt, högst ${GRANS.kriterier})`,
  text: `INGEN fråga: "titel", "brodtext" (högst ${GRANS.textblock} tecken). Ingen "fraga" och ingen "poang". Frågorna efter kan handla om texten.`,
  avsnitt: `INGEN fråga: en rubrik som delar in provet, "titel" (t.ex. "Del 1 – Begrepp") och valfri "instruktion" till eleven. Ingen "fraga" och ingen "poang". Frågorna numreras ändå löpande genom hela provet.`,
};

/** Ett kort exempel per typ (vikingatiden, samma tema som områdesprompten). */
export const EXEMPEL_TYP = {
  text: { typ: "text", titel: "Handelsstaden Birka", brodtext: "Birka låg på ön Björkö i Mälaren. Hit kom köpmän från många länder för att byta pälsar, silver och pärlor." },
  flerval: { typ: "flerval", fraga: "Var låg handelsstaden Birka?", alternativ: ["På Björkö i Mälaren", "På Gotland", "I Skåne", "Vid Göta älv"], ratt: 0, poang: 1 },
  "flerval-flera": { typ: "flerval-flera", fraga: "Vilka varor handlade vikingarna med?", alternativ: ["Pälsar", "Silver", "Potatis", "Kaffe"], ratt: [0, 1], poang: 2 },
  santfalskt: { typ: "santfalskt", fraga: "Vikingarna hade horn på sina hjälmar.", ratt: false, poang: 1 },
  kortsvar: { typ: "kortsvar", fraga: "Vad hette vikingarnas snabba skepp?", godkanda: ["långskepp", "långskeppet"], exaktStavning: false, skiftlage: false, poang: 1 },
  lucktext: { typ: "lucktext", fraga: "Fyll i luckorna.", lucktext: "Vikingatiden varade ungefär från år [[800]] till år [[1050]].", exaktStavning: true, skiftlage: false, poang: 2 },
  para: { typ: "para", fraga: "Para ihop guden med det guden styrde över.", par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }], poang: 3 },
  ordna: { typ: "ordna", fraga: "Sätt tidsperioderna i ordning, äldst först.", saker: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], poang: 2 },
  fritext: { typ: "fritext", fraga: "Beskriv hur en vikingagård kunde se ut.", bedomningsstod: "Ett bra svar nämner långhuset, djuren och arbetet på gården (minst två av tre).", kriterier: ["1 p: nämner en del av gården", "2 p: nämner två delar", "+1 p: förklarar vad delarna användes till"], poang: 4 },
  avsnitt: { typ: "avsnitt", titel: "Del 1 – Fakta om vikingatiden", instruktion: "Läs frågorna noga innan du svarar." },
};

/** De valda typerna i registrets ordning (okända bort; inget val = alla). */
export function valdaTyper(typer) {
  const valda = new Set((typer || []).filter((t) => fragetyp(t)));
  const lista = FRAGETYPER.map((t) => t.id).filter((id) => !valda.size || valda.has(id));
  return lista;
}

/** Antalet frågor som heltal inom gränserna. */
export function tolkaAntal(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= ANTAL_MIN ? Math.min(n, ANTAL_MAX) : ANTAL_STANDARD;
}

const fragaTyper = (ids) => ids.filter((id) => fragetyp(id).arFraga !== false);

/**
 * Bygg prompten.
 * @param {{ amne?: string, arskurs?: string|null, antal?: number, typer?: string[],
 *   poang?: boolean, onskemal?: string, material?: string }} o
 */
export function buildProvPrompt({ amne = "", arskurs = null, antal = ANTAL_STANDARD, typer = [], poang = true, onskemal = "", material = "" } = {}) {
  const ids = valdaTyper(typer);
  const fragor = fragaTyper(ids);
  const n = tolkaAntal(antal);
  const nr = gradeNr(arskurs) ?? DEFAULT_GRADE_NR;
  const alder = gradeAge(arskurs) ?? nr + 6;
  const amneText = String(amne || "").trim();
  const typLista = ids.map((id) => `- "${id}" (${fragetyp(id).namn}): ${SCHEMA_TYP[id]}`).join("\n");
  const exempel = {
    namn: amneText ? `Prov: ${amneText}` : "Prov: Vikingatiden",
    ...(amneText ? { amne: amneText } : { amne: "Historia" }),
    arskurs: `ak${nr}`,
    installningar: { poang },
    // Ett avsnitt står först i exemplet – det inleder en del av provet (#762).
    fragor: [...ids.filter((id) => id === "avsnitt"), ...ids.filter((id) => id !== "avsnitt")].map((id) => {
      const { poang: p, ...rest } = EXEMPEL_TYP[id];
      return poang || p === undefined ? EXEMPEL_TYP[id] : rest;
    }),
  };

  const regler = [
    "Svara med ENBART giltig JSON – ingen förklarande text före eller efter, inga ```-kodstaket.",
    "Använd dubbla citattecken runt alla nycklar och strängar. Inga avslutande kommatecken.",
    "All text på svenska. Korta meningar och ord som passar elevernas ålder.",
    "Hitta inte på fakta. Utgå från materialet nedan om det finns, annars från allmän och korrekt ämneskunskap.",
    "Flervalsalternativen ska vara rimliga och ungefär LIKA LÅNGA – det rätta svaret får aldrig vara det längsta eller mest detaljerade.",
    "Skriv aldrig facit eller ledtrådar till svaret i frågetexten.",
    "Kortsvar: lista alla rimliga svar som ska räknas som rätt i \"godkanda\" (stavningsvarianter, synonymer, med och utan enhet).",
    "Fritext: ge alltid ett \"bedomningsstod\" som säger vad ett bra svar innehåller.",
    "Blanda svårighetsgrad: några lätta frågor först, sedan svårare.",
    poang
      ? `Ge varje fråga ett "poang" (0.5–${GRANS.poang} i steg om 0.5, t.ex. 1, 2 eller 3.5) som speglar hur svår eller omfattande den är.`
      : 'Provet poängsätts inte: utelämna "poang" på frågorna.',
    `Frågetexten högst ${GRANS.fragetext} tecken. Inga listor i listor.`,
  ];

  const mat = String(material || "").trim();
  const ons = String(onskemal || "").trim();

  return `Du hjälper en lärare att skriva ett prov för elever i årskurs ${nr} (ca ${alder} år)${amneText ? ` i ämnet ${amneText}` : ""}.

Skapa ETT prov som JSON i exakt formatet nedan. Provet ska ha ${n} ${n === 1 ? "fråga" : "frågor"}${ids.includes("text") || ids.includes("avsnitt") ? ` (${ids.includes("text") && ids.includes("avsnitt") ? "textblock och avsnitt" : ids.includes("text") ? "textblock" : "avsnitt"} räknas inte som frågor)` : ""}.
Använd BARA de här frågetyperna${fragor.length > 1 ? " och blanda dem" : ""}:

${typLista}

Provet (objektet) har fälten:
- "namn": provets namn (högst 80 tecken)
- "amne": ämnet, "arskurs": "ak1"–"ak9", "beskrivning": valfri kort text till läraren
- "installningar": { "poang": ${poang} }
- "fragor": lista med frågorna i den ordning eleven ska se dem.
  Varje fråga har "typ", "fraga" (frågetexten)${poang ? ', "poang"' : ""} och kan ha "hjalptext" (en kort instruktion eleven ser under frågan), plus typens egna fält ovan.

Regler:
${regler.map((r) => `- ${r}`).join("\n")}

Exempel på formatet (byt ut innehållet, följ formen):
${JSON.stringify(exempel, null, 2)}
${ons ? `\nLärarens önskemål:\n"${ons}"\n` : ""}
${mat ? `Här är materialet provet ska bygga på:\n<<<\n${mat}\n>>>` : "Här är materialet provet ska bygga på (om läraren bifogar något):\n<<< KLISTRA IN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>"}`;
}
