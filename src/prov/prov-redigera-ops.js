// ============================================================================
// Prov (#739, spec §8.1): redigerarens logik – DOM-fri och testad
// (test/prov-redigera.test.js), samma mönster som teacher-area-items-ops.js.
// Alla funktioner returnerar NYA objekt; inget ändras på plats.
//
//   nyttProv() / provFranDok(dok)        redigerarens arbetskopia { namn, …, fragor }
//   tomFraga(typ, fragor)                 en ny fråga med nästa lediga id
//   fragaFranFalt(typ, falt, id)          formulärets fält → en rå fråga
//   sparaFraga(prov, index, typ, falt)    → { ok, errors, warnings, prov } (index null = ny sist)
//   flyttaFraga / taBortFraga / dupliceraFraga(prov, index[, steg])
//   tillDokument(prov, existing, role)    → { ok, errors, warnings, value } redo för setDoc
//   kopieraProv(dok)                      "Kopiera": nytt utkast, "(kopia)", ingen ägare
//   tolkaAiJson(text)                     §8.2: JSON (med eller utan ```) → validateProv
//   laggTillFragor(prov, nya)             AI-frågor sist i ett befintligt prov (nya id vid krock)
//   fragaRubrik(f)                        kortets sammanfattning ("3 alternativ · 2 p")
//
// Ägarskapet följer områdena (#680): withOwner (teacher-role-core.js); listan i
// "Mina prov" (canEditArea, delaProvlista) bor i prov-lista-ops.js.
// ============================================================================

import { withOwner } from "../teacher-role-core.js";
import { fragetyp } from "./prov-fragetyper.js";
import { STANDARD_INSTALLNINGAR, validateProv } from "./prov-validera.js";
import { GRANS } from "./typer/delat.js";
import { tolkaLucktext } from "./typer/lucktext.js";

const str = (v) => (v == null ? "" : String(v));
const rader = (v) => (Array.isArray(v) ? v : str(v).split(/\r?\n/)).map((x) => str(x).trim());
const kopia = (v) => structuredClone(v);

/** Ett tomt prov att börja redigera. */
export function nyttProv() {
  return {
    namn: "", amne: "", arskurs: null, beskrivning: "",
    installningar: kopia({ ...STANDARD_INSTALLNINGAR, granser: { ...STANDARD_INSTALLNINGAR.granser } }),
    fragor: [],
  };
}

// Firestore lämnar mapens nycklar i bokstavsordning ({ gron, gul }) men fältet
// skriver { gul, gron } – samma ordning, annars ser ett oförändrat prov ändrat ut (bild).
const ordnaGranser = (ins) => (ins.granser ? { ...ins, granser: { gul: ins.granser.gul, gron: ins.granser.gron } } : ins);

/** Redigerarens arbetskopia av ett sparat prov (bara innehållet – ägarfälten stannar i dokumentet). */
export function provFranDok(dok) {
  const bas = nyttProv();
  return {
    namn: str(dok?.namn), amne: str(dok?.amne), arskurs: dok?.arskurs || null, beskrivning: str(dok?.beskrivning),
    installningar: ordnaGranser({ ...bas.installningar, ...kopia(dok?.installningar || {}) }),
    fragor: kopia(Array.isArray(dok?.fragor) ? dok.fragor : []),
  };
}

/** Nästa lediga id "f<n>" bland frågorna. */
export function nyttId(fragor, upptagna = []) {
  const tagna = new Set([...(fragor || []).map((f) => f?.id), ...upptagna]);
  let n = 1;
  while (tagna.has(`f${n}`)) n++;
  return `f${n}`;
}

// Startvärdena i formuläret per typ – tomma men i rätt form.
const TOMMA = {
  flerval: () => ({ alternativ: ["", "", "", ""], ratt: 0 }),
  "flerval-flera": () => ({ alternativ: ["", "", "", ""], ratt: [] }),
  santfalskt: () => ({ ratt: true }),
  kortsvar: () => ({ godkanda: [], exaktStavning: true, skiftlage: false }),
  lucktext: () => ({ lucktext: "", exaktStavning: true, skiftlage: false }),
  para: () => ({ par: [{ vanster: "", hoger: "" }, { vanster: "", hoger: "" }, { vanster: "", hoger: "" }] }),
  ordna: () => ({ saker: ["", "", ""] }),
  fritext: () => ({ bedomningsstod: "" }),
  text: () => ({ titel: "", brodtext: "" }),
};

