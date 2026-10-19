// ============================================================================
// Prov (#738, spec §2.3): validering av ett prov – samma beteende som
// validateArea (src/validate.js). Läraren (eller en AI-genererad JSON, §8.2)
// ska förstå exakt vad som är fel och var:
//
//   validateProv(obj) → { ok, errors: string[], warnings: string[], value }
//
// Felen bär platsen: "Fråga 4 (Kort svar): minst ett godkänt svar krävs".
// Frågorna numreras som eleven ser dem – löpande genom hela provet (textblock
// och avsnitt får inget nummer) – och textblocken och avsnitten för sig
// ("Textblock 2: …", "Avsnitt 1: …", #762). Varje frågas fält kontrolleras av
// typens validera i registret (prov-fragetyper.js).
//
// `value` är normaliserat och redo att sparas i prov/{provId} (utan
// createdBy/skapad – det sätter redigeraren, B): ids ifyllda och unika,
// standardinställningar satta, strängar trimmade. Gränser: typer/delat.js GRANS.
// ============================================================================

import { normalizeGrade } from "../grades.js";
import { FRAGETYPER, fragetyp, TYP_IDS } from "./prov-fragetyper.js";
import { GRANS, ID_RE, arText, tecken, trimmad } from "./typer/delat.js";
import { STANDARD_MYNT, valideraMynt } from "./prov-mynt.js";

export const NAMN_MAX = 80;
export const BESKRIVNING_MAX = 1000;
export const AMNE_MAX = 60;
export const TIDSGRANS_MIN = 5;
export const TIDSGRANS_MAX = 240;

/**
 * Stavfel (#759): "auto" = ett stavfel ger halva poängen som förslag (frågor
 * där "Exakt stavning krävs" är av), "sjalv" = inget förslag – läraren rättar.
 */
export const STAVFEL = Object.freeze({ AUTO: "auto", SJALV: "sjalv" });

/**
 * Standardinställningarna (§3). granser = färggränserna i procent (§7.5, #759).
 * visaPoangForElev (#762): "(4 p)" per fråga och "Provet ger högst 32 poäng"
 * för eleven. visaKriterier (#762): fritextens poängkriterier syns för eleven
 * i resultatet efter tillbakalämningen. felKortsvarFel (#764): "Fel svar på
 * kortsvar rättas som fel" när läraren trycker "Rätta alla automatiska frågor"
 * – av = svaret väntar på läraren.
 */
export const STANDARD_INSTALLNINGAR = Object.freeze({
  poang: true,
  visaPoangForElev: true,
  nivaer: false,
  visaFacit: true,
  visaKriterier: false,
  stavningskontroll: false,
  stavfel: STAVFEL.AUTO,
  felKortsvarFel: true,
  tidsgransMin: null,
  granser: Object.freeze({ gul: 60, gron: 85 }),
  mynt: STANDARD_MYNT, // #746 – prov-mynt.js
});

/** Provets stavfelsval – allt utom "sjalv" (även saknat, gamla prov) = auto. */
export const stavfelFor = (installningar) => (installningar?.stavfel === STAVFEL.SJALV ? STAVFEL.SJALV : STAVFEL.AUTO);

/** "Fel svar på kortsvar rättas som fel" (#764) – på om inte uttryckligen av (gamla prov = på). */
export const felKortsvarFelFor = (installningar) => installningar?.felKortsvarFel !== false;

/** Giltiga färggränser (#759): heltal i procent, 0 < gul < grön ≤ 100 – som firestore.rules provGranserOk. */
export function granserOk(g) {
  return !!g && Number.isInteger(g.gul) && Number.isInteger(g.gron) && g.gul > 0 && g.gul < g.gron && g.gron <= 100;
}

/**
 * Inställningarna som de kopieras till ett tillfälle (#759): standarden för
 * det som saknas, och ogiltiga gränser (ett äldre tillfälle) → standarden –
 * så att reglerna (provInstOk) godtar kopian, t.ex. ett omprov.
 */
export function tillfalleInstallningar(ins) {
  const ut = { ...STANDARD_INSTALLNINGAR, ...(ins || {}) };
  return { ...ut, stavfel: stavfelFor(ut), granser: granserOk(ut.granser) ? { gul: ut.granser.gul, gron: ut.granser.gron } : { ...STANDARD_INSTALLNINGAR.granser } };
}

