// ============================================================================
// Bråkresan – utmaningsvyn och omgångsflödet (src/brakresan/omgang.js) · #709 D
// ----------------------------------------------------------------------------
// Spec §5 (omgång, bedömning, hjälp, avslutning) och §11 "Utmaningsvy":
//
//   FÖRE    namn, "Här tränar du …", stjärnplatser + status, exempelbild,
//           "Starta 10 uppgifter" (eller "Fortsätt din omgång" + uttryckligt
//           val för en ny), "Prova ett exempel" (obelönat, andra tal), "Tillbaka"
//   UNDER   "Uppgift X av 10", instruktion, stor modell, "Kontrollera",
//           "Visa hjälp" (fyra steg + ordlista). Ofullständigt svar = hjälptext,
//           ingen låsning. Första giltiga svaret låser rätt/fel (servern).
//           Efter fel: "Försök igen" (bearbetning, ändrar aldrig poängen) och
//           "Fortsätt" – alltid ett medvetet klick. "Sparar …/Sparat",
//           "Avsluta omgången" (ingen belöning), "Tillbaka" sparar.
//   EFTER   finishRound → resultat (8–10 / 6–7 / 0–5 / repetition) +
//           genomgång av felen (omgang-resultat.js)
// Återupptagning: startRound svarar den aktiva omgången – samma tio
// uppgifter och låsta svar; vyn fortsätter på första obesvarade uppgiften.
// Hjälp före första kontroll skickas med svaret (helpBefore); hjälp efter fel
// registreras via rework (helpAfter).
//
// createUtmaningsvy(host, { challengeId, backend, onBack, onOpen, onReward }) – backend ur
// omgang-backend.js (server eller demo); onReward(fin) när servern betalat mynt
// (sidan ritar om sidomenyns saldo). Returnerar { destroy }.
// ============================================================================

import { createHjalp, createAterkoppling } from "./komponenter/index.js";
import { h, ensureCss } from "./komponenter/bas.js";
import { challengeMeta } from "./schema/katalog.js";
import { ROUND_SIZE, MAX_STARS_PER_CHALLENGE } from "./schema/regler.js";
import { monteraUppgift, promptNod } from "./omgang-uppgift.js";
import { visaResultat } from "./omgang-resultat.js";
import { sound } from "../fx.js";

let cssLaddad = null;
export function ensureOmgangCss() {
  if (cssLaddad) return cssLaddad;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./omgang.css", import.meta.url).href;
  link.dataset.brOmgangCss = "";
  cssLaddad = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return Promise.all([cssLaddad, ensureCss()]);
}

const SPARSTATUS = { vilar: "", sparar: "Sparar …", sparat: "Sparat ✓", offline: "Ingen kontakt – dina svar finns kvar", fel: "Kunde inte spara" };

const stjarnor = (n) => h("span", { class: "brv-stjarnor", role: "img", "aria-label": `${n} av 3 stjärnor` },
  Array.from({ length: MAX_STARS_PER_CHALLENGE }, (_, i) => h("span", { class: i < n ? "brv-stjarna brv-stjarna--fylld" : "brv-stjarna", "aria-hidden": "true" }, i < n ? "★" : "☆")));