/** En ny, tom fråga av typen (fylls i av typens formulär). */
export function tomFraga(typ, fragor = []) {
  const t = fragetyp(typ);
  if (!t) throw new Error(`Okänd frågetyp: ${typ}`);
  const bas = t.arFraga === false ? {} : { fraga: "", poang: 1, hjalptext: "" };
  return { id: nyttId(fragor), typ, ...bas, ...(TOMMA[typ]?.() || {}) };
}

/** Tomma rader bort; rätt-markeringen (rad-index) följer med till rätt plats. */
function utanTommaRader(alt) {
  const ut = [];
  const karta = new Map();
  rader(alt).forEach((a, i) => {
    if (!a) return;
    karta.set(i, ut.length);
    ut.push(a);
  });
  const mappa = (i) => karta.get(Number(i));
  return { alternativ: ut, mappa };
}

const bool = (v, standard) => (v === undefined || v === null || v === "" ? standard : v === true || v === "true" || v === "on");

/**
 * Formulärets fält → en rå fråga som typens validera förstår. Fälten kommer
 * som strängar/listor ur DOM:en: alternativ/saker = rader (tomma tas bort),
 * godkanda = rader eller en text med en rad per svar, par = [{ vanster, hoger }].
 */
export function fragaFranFalt(typ, falt = {}, id) {
  const ut = { typ };
  if (id) ut.id = id;
  if (fragetyp(typ)?.arFraga !== false) {
    ut.fraga = str(falt.fraga).trim();
    ut.poang = str(falt.poang).trim() === "" ? 1 : Number(falt.poang);
    if (str(falt.hjalptext).trim()) ut.hjalptext = str(falt.hjalptext).trim();
  }
  switch (typ) {
    case "flerval": {
      const { alternativ, mappa } = utanTommaRader(falt.alternativ);
      ut.alternativ = alternativ;
      ut.ratt = mappa(falt.ratt);
      break;
    }
    case "flerval-flera": {
      const { alternativ, mappa } = utanTommaRader(falt.alternativ);
      ut.alternativ = alternativ;
      ut.ratt = (Array.isArray(falt.ratt) ? falt.ratt : []).map(mappa).filter((i) => i !== undefined);
      break;
    }
    case "santfalskt":
      ut.ratt = falt.ratt === true || falt.ratt === "true" || falt.ratt === "sant" ? true
        : falt.ratt === false || falt.ratt === "false" || falt.ratt === "falskt" ? false : undefined;
      break;
    case "kortsvar":
      ut.godkanda = rader(falt.godkanda).filter(Boolean);
      ut.exaktStavning = bool(falt.exaktStavning, true);
      ut.skiftlage = bool(falt.skiftlage, false);
      break;
    case "lucktext":
      ut.lucktext = str(falt.lucktext).trim();
      ut.exaktStavning = bool(falt.exaktStavning, true);
      ut.skiftlage = bool(falt.skiftlage, false);
      break;
    case "para":
      ut.par = (Array.isArray(falt.par) ? falt.par : [])
        .map((p) => ({ vanster: str(p?.vanster).trim(), hoger: str(p?.hoger).trim() }))
        .filter((p) => p.vanster || p.hoger);
      break;
    case "ordna":
      ut.saker = rader(falt.saker).filter(Boolean);
      break;
    case "fritext":
      if (str(falt.bedomningsstod).trim()) ut.bedomningsstod = str(falt.bedomningsstod).trim();
      break;
    case "text":
      ut.titel = str(falt.titel).trim();
      ut.brodtext = str(falt.brodtext).trim();
      break;
  }
  return ut;
}

