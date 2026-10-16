// ============================================================================
// Bråkresan – uppgiftsschemat (src/brakresan/schema/uppgift.js) · #706
// ----------------------------------------------------------------------------
// Spec §6 "Genereringskontrakt": en uppgift innehåller minst unikt id,
// utmanings-id, generatorversion, seed/parametrar, textmall, matematiska värden,
// representationer, tillåten svarstyp, bedömningsregel, korrekta val, hjälpsteg
// och missuppfattningstaggar. Facit hålls i betrodd miljö (§13).
//
//   {
//     schema: 1,
//     id,              "<roundId>-<index>" (servern) eller "demo-…" (demo/lärartest)
//     challengeId,     "03"
//     version,         generatorversion (utmaningens `version`)
//     index, role,     plats 0–9 i omgången och dess roll/slot (omgangsplan.js)
//     params,          generatorns parametrar – ren JSON, bygger om exakt samma uppgift
//     core,            semantisk kärna ("3/5") – dubblettkontroll inom/mellan omgångar
//     prompt,          kort instruktion (svensk text, inga facit)
//     values,          matematiska värden ({ n, d }-värden, antal …)
//     view,            representationerna till renderaren (komponent-API, docs §5) – OFFENTLIG
//     answer,          svarsytan: { type, … } (bedomning.js) – OFFENTLIG
//     help,            1–4 steg [{ step, text, view? }] – OFFENTLIG, aldrig aktuellt facit
//     misconceptions,  missuppfattningstaggar som felalternativen bygger på
//     key,             HEMLIG bedömningsregel + display (facit som text) + examples
//     feedback,        HEMLIG tills bedömd: { correct, wrong } (koppling till modellen)
//     review,          HEMLIG genomgång efter omgången
//   }
//
// publicTask(task) = det klienten får under omgången. revealTask(task) = det
// servern lägger till i omgångsdokumentet när uppgiften bedömts (§12: läraren
// ser uppgiften, första svar och facit i historiken).
// ============================================================================

import { ANSWER_TYPES } from "./bedomning.js";
import { isChallengeId } from "./katalog.js";

export const TASK_SCHEMA = 1;

/** Hjälpens fyra steg (§5 "Hjälp i fyra steg"). Alla är frivilliga, ordningen fast. */
export const HELP_STEPS = Object.freeze(["orientering", "princip", "modellering", "atergang"]);

/** Fält som klienten får se före bedömning. */
export const PUBLIC_FIELDS = Object.freeze(["schema", "id", "challengeId", "version", "index", "role", "prompt",
  "view", "answer", "help"]);

/** Fält som visas efter bedömning (omgångsdokumentet, lärarhistoriken). */
export const REVEAL_FIELDS = Object.freeze(["display", "feedback", "review"]);

/** Uppgiften utan facit: det enda klienten får före "Kontrollera". */
export function publicTask(task) {
  const out = {};
  for (const k of PUBLIC_FIELDS) if (task[k] !== undefined) out[k] = task[k];
  return out;
}

/** Det som avslöjas när uppgiften är bedömd: facit som text, återkoppling, genomgång. */
export function revealTask(task) {
  return { display: task.key.display, feedback: task.feedback, review: task.review };
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Hittar arrayer direkt i arrayer – Firestore kan inte lagra dem. */
function nestedArrayPath(v, path = "") {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) return `${path}[${i}]`;
      const p = nestedArrayPath(v[i], `${path}[${i}]`);
      if (p) return p;
    }
  } else if (isPlain(v)) {
    for (const [k, x] of Object.entries(v)) {
      const p = nestedArrayPath(x, path ? `${path}.${k}` : k);
      if (p) return p;
    }
  }
  return null;
}