export async function createUtmaningsvy(host, { challengeId, backend, onBack, onOpen, onReward }) {
  await ensureOmgangCss();
  const meta = challengeMeta(challengeId);
  const rot = h("section", { class: "brv", "aria-labelledby": "brv-titel" });
  host.replaceChildren(rot);
  const levande = new Set(); // komponenter att städa när vyn byts
  const stada = () => { for (const k of levande) k.destroy?.(); levande.clear(); };
  let sparEl = null;
  const avSpar = backend.saveStatus.subscribe((s) => { if (sparEl) sparEl.textContent = SPARSTATUS[s] ?? ""; });

  const rubrik = (extra) => h("header", { class: "brv-huvud" },
    h("button", { type: "button", class: "brv-tillbaka", onclick: () => onBack() }, "← Bråkresan"),
    h("h1", { id: "brv-titel", class: "brv-titel" }, h("span", { class: "brv-nr" }, meta.id), " ", meta.name),
    h("p", { class: "brv-meta" }, `Årskurs ${meta.grade}`, meta.extra ? h("span", { class: "brv-extra" }, meta.extra === "extra-blandade" ? "Extra utmaning – blandade kluringar" : "Extra utmaning") : null),
    backend.demo ? h("p", { class: "brv-demo", role: "note" }, "Testläge – inga svar, stjärnor eller mynt sparas.") : null,
    extra || null);

  const felruta = (err, igen) => h("div", { class: "brv-fel", role: "alert" },
    h("p", null, err?.message || "Det gick inte just nu."),
    igen ? h("button", { type: "button", class: "br-knapp", onclick: igen }, "Försök igen") : null);

  // --- FÖRE --------------------------------------------------------------------
  async function visaStart() {
    stada();
    let st;
    try {
      st = await backend.state();
    } catch (err) {
      rot.replaceChildren(rubrik(), felruta(err, visaStart));
      return;
    }
    const bild = h("div", { class: "brv-exempelbild", "aria-label": "Exempel på en uppgift" });
    const knappar = h("div", { class: "brv-knappar" });
    const fraga = h("div", { class: "brv-fraga", hidden: true });
    const kort = h("div", { class: "brv-start" },
      h("div", { class: "brv-start-text" },
        h("p", { class: "brv-mal" }, h("strong", null, "Här tränar du: "), meta.goal),
        h("div", { class: "brv-status" }, stjarnor(st.stars), h("span", null, st.status.label)),
        h("p", { class: "brv-svag" }, st.stars >= MAX_STARS_PER_CHALLENGE
          ? "Du har alla tre stjärnorna. Du kan repetera så mycket du vill."
          : "Tio uppgifter per omgång. 8 rätt eller fler ger en stjärna."),
        knappar, fraga),
      bild);
    rot.replaceChildren(rubrik(), kort);
    const knapp = (text, fn, primar = false) => h("button", { type: "button", class: `br-knapp${primar ? " br-knapp--fortsatt" : ""}`, onclick: fn }, text);
    if (st.activeRoundId) {
      knappar.append(
        knapp(`Fortsätt din omgång (${st.activeAnswered}/10 svarade)`, () => starta({}), true),
        knapp("Starta en ny omgång", () => {
          fraga.hidden = false;
          fraga.replaceChildren(
            h("p", null, "Den påbörjade omgången avslutas utan belöning. Svaren du redan gett finns kvar som träning."),
            knapp("Ja, starta en ny", () => starta({ restart: true, replaceRoundId: st.activeRoundId }), true),
            knapp("Nej, fortsätt den gamla", () => starta({})));
          fraga.querySelector("button").focus();
        }));
    } else {
      knappar.append(knapp(st.stars >= MAX_STARS_PER_CHALLENGE ? "Repetera 10 uppgifter" : "Starta 10 uppgifter", () => starta({}), true));
    }
    knappar.append(knapp("Prova ett exempel", () => visaExempel()), knapp("Tillbaka", () => onBack()));
    rot.querySelector(".br-knapp--fortsatt")?.focus({ preventScroll: true });
    // Exempelbilden: en uppgift ur en "normal"-slot, bara bild (andra tal än omgången).
    try {
      const { exampleTask, publicTask } = await import("./demo.js");
      const { task } = await exampleTask(challengeId, `bild-${challengeId}`);
      bild.append(promptNod(task.prompt, "p", "brv-exempel-prompt"));
      levande.add(await monteraUppgift(bild, publicTask(task), { interactive: false, size: "kort" }));
    } catch {
      bild.remove();
    }
  }

  async function starta(opts) {
    rot.replaceChildren(rubrik(), h("p", { class: "brv-laddar" }, "Hämtar dina uppgifter …"));
    try {
      const res = await backend.start(opts);
      await visaOmgang(res.round);
    } catch (err) {
      rot.replaceChildren(rubrik(), felruta(err, () => starta(opts)));
    }
  }

  // --- PROVA ETT EXEMPEL (obelönat, lokalt) --------------------------------------
  async function visaExempel() {
    stada();
    const { exampleTask, gradeDemo, publicTask } = await import("./demo.js");
    const { challenge, task } = await exampleTask(challengeId);
    const yta = uppgiftsYta({
      overrad: h("p", { class: "brv-exempelband", role: "note" }, "Exempel – räknas inte. Prova i lugn och ro."),
      task: publicTask(task),
      kontrollera: async (svar) => gradeDemo(challenge, task, svar),
      rework: async (svar) => gradeDemo(challenge, task, svar),
      efter: [{ label: "Prova ett till", primary: true, fn: () => visaExempel() }, { label: "Tillbaka", fn: () => visaStart() }],
    });
    rot.replaceChildren(rubrik(), yta.el);
    await yta.klar;
  }

  // --- UNDER OMGÅNGEN -----------------------------------------------------------
  async function visaOmgang(round, index = null) {
    stada();
    const i = index ?? round.answers.findIndex((a) => !a.first);
    if (i < 0) return visaAvslut(round);
    const task = round.tasks[i];
    const prick = (a, j) => h("li", {
      class: `brv-prick${j === i ? " brv-prick--nu" : ""}${a.first ? (a.first.correct ? " brv-prick--ratt" : " brv-prick--fel") : ""}`,
      "aria-label": `Uppgift ${j + 1}: ${a.first ? (a.first.correct ? "rätt" : "inte rätt") : j === i ? "nu" : "inte besvarad"}`,
    }, h("span", { "aria-hidden": "true" }, a.first ? (a.first.correct ? "✓" : "↻") : j === i ? "●" : "○"));
    const prickar = h("ol", { class: "brv-prickar", "aria-label": "Omgångens tio uppgifter" }, round.answers.map(prick));
    const titel = h("h2", { class: "brv-uppgiftnr", tabindex: "-1" }, `Uppgift ${i + 1} av ${ROUND_SIZE}`);
    sparEl = h("span", { class: "brv-spar", "aria-live": "polite" }, SPARSTATUS[backend.saveStatus.get?.() ?? "vilar"] ?? "");
    const ytan = uppgiftsYta({
      task,
      roundId: round.roundId,
      index: i,
      kontrollera: async (svar, helpBefore) => {
        const res = await backend.answer(round.roundId, i, svar, helpBefore);
        if (res.status === "graded") {
          round.answers[i] = { ...round.answers[i], first: { answer: svar, correct: res.correct, reason: res.reason, message: res.message }, reveal: res.reveal };
          round.answeredCount = res.answeredCount;
          round.correctCount = res.correctCount;
          prickar.replaceChildren(...round.answers.map(prick));
        }
        return res;
      },
      rework: (svar) => backend.rework(round.roundId, i, { answer: svar, attemptId: backend.newAttemptId() }),
      hjalpEfter: (steg) => backend.rework(round.roundId, i, { helpAfter: [steg] }).catch(() => {}),
      efter: [{ label: i === ROUND_SIZE - 1 || round.answers.every((a, j) => j === i || a.first) ? "Se resultatet" : "Fortsätt", primary: true,
        fn: () => visaOmgang(round) }],
    });
    const fot = h("footer", { class: "brv-fot" },
      sparEl,
      h("button", { type: "button", class: "br-knapp", onclick: () => onBack() }, "Tillbaka (omgången sparas)"),
      h("button", { type: "button", class: "br-knapp brv-avsluta", onclick: () => fragaAvsluta(round) }, "Avsluta omgången"));
    rot.replaceChildren(rubrik(h("div", { class: "brv-omgangrad" }, titel, prickar)), ytan.el, fot);
    await ytan.klar;
    titel.focus({ preventScroll: true });
  }

  function fragaAvsluta(round) {
    const ruta = h("div", { class: "brv-fraga", role: "alertdialog", "aria-label": "Avsluta omgången?" },
      h("p", null, "Vill du avsluta omgången? Du får ingen stjärna för den. Svaren du redan gett sparas som träning."),
      h("button", { type: "button", class: "br-knapp brv-avsluta", onclick: async () => {
        try {
          await backend.abort(round.roundId);
          visaStart();
        } catch (err) {
          ruta.replaceChildren(felruta(err));
        }
      } }, "Ja, avsluta"),
      h("button", { type: "button", class: "br-knapp br-knapp--fortsatt", onclick: () => { ruta.remove(); } }, "Nej, fortsätt"));
    rot.querySelector(".brv-fot")?.before(ruta);
    ruta.querySelector("button").focus();
  }

  async function visaAvslut(round) {
    stada();
    rot.replaceChildren(rubrik(), h("p", { class: "brv-laddar" }, "Räknar ihop omgången …"));
    let fin;
    try {
      fin = await backend.finish(round.roundId);
    } catch (err) {
      rot.replaceChildren(rubrik(), felruta(err, () => visaAvslut(round)));
      return;
    }
    if (fin.reward?.kind === "stjarna") sound.finish();
    if (fin.reward?.coins > 0 || fin.dragon?.hatched) onReward?.(fin);
    const yta = h("div", { class: "brv-slut" });
    rot.replaceChildren(rubrik(), yta);
    await visaResultat(yta, {
      fin, round, challengeId, demo: backend.demo,
      onNy: () => starta({}), onTillbaka: () => onBack(), onOppna: (id) => onOpen?.(id),
    });
  }

  /**
   * Arbetsytan för EN uppgift (omgång eller exempel): instruktion, modell,
   * Kontrollera, hjälp, återkoppling, bearbetning. Svarar { el, klar }.
   */
  function uppgiftsYta({ overrad = null, task, roundId = null, index = 0, kontrollera, rework, hjalpEfter = null, efter }) {
    const prompt = promptNod(task.prompt, "p", "brv-instruktion");
    const modellYta = h("div", { class: "brv-modell" });
    const medd = h("p", { class: "brv-inmatningshjalp", role: "status", "aria-live": "polite" });
    const kontrollKnapp = h("button", { type: "button", class: "br-knapp br-knapp--fortsatt brv-kontrollera", disabled: true }, "Kontrollera");
    const hjalpKnapp = h("button", { type: "button", class: "br-knapp br-knapp--hjalp" }, "Visa hjälp");
    const hjalpYta = h("div", { class: "brv-hjalp" });
    const svarYta = h("div", { class: "brv-svar", "aria-live": "polite" });
    const el = h("div", { class: "brv-yta" }, overrad, prompt, modellYta, medd,
      h("div", { class: "brv-knappar brv-knappar--uppgift" }, kontrollKnapp, hjalpKnapp), hjalpYta, svarYta);
    let lage = "svara"; // svara → bedomd → bearbeta
    let forstaFel = false; // hjälp efter ett fel registreras separat (helpAfter)
    let t = null;
    const helpBefore = [];
    const drafts = backend.drafts;

    const klar = (async () => {
      t = await monteraUppgift(modellYta, task, { size: "stor" });
      levande.add(t);
      const utkast = roundId ? drafts.load(roundId, index) : null;
      if (utkast) t.setAnswer(utkast);
      const uppdatera = () => {
        const a = t.getAnswer();
        kontrollKnapp.disabled = !a || lage === "bedomd";
        medd.textContent = "";
        if (roundId && lage === "svara") a ? drafts.save(roundId, index, a) : drafts.clear(roundId, index);
      };
      t.onChange(uppdatera);
      uppdatera();
      const hjalp = await createHjalp(hjalpYta, task.help || [], {
        model: t, returnFocus: hjalpKnapp,
        onStep: (steg) => {
          if (lage === "svara") { if (!helpBefore.includes(steg)) helpBefore.push(steg); }
          else if (forstaFel) hjalpEfter?.(steg);
        },
      });
      levande.add(hjalp);
      hjalpKnapp.addEventListener("click", () => (hjalp.isOpen() ? hjalp.next() : hjalp.open()));
      kontrollKnapp.addEventListener("click", () => skicka());
      t.onSubmit(() => skicka());
    })();

    /** Antal valda delar efter kontroll ("Du målade 2/5") – elevens EGET bråk. */
    const byggt = (svar) => (task.answer.type === "paint" && svar?.selected
      ? `Du målade ${svar.selected.length}/${task.answer.parts.length}.` : null);

    async function skicka() {
      if (kontrollKnapp.disabled || lage === "bedomd") return;
      const v = t.validate();
      if (v && v.ok === false) { medd.textContent = v.message || "Svaret är inte färdigt än."; return; }
      const svar = t.getAnswer();
      kontrollKnapp.disabled = true;
      kontrollKnapp.textContent = "Kontrollerar …";
      let res;
      try {
        res = lage === "bearbeta" ? await rework(svar) : await kontrollera(svar, [...helpBefore]);
      } catch (err) {
        kontrollKnapp.textContent = lage === "bearbeta" ? "Kontrollera igen" : "Kontrollera";
        kontrollKnapp.disabled = false;
        medd.textContent = err?.message || "Det gick inte just nu. Ditt svar finns kvar – försök igen.";
        return;
      }
      kontrollKnapp.textContent = lage === "bearbeta" ? "Kontrollera igen" : "Kontrollera";
      if (res.status === "invalid") {
        kontrollKnapp.disabled = false;
        medd.textContent = res.message;
        return;
      }
      const forsta = lage === "svara";
      if (forsta) forstaFel = !res.correct;
      lage = "bedomd";
      if (roundId && forsta) drafts.clear(roundId, index);
      t.setLocked(true);
      t.showResult(res);
      if (res.correct) sound.correct();
      const fb = res.reveal?.feedback || task.feedback || {};
      svarYta.replaceChildren();
      const text = forsta
        ? [res.correct ? fb.correct : fb.wrong, byggt(svar)].filter(Boolean).join(" ")
        : res.correct ? "Nu stämmer det! Bra jobbat. (Poängen för uppgiften ändras inte.)" : "Titta på hjälpen och jämför med modellen. Du kan försöka igen eller gå vidare.";
      const knappar = efter.map((e) => ({ ...e }));
      await createAterkoppling(svarYta, { correct: res.correct, feedback: text, message: res.correct ? null : res.message }, {
        onRework: res.correct ? null : () => bearbeta(),
        onContinue: knappar[0].fn,
        continueLabel: knappar[0].label,
      });
      for (const e of knappar.slice(1)) {
        svarYta.querySelector(".br-aterkoppling-knappar")?.append(h("button", { type: "button", class: "br-knapp", onclick: e.fn }, e.label));
      }
    }

    function bearbeta() {
      lage = "bearbeta";
      t.setLocked(false);
      t.showResult(null);
      svarYta.replaceChildren(h("p", { class: "brv-bearbeta" }, "Ändra och kontrollera igen. Poängen för uppgiften är redan satt – nu tränar du."),
        h("button", { type: "button", class: "br-knapp", onclick: efter[0].fn }, efter[0].label));
      kontrollKnapp.textContent = "Kontrollera igen";
      kontrollKnapp.disabled = !t.getAnswer();
      t.focus?.();
    }

    return { el, klar };
  }

  await visaStart();
  return {
    destroy() {
      stada();
      avSpar?.();
      rot.remove();
    },
  };
}