/** Stor bokstav först i ett fel från typens validera ("minst ett …" → "Minst ett …."). */
const mening = (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? "" : "."}`;

// I formuläret klickar läraren i rätt svar – JSON-felen om "ratt" (för AI:n)
// blir begripliga där.
const RATT_I_FORMULAR = {
  flerval: "Markera vilket alternativ som är rätt (och att det inte är tomt).",
  "flerval-flera": "Kryssa minst ett rätt alternativ (som inte är tomt).",
  santfalskt: "Välj Sant eller Falskt.",
};
const formularFel = (typ, fel) => fel.map((x) => (RATT_I_FORMULAR[typ] && /^"ratt"/.test(x) ? RATT_I_FORMULAR[typ] : mening(x)));

/**
 * Spara formulärets fält i provet (formulärets onSubmit, §8.1).
 * @param {object} prov   arbetskopian
 * @param {number|null} index frågans plats, null = ny fråga sist
 * @returns {{ ok: boolean, errors: string[], warnings: string[], prov: object }}
 */
export function sparaFraga(prov, index, typ, falt) {
  const t = fragetyp(typ);
  if (!t) return { ok: false, errors: [`Okänd frågetyp "${typ}".`], warnings: [], prov };
  const fragor = [...(prov.fragor || [])];
  const id = index === null || index === undefined ? nyttId(fragor) : fragor[index]?.id || nyttId(fragor);
  const r = t.validera(fragaFranFalt(typ, falt, id));
  if (!r.ok) return { ok: false, errors: formularFel(typ, r.fel), warnings: (r.varningar || []).map(mening), prov };
  const fraga = { id, typ, ...r.value };
  if (index === null || index === undefined) fragor.push(fraga);
  else fragor[index] = fraga;
  if (fragor.length > GRANS.fragor) {
    return { ok: false, errors: [`Ett prov får ha högst ${GRANS.fragor} frågor och textblock.`], warnings: [], prov };
  }
  return { ok: true, errors: [], warnings: (r.varningar || []).map(mening), prov: { ...prov, fragor } };
}

/** Flytta frågan ett (eller flera) steg upp (−) eller ned (+). Utanför listan = oförändrat. */
export function flyttaFraga(prov, index, steg) {
  const fragor = [...prov.fragor];
  const till = index + steg;
  if (index < 0 || index >= fragor.length || till < 0 || till >= fragor.length) return prov;
  const [f] = fragor.splice(index, 1);
  fragor.splice(till, 0, f);
  return { ...prov, fragor };
}

export function taBortFraga(prov, index) {
  return { ...prov, fragor: prov.fragor.filter((_, i) => i !== index) };
}

/** Dubblett direkt efter originalet, med ett nytt id. */
export function dupliceraFraga(prov, index) {
  const f = prov.fragor[index];
  if (!f || prov.fragor.length >= GRANS.fragor) return prov;
  const fragor = [...prov.fragor];
  fragor.splice(index + 1, 0, { ...kopia(f), id: nyttId(fragor) });
  return { ...prov, fragor };
}

/**
 * Arbetskopian → dokumentet som sparas i prov/{id}: validateProv (normaliserat
 * value) + ägarfälten (withOwner: befintligt prov behåller sin ägare, ett nytt
 * stämplas med kontot). `skapad`/`uppdaterad` sätter datalagret (serverTimestamp).
 */
export function tillDokument(prov, existing, role) {
  const r = validateProv(prov);
  if (!r.ok) return r;
  const { createdBy, createdByName, ...rest } = r.value;
  return { ...r, value: withOwner(rest, existing || null, role) };
}

/** "Kopiera" (§5.1): allt innehåll, namnet "(kopia)", ingen ägare – sparas som nytt prov. */
export function kopieraProv(dok) {
  const p = provFranDok(dok);
  const namn = `${p.namn || "Prov"} (kopia)`;
  return { ...p, namn: Array.from(namn).length > 80 ? `${Array.from(p.namn).slice(0, 71).join("")}… (kopia)` : namn };
}

// --- Kortets sammanfattning -------------------------------------------------------

const poangText = (p) => `${p} p`;

/** Kortets rad under frågetexten, t.ex. "4 alternativ · rätt: B · 1 p". */
export function fragaRubrik(f) {
  const t = fragetyp(f?.typ);
  if (!t) return "Okänd frågetyp";
  const delar = [];
  switch (f.typ) {
    case "flerval":
      delar.push(`${f.alternativ?.length || 0} alternativ`, `rätt: ${str(f.alternativ?.[f.ratt]) || "?"}`);
      break;
    case "flerval-flera":
      delar.push(`${f.alternativ?.length || 0} alternativ`, `${f.ratt?.length || 0} rätta`);
      break;
    case "santfalskt":
      delar.push(`rätt: ${f.ratt ? "Sant" : "Falskt"}`);
      break;
    case "kortsvar":
      delar.push(`godkänt: ${(f.godkanda || []).join(" / ") || "?"}`);
      if (f.exaktStavning === false) delar.push("ej exakt stavning"); // vad ett stavfel ger väljs per prov (#759)
      if (f.skiftlage) delar.push("stor/liten bokstav spelar roll");
      break;
    case "lucktext":
      delar.push(`${tolkaLucktext(f.lucktext).luckor.length} luckor`);
      if (f.exaktStavning === false) delar.push("ej exakt stavning"); // vad ett stavfel ger väljs per prov (#759)
      break;
    case "para":
      delar.push(`${f.par?.length || 0} par`);
      break;
    case "ordna":
      delar.push(`${f.saker?.length || 0} saker`);
      break;
    case "fritext":
      delar.push(f.bedomningsstod ? "med bedömningsstöd" : "läraren rättar");
      break;
    case "text":
      return `${Array.from(str(f.brodtext)).length} tecken`;
  }
  delar.push(poangText(f.poang ?? 1));
  return delar.join(" · ");
}

/** Kortets huvudrad: frågetexten (eller textblockets titel/början). */
export function fragaText(f) {
  if (f?.typ === "text") return str(f.titel) || `${Array.from(str(f.brodtext)).slice(0, 80).join("")}…`;
  return str(f?.fraga) || "(ingen frågetext)";
}

// --- Klistra in från AI (§8.2) --------------------------------------------------

/** Plocka ut JSON:en ur AI:ns svar (```json-staket och text runt om tål vi). */
export function plockaJson(text) {
  const s = str(text).trim();
  const staket = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const kropp = staket ? staket[1].trim() : s;
  // Ett objekt { … } eller en ensam lista [ … ] – det som börjar först.
  const ob = kropp.indexOf("{");
  const li = kropp.indexOf("[");
  const lista = li >= 0 && (ob < 0 || li < ob);
  const start = lista ? li : ob;
  const slut = kropp.lastIndexOf(lista ? "]" : "}");
  return start >= 0 && slut > start ? kropp.slice(start, slut + 1) : kropp;
}

