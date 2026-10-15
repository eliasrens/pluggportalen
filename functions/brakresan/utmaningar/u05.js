// ============================================================================
// 05. Hitta helheten (src/brakresan/utmaningar/u05.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 05: återskapa en helhet ur en given enhetsbråkdel. Frågan anger
// "Den här biten är 1/4 av en hel stav"; eleven kopierar/drar biten till ett
// byggområde tills en hel är byggd (komponenten bygge – inga förritade
// platser, biten alltid lika stor, så helheten avslöjas inte).
//   • 1/n med n = 2–6: stavar, rektanglar (chokladkaka) och samlingar
//     (en grupp med k föremål är 1/n av alla – k = 1–6, högst 36 föremål)
//   • rätt = n kongruenta bitar, eller för en samling rätt totalantal (n·k)
//   • felet "antal fler" (n − 1: glömmer den första biten) avvisas
// Talrymden: 5 stavar + 5 rektanglar + 30 samlingar = 40 kärnor (minVariants).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { ord, stor, tal } from "./delat-e.js";

const SLOTS = ["stav", "stav", "rektangel", "mangd", "stav", "mangd", "rektangel", "mangd", "mangd", "mangd"];
const FOREMAL = { kula: "kulor", knapp: "knappar", stjarna: "stjärnor", kloss: "klossar" };
const FORM = {
  stav: { hel: "en hel stav", bygg: "Bygg en hel stav av sådana bitar.", sak: "staven" },
  rektangel: { hel: "en hel chokladkaka", bygg: "Bygg hela chokladkakan av sådana bitar.", sak: "chokladkakan" },
};

export default defineChallenge({
  id: "05",
  version: 1,
  slots: SLOTS,
  minVariants: 36,
  minVariantsReason: "§8 05 låser 1/n med n = 2–6: 5 stavar + 5 rektanglar + 30 samlingar (n · k föremål, k = 1–6) = 40 kärnor; granskningen kräver 36 av 200 slumpexempel.",

  generate(rng, { slot, index }) {
    const n = index < 2 ? rng.int(2, 4) : rng.int(2, 6);
    if (slot === "mangd") return { form: "mangd", n, k: rng.int(1, 6), item: rng.pick(Object.keys(FOREMAL)) };
    return { form: slot, n };
  },

  core: ({ form, n, k }) => `${form}-1/${n}${form === "mangd" ? `×${k}` : ""}`,

  build({ form, n, k = 1, item = "kula" }) {
    const mangd = form === "mangd";
    const total = mangd ? n * k : n;
    const ex = n === 3 ? 5 : 3;
    const fler = FOREMAL[item];
    const prompt = mangd
      ? `Den här gruppen med ${k} ${fler} är 1/${n} av alla ${fler}. Bygg hela samlingen av sådana grupper.`
      : `Den här biten är 1/${n} av ${FORM[form].hel}. ${FORM[form].bygg}`;
    return {
      core: `${form}-1/${n}${mangd ? `×${k}` : ""}`,
      prompt: mangd && k === 1 ? `Det här föremålet är 1/${n} av alla ${fler}. Bygg hela samlingen av sådana föremål.` : prompt,
      values: { bit: { n: 1, d: n }, bitar: n, total },
      view: { component: "bygge", form, bit: `1/${n}`, ...(mangd ? { enhet: k, item } : {}), max: 8 },
      answer: { type: "number", input: "integer" },
      key: {
        type: "number", value: total, requirement: { kind: "integer" },
        display: mangd ? `${n} grupper · ${k} = ${total} ${fler}` : `${n} bitar`,
        examples: {
          right: [{ text: String(total) }],
          wrong: [{ text: String((n - 1) * k) }, { text: String((n + 1) * k) }],
        },
      },
      help: [
        { step: "orientering", text: `${mangd ? "Gruppen" : "Biten"} är 1/${n} av helheten. Helheten är inte ritad – du bygger den i byggområdet.`, highlight: { bit: true } },
        { step: "princip", text: `Nämnaren säger hur många lika stora ${mangd ? "grupper" : "bitar"} som behövs för en hel. Räkna med den första.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: om en bit är 1/${ex} behövs ${ex} sådana bitar för en hel – den första och ${ex - 1} till. ${stor(ord(ex, ex))} är en hel.`,
          view: { component: "stav", parts: ex, marked: 1, label: "Hela staven = 1" },
        },
        { step: "atergang", text: `Nu provar du själv: hur många ${ord(2, n).split(" ")[1]} behövs för en hel?`, highlight: { count: true } },
      ],
      misconceptions: ["antal-fler-i-stallet-for-totalt"],
      feedback: {
        correct: mangd
          ? `Ja! ${stor(ord(n, n))} är en hel: ${n} grupper med ${k} = ${total} ${fler}.`
          : `Ja! ${stor(ord(n, n))} är en hel: ${n} bitar – den första och ${tal(n - 1)} till.`,
        wrong: mangd
          ? `En hel är ${ord(n, n)}: ${n} grupper med ${k} = ${total} ${fler}. Räkna med den första gruppen.`
          : `En hel är ${ord(n, n)}: ${n} bitar totalt, den första och ${tal(n - 1)} till.`,
      },
      review: mangd
        ? `1/${n} av samlingen är ${k}. Hela samlingen är ${n} · ${k} = ${total} ${fler}.`
        : `En bit är 1/${n}. ${stor(FORM[form].sak)} är ${n} sådana bitar (${n}/${n} = 1) – totalt ${n}, inte ${n - 1} fler.`,
    };
  },

  reserve: [
    { slot: "stav", params: { form: "stav", n: 2 } }, { slot: "stav", params: { form: "stav", n: 3 } },
    { slot: "stav", params: { form: "stav", n: 5 } }, { slot: "rektangel", params: { form: "rektangel", n: 4 } },
    { slot: "rektangel", params: { form: "rektangel", n: 6 } }, { slot: "mangd", params: { form: "mangd", n: 3, k: 4, item: "kula" } },
    { slot: "mangd", params: { form: "mangd", n: 4, k: 2, item: "knapp" } }, { slot: "mangd", params: { form: "mangd", n: 5, k: 3, item: "stjarna" } },
    { slot: "mangd", params: { form: "mangd", n: 6, k: 2, item: "kloss" } }, { slot: "mangd", params: { form: "mangd", n: 2, k: 5, item: "kula" } },
    { slot: "mangd", params: { form: "mangd", n: 4, k: 6, item: "knapp" } },
  ],
});
