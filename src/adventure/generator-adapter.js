// ============================================================================
// Pluggportalen – äventyrsmotorn: generator-adapter.js  (issue #296 del A)
// ----------------------------------------------------------------------------
// Frågeadaptern för äventyr som körs på ett GENERATOR-område (exercise-type
// "generator", #279). Speglar exakt samma lilla API som question-adapter.js
// (askNext/remaining/reset/hasQuestions) så motorn (engine.js) är HELT oberörd –
// den vet inte om stationen ställer en flervalsfråga eller en genererad räkneuppgift.
//
// I stället för quiz/par hämtas utmaningarna från matte-generator-adaptern (#278)
// via den rena, deterministiska strömmen i rakna-core.js (createProblemSource) och
// visas med generator-utmaningsmodalen (generator-modal.js): A4-kort + kladdyta +
// svarsfält som rättas mot generatorns facit (checkAnswer), återanvänder rakna-core-
// logiken. Rätt svar → { correct:true } → motorn driver äventyret vidare och delar ut
// coins/XP via den vanliga game-shared-loopen (grind orörd). Ingen egen ekonomi här.
//
// Generatorn tar aldrig slut (oändlig ström), så remaining() är Infinity och reset()
// är en no-op – strömmen är redan deterministisk per (elev, session).
//
// BOOT-SÄKERHET: laddas bara via adventure/index.js (dynamisk import). Drar in
// matte-generator-runtimen via rakna-core.js – samma DYNAMISKA väg som räkna-läget,
// aldrig i bootgrafen (jfr #271/#290).
// ============================================================================

import { normalizeGenerator } from "../exercise-types.js";
import { sessionSeed, createProblemSource } from "../rakna-core.js";
import { openGeneratorModal } from "./generator-modal.js";

/**
 * Skapa generator-frågeadaptern för ett område.
 * @param {object} o
 * @param {object} o.generator   områdets råa area.generator (normaliseras här)
 * @param {HTMLElement} [o.host=document.body]  var utmaningsmodalen läggs
 * @param {string} [o.studentId] elev-id för det deterministiska fröet (adapterns kontrakt)
 * @param {number} [o.nonce]     session-nonce (default Date.now()) → nya tal varje ny session
 */
export function makeGeneratorAdapter({ generator, host = document.body, studentId, nonce = Date.now() } = {}) {
  const gen = normalizeGenerator(generator);
  const source = gen ? createProblemSource(gen, sessionSeed(studentId || "anon", nonce)) : null;

  return {
    hasQuestions() {
      return !!gen;
    },
    remaining() {
      return gen ? Infinity : 0; // en generator tar aldrig slut
    },
    reset() {
      // No-op: strömmen är deterministisk per (elev, session) – inget att nollställa.
    },
    /**
     * Visa nästa genererade uppgift i en modal ovanpå världen och lös svaret.
     * @param {object} [opts]
     * @param {string} [opts.title]  modalrubrik (temats stationTitle)
     * @param {string} [opts.emoji]  liten ikon i modalhuvudet (temats progressIcon)
     * @returns {Promise<{correct:boolean, kind:string, cancelled?:boolean, empty?:boolean}>}
     */
    async askNext({ title = "Räkneuppgift", emoji = "🔢" } = {}) {
      if (!source) return { correct: true, kind: "none", empty: true };
      const item = source.next();
      const res = await openGeneratorModal({ item, title, emoji, host });
      return { ...res, kind: "generator" };
    },
  };
}
