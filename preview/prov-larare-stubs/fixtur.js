// Preview-fixtur (#739): tre prov – ett eget med alla frågetyper, en kollegas
// och ett gammalt utan ägare (= admins). Går genom validateProv som i appen.
import { validateProv } from "../../src/prov/prov-validera.js";

const DAG = 86400000;
const nu = Date.now();
const prov = (id, rå, agare, dagar) => ({
  ...validateProv(rå).value, id, ...agare, skapad: nu - (dagar + 3) * DAG, uppdaterad: nu - dagar * DAG,
});

export const FIXTUR = [
  prov("vikingar", {
    namn: "Vikingatiden – prov", amne: "Historia", arskurs: "ak4",
    installningar: { poang: true, tidsgransMin: 40 },
    fragor: [
      { typ: "text", titel: "Handelsstaden Birka", brodtext: "Birka låg på ön Björkö i Mälaren. Hit kom köpmän från många länder för att byta pälsar, silver och pärlor.\n\nStaden övergavs omkring år 975." },
      { typ: "flerval", fraga: "Var låg handelsstaden Birka?", alternativ: ["På Björkö i Mälaren", "På Gotland", "I Skåne", "Vid Göta älv"], ratt: 0 },
      { typ: "flerval-flera", fraga: "Vilka varor handlade vikingarna med?", alternativ: ["Pälsar", "Silver", "Potatis", "Kaffe"], ratt: [0, 1], poang: 2 },
      { typ: "santfalskt", fraga: "Vikingarna hade horn på sina hjälmar.", ratt: false },
      { typ: "kortsvar", fraga: "Vad hette vikingarnas snabba skepp?", godkanda: ["långskepp", "långskeppet"], exaktStavning: false, hjalptext: "Svara med ett ord." },
      { typ: "lucktext", fraga: "Fyll i luckorna.", lucktext: "Vikingatiden varade ungefär från år [[800]] till år [[1050]].", poang: 2 },
      { typ: "para", fraga: "Para ihop guden med det guden styrde över.", par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }], poang: 3 },
      { typ: "ordna", fraga: "Sätt tidsperioderna i ordning, äldst först.", saker: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], poang: 2 },
      { typ: "fritext", fraga: "Beskriv hur en vikingagård kunde se ut.", bedomningsstod: "Långhuset, djuren och arbetet på gården.", poang: 4 },
    ],
  }, { createdBy: "anna", createdByName: "Årskurs 4 (Anna)" }, 1),
  prov("brak", {
    namn: "Bråk – diagnos", amne: "Matematik", arskurs: "ak5",
    fragor: [
      { typ: "kortsvar", fraga: "Skriv 0,5 som ett bråk i enklaste form.", godkanda: ["1/2"] },
      { typ: "flerval", fraga: "Vilket bråk är störst?", alternativ: ["2/3", "3/5", "1/2"], ratt: 0 },
    ],
  }, { createdBy: "bo", createdByName: "Årskurs 5 (Bo)" }, 4),
  prov("gammalt", {
    namn: "Gamla provet om Norden", amne: "Geografi",
    installningar: { poang: false },
    fragor: [{ typ: "santfalskt", fraga: "Norge har kust mot Atlanten.", ratt: true }],
  }, {}, 40),
];
