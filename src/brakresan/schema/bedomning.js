// ============================================================================
// Bråkresan – generisk bedömning (src/brakresan/schema/bedomning.js) · #706
// ----------------------------------------------------------------------------
// Spec §5–§6. gradeAnswer(task, answer) bedömer elevens svar mot uppgiftens
// HEMLIGA bedömningsregel (task.key) och den offentliga svarsytan
// (task.answer). Svaret är antingen
//   { status: "graded",  correct, reason, message, parts? }   → låser uppgiften
//   { status: "invalid", error, message }                      → INTE ett svar
// "invalid" = ofullständig struktur/inmatningsfel (§5: "vid två val när tre
// krävs säger gränssnittet 'Välj ett kort till' och låser inte bedömningen").
// En utmaning kan ha en egen validate() (kontrakt.js); den ska svara samma form
// och gärna återanvända gradeAnswer för delarna.
// Inga arrayer direkt i arrayer (Firestore tillåter det inte) – därför
// { ids } och { a, b } nedan.
//
// Svarstyper (task.answer.type / task.key.type / elevens answer):
//   choice     { id }                 key { correct }           ett av answer.options
//   yesno      { value: bool }        key { correct }
//   relation   { value: "<"|"="|">" } key { correct }
//   select     { ids: [] }            key { groups: [{ ids }] } välj answer.count kort, valfri ordning
//   pairs      { pairs: [{a, b}…] }   key { cards: {id: värdenyckel} }  varje par samma värde
//   categories { bins: {bin: [id…]} } key { bins: {id: bin} }   alla kort sorterade
//   order      { ids: [] }            key { values: {id: {n,d}} } stigande, lika värden i valfri ordning
//   paint      { selected: [] }       key { count }             antal markerade delar, vilka som helst
//   number     { fields } | { text }  key { value, requirement } answer.input: fraction|mixed|integer|decimal|percent
//   point      { value: {n,d} }       key { value }             tallinjen, exakt snäppvärde (oreducerat går bra)
//   multi      { parts: {id: svar} }  key { parts: {id: delregel} }  alla delar rätt = rätt (en poäng)
// ============================================================================

import { toQ, eq, cmp } from "../math/rational.js";
import { PARSERS } from "../math/input.js";
import { checkForm } from "../math/requirements.js";
import { RELATIONS } from "../math/compare.js";

const invalid = (error, message) => ({ status: "invalid", error, message });
const graded = (correct, extra = {}) => ({ status: "graded", correct, reason: correct ? null : "fel-varde", message: null, ...extra });
const ids = (v) => (Array.isArray(v) ? v.map(String) : null);
const kortOrd = (n) => (n === 1 ? "ett kort" : `${n} kort`);

/** Bedöm ett svar. `task` = hela uppgiften (med key) – körs bara i betrodd miljö. */
export function gradeAnswer(task, answer) {
  const spec = task?.answer;
  const key = task?.key;
  if (!spec || !key) throw new TypeError("Bråkresan: gradeAnswer kräver uppgift med answer och key");
  return gradeWith(spec, key, answer);
}

