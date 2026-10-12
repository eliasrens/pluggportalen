// ============================================================================
// Ekvationsresan – val av nästa uppgift (src/ekvationsresan/nasta-uppgift.js) · #626
// ----------------------------------------------------------------------------
// Spec E2.4. Nivån kommer från anpassningen (anpassning.js) och ändras aldrig
// här – färdighetsmodellen (fardigheter.js) styr bara VILKA uppgifter eleven
// får på nivån, genom att skriva om nivåns andelar (generateTask `mix`):
//
//   text  Stark på rena ekvationer men svag på text → ekvation/problemlösning:
//         fler problemlösningsuppgifter (F) på nivån – inte lättare ekvationer.
//         (Nivå 1–2 saknar F; där blir det fler bild → ekvation, D.)
//   bro   Förstår vågen men har svårt med symboler (skrivsätt/förenkling):
//         fler broar mellan bild och skrivsätt – bild → ekvation (D), nästa
//         rad (C) och fler uppgifter med vågen i fokus (A i stället för B).
//   slag  Det svagaste ekvationsslaget (svagt eller ofta 💡, t.ex. x med
//         koefficient): nivåns former som tränar det väger dubbelt.
//
// En uppgift av en fokustyp får `fokus` ("text" | "bro"); misslyckas den räknas
// den inte i nivåfönstret (framsteg.skyddadFranFonstret).
// ============================================================================

import { levelConfig, FARDIGHET } from "./config.js";
import { generateTask, seededRng } from "./generator.js";
import { las, stark, svag, hjalpOfta, ekvationer, ekvationsslag, EKVATIONSSLAG } from "./fardigheter.js";

/** Vad modellen vill träna. → { text, bro, svagaSlag: [färdighet], svagast } (svagast först) */
export function fokusFor(skills) {
  const s = (key) => las(skills, key);
  const svaghet = (k) => 100 - s(k).v + s(k).h;
  const svagaSlag = EKVATIONSSLAG.filter((k) => svag(s(k)) || hjalpOfta(s(k))).sort((a, b) => svaghet(b) - svaghet(a));
  return {
    text: stark(ekvationer(skills)) && (svag(s("text")) || svag(s("problem"))),
    bro: stark(s("balans")) && (svag(s("skrivsatt")) || svag(s("forenkling"))),
    svagaSlag,
    svagast: svagaSlag[0] || null,
  };
}

const slagCache = new Map();
/** Ekvationsslagen en form tränar på nivån (ur en provuppgift, cachad). */
export function formSlag(level, formId) {
  const k = `${level}:${formId}`;
  if (!slagCache.has(k)) {
    let slag = [];
    try {
      slag = ekvationsslag(generateTask(level, { form: formId, type: "A", rng: seededRng(k) }));
    } catch {
      /* formen går inte att bygga på nivån – inga slag */
    }
    slagCache.set(k, slag);
  }
  return slagCache.get(k);
}

/** Krymp C–F så att de tillsammans är högst maxAndel – fokustyperna sist. */
function begransa(types, fokusTyper) {
  const sum = (keys) => keys.reduce((s, k) => s + types[k], 0);
  const keys = Object.keys(types);
  const fokus = keys.filter((k) => fokusTyper[k]);
  const ovriga = keys.filter((k) => !fokusTyper[k]);
  const max = FARDIGHET.maxAndel;
  if (sum(keys) <= max) return types;
  const out = { ...types };
  const fSum = sum(fokus);
  if (fSum >= max) {
    for (const k of fokus) out[k] = (types[k] * max) / fSum;
    for (const k of ovriga) out[k] = 0;
  } else {
    const f = (max - fSum) / sum(ovriga);
    for (const k of ovriga) out[k] = types[k] * f;
  }
  return out;
}

/**
 * Nivåns andelar omskrivna efter modellen.
 * @returns {{ mix: {types, typeB, forms}, fokusTyper: Object<string,"text"|"bro">, fokus }}
 */
export function blandning(level, skills) {
  const cfg = levelConfig(level);
  const fokus = fokusFor(skills);
  let types = { ...(cfg.types || {}) };
  let typeB = cfg.typeB ?? 0;
  const fokusTyper = {};
  const hojAndel = (t, andel, varfor) => {
    if (!(t in types) || fokusTyper[t]) return false;
    types[t] = Math.max(types[t], andel);
    fokusTyper[t] = varfor;
    return true;
  };
  if (fokus.text) hojAndel("F", FARDIGHET.textAndel, "text") || hojAndel("D", FARDIGHET.textAndel, "text");
  if (fokus.bro) {
    hojAndel("D", FARDIGHET.broD, "bro");
    hojAndel("C", FARDIGHET.broC, "bro");
    typeB = Math.min(typeB, FARDIGHET.broTypeB);
  }
  types = begransa(types, fokusTyper);
  let forms = cfg.forms;
  // Bara det svagaste slaget – flera samtidigt skulle ofta dubbla alla former (ingen skillnad).
  if (fokus.svagast) {
    forms = Object.fromEntries(
      Object.entries(cfg.forms).map(([id, w]) => [id, formSlag(level, id).includes(fokus.svagast) ? w * FARDIGHET.svagFormVikt : w]),
    );
  }
  return { mix: { types, typeB, forms }, fokusTyper, fokus };
}

/**
 * Nästa uppgift för eleven: progressens nivå (anpassningen) + modellens andelar.
 * @param {{level:number, skills?:object}} progress
 * @param {{rng?: () => number, previous?: object|string}} [opts]
 */
export function nastaUppgift(progress, { rng = Math.random, previous = null } = {}) {
  const b = blandning(progress.level, progress.skills || {});
  const task = generateTask(progress.level, { rng, previous, mix: b.mix });
  const fokus = b.fokusTyper[task.type];
  return fokus ? { ...task, fokus } : task;
}