/**
 * "röd under 60 %, gul 60–84 %, grön 85 % eller mer" – gränserna i klartext.
 * Kantfallen (#749): gul ett enda steg ("gul 99 %", inte "99–99 %") och grön
 * från 100 ("grön 100 %", inte "100 % eller mer").
 */
export function granserText(g) {
  const gul = g.gron - 1 > g.gul ? `${g.gul}–${g.gron - 1} %` : `${g.gul} %`;
  const gron = g.gron >= 100 ? "100 %" : `${g.gron} % eller mer`;
  return `röd under ${g.gul} %, gul ${gul}, grön ${gron}`;
}

/** Tidsgräns i minuter: null (ingen) eller heltal 5–240. undefined = ogiltig. */
export function tolkaTidsgrans(v) {
  if (v === null || v === undefined || v === "" || v === false) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= TIDSGRANS_MIN && n <= TIDSGRANS_MAX ? n : undefined;
}

function valideraInstallningar(raw, errors) {
  const ut = { ...STANDARD_INSTALLNINGAR, granser: { ...STANDARD_INSTALLNINGAR.granser }, mynt: { ...STANDARD_MYNT } };
  if (raw === undefined || raw === null) return ut;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push('Inställningar: "installningar" måste vara ett objekt { … }.');
    return ut;
  }
  for (const k of ["poang", "visaPoangForElev", "nivaer", "visaFacit", "visaKriterier", "stavningskontroll", "felKortsvarFel"]) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (typeof raw[k] !== "boolean") errors.push(`Inställningar: "${k}" måste vara true eller false.`);
    else ut[k] = raw[k];
  }
  const tid = tolkaTidsgrans(raw.tidsgransMin);
  if (tid === undefined) errors.push(`Inställningar: tidsgränsen måste vara ett helt antal minuter ${TIDSGRANS_MIN}–${TIDSGRANS_MAX} (eller ingen).`);
  else ut.tidsgransMin = tid;
  if (raw.stavfel !== undefined && raw.stavfel !== null) {
    if (!Object.values(STAVFEL).includes(raw.stavfel)) errors.push('Inställningar: "stavfel" måste vara "auto" (halva poängen) eller "sjalv" (du rättar).');
    else ut.stavfel = raw.stavfel;
  }
  if (raw.granser !== undefined && raw.granser !== null) {
    // Tal, eller sifferfältens text ("50"); allt annat (tomt, true, [60]) är fel.
    const tal = (v, std) => (v === undefined || v === null ? std : typeof v === "number" ? v
      : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
    const g = typeof raw.granser === "object" && !Array.isArray(raw.granser)
      ? { gul: tal(raw.granser.gul, ut.granser.gul), gron: tal(raw.granser.gron, ut.granser.gron) } : null;
    if (!granserOk(g)) {
      errors.push("Inställningar: färggränserna måste vara hela procent där gul (1–99) är lägre än grön (högst 100).");
    } else ut.granser = g;
  }
  const mynt = valideraMynt(raw.mynt, ut.poang);
  errors.push(...mynt.fel);
  ut.mynt = mynt.value;
  return ut;
}

/**
 * Validera och normalisera ett prov.
 * @param {*} obj redan JSON-parsat objekt
 * @returns {{ ok: boolean, errors: string[], warnings: string[], value: object|null }}
 */
