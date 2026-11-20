// ============================================================================
// Matchdagen (#868): kommentatorns rader och knapparnas texter (spec §3.2, §3.5).
// Ren data. Varje händelse har flera varianter som motorn slumpar mellan (med
// den inskickade slumpen). Tonen: uppmuntrande och lugn, ALDRIG hånfull (§14) –
// vid fel svar står det vad som hände, sedan visar frågekortet rätt svar.
// {mot} byts mot motståndarlagets namn.
// ============================================================================

/** Knapparna när vi har bollen (§3.2). */
export const VAL_TEXT = {
  kort: { namn: "Kort pass", text: "Säkert" },
  lang: { namn: "Långt pass", text: "Riskabelt" },
  dribbla: { namn: "Dribbla", text: "Förbi en motspelare" },
  skjut: { namn: "Skjut!" },
  tackla: { namn: "Tackla", text: "Ta bollen" },
  tack: { namn: "Täck", text: "Stoppa farten" },
};

/** Skottknappens text efter avståndet (§3.2). */
export const SKOTT_TEXT = {
  forLangt: "För långt bort",
  langt: "Långt skott – liten chans",
  bra: "Bra läge",
  jatte: "Jätteläge!",
};

/** Raden innan eleven väljer (ingen slump – samma läge ger samma rad). */
export const LAGE_TEXT = {
  egenHalva: "Vi har bollen. Hur bygger vi upp?",
  derasHalva: "Vi har bollen på deras planhalva.",
  nara: "Nu är vi nära målet!",
  horna: "Hörna till oss! Bollen slås in högt.",
  derasPass: "{mot} spelar upp bollen …",
  forsvar: "{mot} anfaller på vår planhalva!",
  derasSkott: "{mot} skjuter! Kan målvakten rädda?",
  dubbel: "Finta bort försvararen – sedan skottet!",
  halvtid: "Halvtid! Ta en kort paus.",
  slut: "Slutsignal!",
};

/** Kommentatorn efter läget (§3.5). */
export const KOMMENTAR = {
  passOk: ["Snyggt passat!", "Bollen går fram!", "Perfekt!", "Fin passning!"],
  passTur: ["Tur! Bollen gick fram ändå.", "Bollen studsade rätt – vi har kvar den."],
  passBruten: ["Rätt svar, men motståndaren bröt passningen.", "Rätt svar, men en försvarare hann emellan."],
  passFel: ["Fel svar – motståndaren tar bollen."],
  dribblaOk: ["Förbi! Snygg dribbling!", "Vilken fint – vi är förbi!"],
  mal: ["Rakt upp i krysset!", "Målvakten var chanslös!", "Vilket mål!", "MÅÅÅL! Bollen sitter i nätet!"],
  raddningRatt: ["Målvakten räddar med en fantastisk parad!", "En kanonräddning av målvakten!"],
  stolpe: ["I stolpen!", "I ribban! Så nära!"],
  utanforRatt: ["Precis utanför!", "Strax över ribban!"],
  skottFel: ["Fel svar – skottet blir slarvigt.", "Fel svar – skottet går utanför."],
  raddningFel: ["Fel svar – en lätt räddning för målvakten."],
  dubbelFel: ["Fel svar – försvararen hann stänga.", "Fel svar – finten gick inte, skottet blir svagt."],
  horna: ["Hörna till oss!"],
  derasPass: ["{mot} för bollen framåt.", "{mot} passar sig fram."],
  snett: ["Deras pass gick snett – vår boll!", "Vi snappar upp passningen!"],
  vunnen: ["Rätt! Vi vinner bollen!", "Snygg tackling – vår boll!"],
  vunnenTur: ["Tur – vi fick bollen ändå!"],
  stoppad: ["Vi stoppar farten, men de har kvar bollen."],
  forbi: ["De tar sig förbi.", "De kommer runt oss."],
  forbiFel: ["Fel svar – de tar sig förbi."],
  varRaddning: ["Vår målvakt räddar!", "Vilken räddning av vår målvakt!"],
  derasUtanfor: ["Puh, skottet gick utanför.", "Utanför – vår inspark."],
  derasMal: ["Mål för {mot}. Vi kör igen!", "{mot} gör mål. Upp med huvudet – vi kör igen!"],
};