/** Är värdet ren JSON (inga funktioner, undefined, NaN, Infinity, klasser)? */
function jsonProblem(v, path = "uppgiften") {
  if (v === null || typeof v === "string" || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? null : `${path} är inte ett ändligt tal`;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const p = jsonProblem(v[i], `${path}[${i}]`);
      if (p) return p;
    }
    return null;
  }
  if (isPlain(v) && Object.getPrototypeOf(v) === Object.prototype) {
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined) return `${path}.${k} är undefined`;
      const p = jsonProblem(x, `${path}.${k}`);
      if (p) return p;
    }
    return null;
  }
  return `${path} är inte ren JSON`;
}

/**
 * Strukturkontroll av en byggd uppgift. Svarar en lista med problem (tom = OK).
 * Körs av kontrakt.buildTask, generatorgranskningen och servertesterna.
 */
export function validateTask(task) {
  const p = [];
  if (!isPlain(task)) return ["uppgiften är inget objekt"];
  const j = jsonProblem(task);
  if (j) p.push(j);
  const n = nestedArrayPath(task);
  if (n) p.push(`array direkt i array vid ${n} (Firestore)`);
  if (task.schema !== TASK_SCHEMA) p.push("schema saknas eller är fel");
  if (!isChallengeId(task.challengeId)) p.push("okänt challengeId");
  if (!Number.isSafeInteger(task.version) || task.version < 1) p.push("version måste vara ett heltal ≥ 1");
  if (!isPlain(task.params)) p.push("params måste vara ett objekt");
  if (typeof task.core !== "string" || !task.core || task.core.length > 160) p.push("core måste vara en kort sträng");
  if (typeof task.prompt !== "string" || !task.prompt.trim() || task.prompt.length > 400) p.push("prompt saknas eller är för lång");
  if (!isPlain(task.values)) p.push("values måste vara ett objekt");
  if (!isPlain(task.view) || typeof task.view.component !== "string") p.push("view.component saknas");
  if (!isPlain(task.answer) || !ANSWER_TYPES.includes(task.answer.type)) p.push("answer.type är okänd");
  if (!isPlain(task.key) || task.key.type !== task.answer?.type) p.push("key.type måste vara samma som answer.type");
  if (typeof task.key?.display !== "string" || !task.key.display) p.push("key.display (facit som text) saknas");
  const ex = task.key?.examples;
  if (!isPlain(ex) || !Array.isArray(ex.right) || !ex.right.length || !Array.isArray(ex.wrong) || !ex.wrong.length) {
    p.push("key.examples behöver minst ett rätt och ett fel exempelsvar");
  }
  if (!Array.isArray(task.help) || task.help.length < 1 || task.help.length > 4) p.push("help ska ha 1–4 steg");
  else {
    let last = -1;
    for (const h of task.help) {
      const i = HELP_STEPS.indexOf(h?.step);
      if (i < 0 || typeof h.text !== "string" || !h.text.trim()) p.push("hjälpsteg saknar step eller text");
      else if (i <= last) p.push("hjälpstegen ska stå i ordningen orientering → princip → modellering → atergang");
      else last = i;
    }
  }
  if (!Array.isArray(task.misconceptions) || task.misconceptions.some((m) => typeof m !== "string")) {
    p.push("misconceptions ska vara en lista med taggar");
  }
  if (!isPlain(task.feedback) || typeof task.feedback.correct !== "string" || typeof task.feedback.wrong !== "string") {
    p.push("feedback.correct och feedback.wrong krävs");
  }
  if (typeof task.review !== "string" || !task.review.trim()) p.push("review (genomgång) saknas");
  // §5: hjälpen får inte ange aktuellt facit – grov kontroll av facittexten i
  // hjälpstegen. (Prompten får nämna målet: "Måla 3/5" är uppgiften, inte facit.)
  // En utmaning där facittexten oundvikligen förekommer sätter key.leakCheck = false.
  if (typeof task.key?.display === "string" && task.key.leakCheck !== false && Array.isArray(task.help)) {
    const d = task.key.display;
    const re = new RegExp(`(^|[^0-9/,])${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^0-9/,])`);
    if (task.help.some((h) => typeof h?.text === "string" && re.test(h.text))) p.push("facit (key.display) syns i hjälpen");
  }
  return p;
}