export function validateProv(obj) {
  const errors = [];
  const warnings = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      ok: false,
      errors: ["JSON måste vara ett objekt med ett prov ({ \"namn\": …, \"fragor\": [ … ] }), inte en lista eller ett ensamt värde."],
      warnings,
      value: null,
    };
  }

  // --- Provets uppgifter ------------------------------------------------------
  const namn = trimmad(obj.namn);
  if (!namn) errors.push('Provet: namnet ("namn") saknas eller är tomt.');
  else if (tecken(namn) > NAMN_MAX) errors.push(`Provet: namnet är för långt (högst ${NAMN_MAX} tecken).`);
  const value = { namn };

  if (obj.beskrivning !== undefined && obj.beskrivning !== null && obj.beskrivning !== "") {
    if (typeof obj.beskrivning !== "string") errors.push('Provet: "beskrivning" måste vara en text.');
    else if (tecken(obj.beskrivning.trim()) > BESKRIVNING_MAX) errors.push(`Provet: beskrivningen är för lång (högst ${BESKRIVNING_MAX} tecken).`);
    else if (obj.beskrivning.trim()) value.beskrivning = obj.beskrivning.trim();
  }
  if (arText(obj.amne)) {
    if (tecken(obj.amne.trim()) > AMNE_MAX) errors.push(`Provet: ämnet är för långt (högst ${AMNE_MAX} tecken).`);
    else value.amne = obj.amne.trim();
  }
  const arskurs = normalizeGrade(obj.arskurs);
  if (arskurs) value.arskurs = arskurs;
  else if (obj.arskurs !== undefined && obj.arskurs !== null && obj.arskurs !== "") {
    warnings.push(`Provet: okänd årskurs "${String(obj.arskurs)}" ignoreras (giltiga: 1–9).`);
  }
  value.installningar = valideraInstallningar(obj.installningar, errors);

  // --- Frågorna -----------------------------------------------------------------
  const fragor = [];
  if (!Array.isArray(obj.fragor)) {
    errors.push('Provet: "fragor" måste vara en lista med frågor [ … ].');
  } else {
    if (obj.fragor.length > GRANS.fragor) errors.push(`Provet: högst ${GRANS.fragor} frågor, textblock och avsnitt (nu ${obj.fragor.length}).`);
    let nrFraga = 0;
    let nrText = 0;
    let nrAvsnitt = 0;
    const anvanda = new Set();
    obj.fragor.forEach((raw, i) => {
      const typ = fragetyp(raw?.typ);
      const plats = raw?.typ === "avsnitt" ? `Avsnitt ${++nrAvsnitt}`
        : typ?.arFraga === false ? `Textblock ${++nrText}` : `Fråga ${++nrFraga}`;
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push(`${plats}: måste vara ett objekt { "typ": …, "fraga": … }.`);
        return;
      }
      if (!typ) {
        errors.push(`${plats}: okänd frågetyp "${String(raw.typ ?? "")}". Giltiga: ${TYP_IDS.map((t) => `"${t}"`).join(", ")}.`);
        return;
      }
      const r = typ.validera(raw);
      const var_ = `${plats} (${typ.namn})`;
      for (const f of r.fel) errors.push(`${var_}: ${f}.`);
      for (const w of r.varningar || []) warnings.push(`${var_}: ${w}.`);
      const f = r.value;
      if (f.id !== undefined && !ID_RE.test(f.id)) {
        warnings.push(`${var_}: id "${f.id}" får bara ha a–z, 0–9, - och _ – ett nytt id sätts.`);
        delete f.id;
      } else if (f.id !== undefined && anvanda.has(f.id)) {
        warnings.push(`${var_}: id "${f.id}" finns redan – ett nytt id sätts.`);
        delete f.id;
      }
      if (f.id !== undefined) anvanda.add(f.id);
      fragor.push({ f, index: i });
    });
    // Saknade/ogiltiga id → nästa lediga "f<n>" (efter de giltiga, så att
    // inget givet id byts).
    let n = 0;
    for (const { f } of fragor) {
      if (f.id !== undefined) continue;
      do n++; while (anvanda.has(`f${n}`));
      f.id = `f${n}`;
      anvanda.add(f.id);
    }
    if (!errors.length && !fragor.some(({ f }) => fragetyp(f.typ).arFraga !== false)) {
      errors.push("Provet: minst en fråga krävs (textblock och avsnitt räknas inte).");
    }
  }
  // Fältordningen: id, typ först – lättare att läsa i Firestore-konsolen.
  value.fragor = fragor.map(({ f }) => ({ id: f.id, typ: f.typ, ...f }));

  const ok = errors.length === 0;
  return { ok, errors, warnings, value: ok ? value : null };
}

/** Typerna som "Lägg till fråga" visar (ikon, namn, beskrivning). */
export function typValjare() {
  return FRAGETYPER.map(({ id, namn, ikon, beskrivning }) => ({ id, namn, ikon, beskrivning }));
}