/**
 * AI-svaret → { ok, errors, warnings, value } via validateProv, med svenska
 * fel (samma stil som parseAndValidateArea).
 */
export function tolkaAiJson(text) {
  const s = str(text).trim();
  if (!s) return { ok: false, errors: ["Klistra in AI:ns svar först."], warnings: [], value: null };
  let obj;
  try {
    obj = JSON.parse(plockaJson(s));
  } catch (e) {
    return {
      ok: false,
      errors: [`Texten är inte giltig JSON: ${e.message}. Tips: kontrollera att alla { } och [ ] hör ihop och att det inte finns extra kommatecken.`],
      warnings: [],
      value: null,
    };
  }
  // En ensam lista med frågor räcker också (t.ex. "fler frågor" till ett befintligt prov).
  if (Array.isArray(obj)) obj = { namn: "Prov", fragor: obj };
  return validateProv(obj);
}

/**
 * Lägg AI-frågorna sist i ett befintligt prov (§8.2). Id som redan finns byts
 * till nästa lediga, så inget skrivs över.
 * @returns {{ ok: boolean, errors: string[], prov: object, antal: number }}
 */
export function laggTillFragor(prov, nya) {
  const fragor = [...(prov.fragor || [])];
  if (fragor.length + nya.length > GRANS.fragor) {
    return { ok: false, errors: [`Provet skulle få ${fragor.length + nya.length} frågor och textblock – högst ${GRANS.fragor} går.`], prov, antal: 0 };
  }
  const tagna = new Set(fragor.map((f) => f.id));
  for (const f of nya) {
    const id = tagna.has(f.id) ? nyttId(fragor, [...tagna]) : f.id;
    tagna.add(id);
    fragor.push({ ...kopia(f), id });
  }
  return { ok: true, errors: [], prov: { ...prov, fragor }, antal: nya.length };
}

/**
 * Ett helt AI-prov i ett tomt utkast: namnet och uppgifterna följer med bara
 * där utkastet saknar dem (lärarens ifyllda namn skrivs inte över).
 */
export function fyllFranAi(prov, value) {
  const r = laggTillFragor(prov, value.fragor);
  if (!r.ok) return r;
  const ut = { ...r.prov };
  for (const k of ["namn", "amne", "beskrivning"]) if (!str(ut[k]).trim() && value[k]) ut[k] = value[k];
  if (!ut.arskurs && value.arskurs) ut.arskurs = value.arskurs;
  return { ...r, prov: ut };
}

/** Jämförbar ögonblicksbild (osparat-läge). */
export const bild = (prov) => JSON.stringify(prov);