/** Samma som gradeAnswer men med svarsyta och regel var för sig (används av multi). */
export function gradeWith(spec, key, answer) {
  if (spec.type !== key.type) throw new TypeError(`Bråkresan: svarstyp ${spec.type} ≠ regel ${key.type}`);
  const a = answer && typeof answer === "object" ? answer : {};
  switch (spec.type) {
    case "choice": {
      if (a.id === undefined || a.id === null || a.id === "") return invalid("tom", "Välj ett svar först.");
      if (!spec.options.map(String).includes(String(a.id))) return invalid("ogiltig", "Välj ett av alternativen.");
      return graded(String(a.id) === String(key.correct));
    }
    case "yesno":
      if (typeof a.value !== "boolean") return invalid("tom", "Svara ja eller nej först.");
      return graded(a.value === key.correct);
    case "relation":
      if (!RELATIONS.includes(a.value)) return invalid("tom", "Välj <, = eller > först.");
      return graded(a.value === key.correct);
    case "select": {
      const val = ids(a.ids);
      const need = spec.count;
      const set = new Set(val || []);
      if (!val || set.size !== val.length || [...set].some((id) => !spec.options.map(String).includes(id))) {
        return invalid("ogiltig", "Välj bland korten.");
      }
      if (set.size < need) return invalid("ofullstandig", `Välj ${kortOrd(need - set.size)} till.`);
      if (set.size > need) return invalid("ofullstandig", `Välj bara ${kortOrd(need)}.`);
      const ok = key.groups.some((g) => g.ids.length === set.size && g.ids.every((id) => set.has(String(id))));
      return graded(ok);
    }
    case "pairs": {
      const cards = Object.keys(key.cards);
      const ok = Array.isArray(a.pairs) && a.pairs.every((p) => p && typeof p === "object" && "a" in p && "b" in p);
      const used = ok ? a.pairs.flatMap((p) => [String(p.a), String(p.b)]) : [];
      if (!ok ||
          new Set(used).size !== used.length || used.some((id) => !cards.includes(id))) {
        return invalid("ogiltig", "Para ihop korten två och två.");
      }
      if (used.length < cards.length) return invalid("ofullstandig", "Para ihop alla kort först.");
      return graded(a.pairs.every((p) => key.cards[p.a] === key.cards[p.b]));
    }
    case "categories": {
      const bins = a.bins && typeof a.bins === "object" ? a.bins : null;
      const placed = bins ? Object.values(bins).flat().map(String) : [];
      const cards = Object.keys(key.bins);
      if (!bins || Object.keys(bins).some((b) => !spec.bins.map(String).includes(b)) ||
          new Set(placed).size !== placed.length || placed.some((id) => !cards.includes(id))) {
        return invalid("ogiltig", "Lägg korten i facken.");
      }
      if (placed.length < cards.length) return invalid("ofullstandig", "Sortera alla kort först.");
      const ok = Object.entries(bins).every(([bin, list]) => list.every((id) => String(key.bins[id]) === bin));
      return graded(ok);
    }
    case "order": {
      const val = ids(a.ids);
      const cards = Object.keys(key.values);
      if (!val || new Set(val).size !== val.length || val.some((id) => !cards.includes(id))) {
        return invalid("ogiltig", "Ordna korten.");
      }
      if (val.length < cards.length) return invalid("ofullstandig", "Ordna alla kort först.");
      let ok = true;
      for (let i = 1; i < val.length; i++) if (cmp(toQ(key.values[val[i - 1]]), toQ(key.values[val[i]])) > 0) ok = false;
      return graded(ok);
    }
    case "paint": {
      const val = ids(a.selected);
      if (!val || new Set(val).size !== val.length || val.some((id) => !spec.parts.map(String).includes(id))) {
        return invalid("ogiltig", "Markera delar i figuren.");
      }
      if (val.length === 0) return invalid("tom", "Markera delar först.");
      return graded(val.length === key.count);
    }
    case "number": {
      const parse = PARSERS[spec.input];
      if (!parse) throw new TypeError(`Bråkresan: okänd inmatning ${spec.input}`);
      const r = spec.input === "fraction" || spec.input === "mixed" ? parse(a.fields || {}) : parse(a.text ?? a.fields?.text);
      if (!r.ok) return invalid(r.error, r.message);
      const c = checkForm(r.form, key.value, key.requirement);
      return { status: "graded", correct: c.correct, reason: c.reason, message: c.message, form: r.form };
    }
    case "point": {
      const pv = a.value;
      if (!pv || !Number.isSafeInteger(pv.n) || !Number.isSafeInteger(pv.d) || pv.d <= 0) {
        return invalid("tom", "Placera punkten på tallinjen först.");
      }
      const v = toQ(a.value);
      const onGrid = (v.n * spec.snap) % v.d === 0; // v är en multipel av 1/snap
      if (!onGrid || cmp(v, toQ(spec.min)) < 0 || cmp(v, toQ(spec.max)) > 0) {
        return invalid("ogiltig", "Placera punkten på ett av strecken.");
      }
      return graded(eq(v, key.value));
    }
    case "multi": {
      const parts = {};
      for (const [pid, subSpec] of Object.entries(spec.parts)) {
        const r = gradeWith(subSpec, key.parts[pid], a.parts?.[pid]);
        if (r.status === "invalid") return { ...r, part: pid };
        parts[pid] = r;
      }
      const wrong = Object.entries(parts).find(([, r]) => !r.correct);
      return {
        status: "graded",
        correct: !wrong,
        reason: wrong ? wrong[1].reason : null,
        message: wrong ? wrong[1].message : null,
        parts: Object.fromEntries(Object.entries(parts).map(([k, r]) => [k, r.correct])),
      };
    }
    default:
      throw new TypeError(`Bråkresan: okänd svarstyp ${spec.type}`);
  }
}

export const ANSWER_TYPES = Object.freeze(["choice", "yesno", "relation", "select", "pairs", "categories", "order",
  "paint", "number", "point", "multi"]);
