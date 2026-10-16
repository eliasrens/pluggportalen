// Förhandsvisningen av Bråkresans komponentbibliotek (#707).
import { createComponent, mountTask, createHjalp, createAterkoppling, createResultat } from "../../src/brakresan/komponenter/index.js";
import { gradeWith } from "../../src/brakresan/schema/bedomning.js";
import { roundReward } from "../../src/brakresan/schema/regler.js";
import { publicTask } from "../../src/brakresan/schema/uppgift.js";
import { FALL, UPPGIFT } from "./fall.js";

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...barn) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== undefined) e.setAttribute(k, v);
  }
  e.append(...barn.filter((b) => b !== null && b !== undefined));
  return e;
};
const json = (v) => JSON.stringify(v);
const levande = [];
const opts = () => ({ size: $("#storlek").value, reducedMotion: $("#stilla").checked || undefined });

async function demo(host, f) {
  const yta = el("div");
  const logg = el("pre", { class: "logg" });
  const medd = el("p", { class: "meddelande", "aria-live": "polite" });
  const knappar = el("div", { class: "knappar" });
  host.append(el("div", { class: "demo" }, el("h3", {}, f.titel, " ", el("small", {}, f.answer ? `(${f.answer.type})` : "(visning)")),
    f.prompt ? el("p", { class: "prompt" }, f.prompt) : null, yta, medd, knappar, logg));
  const k = await createComponent(yta, f.view, { ...opts(), answer: f.answer, interactive: !!f.answer || !!f.view.pieces || !!f.extra });
  levande.push(k);
  const visa = () => { logg.textContent = `getAnswer() = ${json(k.getAnswer())}`; };
  k.onChange(() => { visa(); medd.textContent = ""; k.showResult(null); });
  visa();
  const knapp = (text, fn, klass) => knappar.append(el("button", { class: klass, onclick: fn }, text));
  if (f.answer) {
    const kontrollera = () => {
      const r = gradeWith(f.answer, f.key, k.getAnswer());
      if (r.status === "invalid") { medd.textContent = r.message; return; }
      medd.textContent = r.message || "";
      k.showResult(r);
      k.setLocked(true);
      logg.textContent = `getAnswer() = ${json(k.getAnswer())}\ngradeWith → ${json(r)}`;
    };
    knapp("Kontrollera", kontrollera, "kontroll");
    k.onSubmit?.(kontrollera);
    knapp("Lås upp", () => { k.setLocked(false); k.showResult(null); });
  }
  knapp("Peka: helheten", () => k.highlight({ whole: true }));
  knapp("Peka: räkna delarna", () => k.highlight({ count: true }));
  knapp("Rensa pekning", () => k.highlight(null));
  knapp("Återställ", () => { k.reset(); k.setLocked(false); k.showResult(null); medd.textContent = ""; });
  if (f.extra?.includes("regroup")) knapp("Dela om ×2", () => { k.regroup(2); visa(); });
  if (f.extra?.includes("steg")) {
    knapp("Steg 1: lodrätt", () => k.steg("lodratt"));
    knapp("Steg 2: båda", () => k.steg("bada"));
  }
}

async function helUppgift(host) {
  const box = el("div", { class: "demo" }, el("h3", {}, "Hel uppgift: mountTask + hjälppanel + återkoppling"), el("p", { class: "prompt" }, UPPGIFT.prompt));
  const yta = el("div");
  const medd = el("p", { class: "meddelande", "aria-live": "polite" });
  const knappar = el("div", { class: "knappar" });
  const hjalpYta = el("div");
  const svarYta = el("div");
  box.append(yta, medd, knappar, hjalpYta, svarYta);
  host.append(box);
  const task = { ...publicTask({ ...UPPGIFT, schema: 1 }), view: UPPGIFT.view };
  const t = await mountTask(yta, task, opts());
  levande.push(t);
  const hjalpKnapp = el("button", { onclick: () => hjalp.open() }, "Visa hjälp");
  const hjalp = await createHjalp(hjalpYta, UPPGIFT.help, { model: t, returnFocus: hjalpKnapp, onStep: (s) => { medd.textContent = `Hjälpsteg visat: ${s}`; } });
  const kontrollera = async () => {
    const r = gradeWith(UPPGIFT.answer, UPPGIFT.key, t.getAnswer());
    if (r.status === "invalid") { medd.textContent = r.message; return; }
    medd.textContent = "";
    t.showResult(r);
    t.setLocked(true);
    svarYta.replaceChildren();
    await createAterkoppling(svarYta, { correct: r.correct, feedback: r.correct ? UPPGIFT.feedback.correct : UPPGIFT.feedback.wrong, message: r.message, display: "3/5" }, {
      onRework: () => { t.setLocked(false); t.showResult(null); svarYta.replaceChildren(); t.focus(); },
      onContinue: () => { svarYta.replaceChildren(); t.reset(); t.setLocked(false); t.showResult(null); t.focus(); },
    });
  };
  t.onSubmit(kontrollera);
  knappar.append(el("button", { class: "kontroll", onclick: kontrollera }, "Kontrollera"), hjalpKnapp);
}

async function resultat(host) {
  const rad = el("div", { class: "fall" });
  host.append(rad);
  const varianter = [
    { titel: "10 rätt, första stjärnan", correct: 10, starsBefore: 0, enc: false },
    { titel: "8 rätt, andra stjärnan", correct: 8, starsBefore: 1, enc: false },
    { titel: "7 rätt (uppmuntran)", correct: 7, starsBefore: 0, enc: false },
    { titel: "6 rätt (uppmuntran redan betald)", correct: 6, starsBefore: 1, enc: true },
    { titel: "0 rätt", correct: 0, starsBefore: 0, enc: false, suggestions: ["02. Vilket bråk visar bilden?", "03. Måla bråket"] },
    { titel: "Repetition (tre stjärnor)", correct: 9, starsBefore: 3, enc: true },
  ];
  for (const v of varianter) {
    const yta = el("div");
    rad.append(el("div", { class: "demo" }, el("h3", {}, v.titel), yta));
    const reward = roundReward({ correct: v.correct, starsBefore: v.starsBefore, encouragementPaid: v.enc });
    const results = Array.from({ length: 10 }, (_, i) => i < v.correct);
    await createResultat(yta, { correct: v.correct, reward, starsBefore: v.starsBefore, results, suggestions: v.suggestions }, {
      ...opts(), actions: [{ label: "Ny omgång", primary: true, onClick: () => {} }, { label: "Tillbaka", onClick: () => {} }],
    });
  }
}

async function ritaAllt() {
  for (const k of levande.splice(0)) k.destroy?.();
  const rot = $("#komponenter");
  rot.replaceChildren();
  const hopp = $("#hopp");
  hopp.replaceChildren();
  const sektion = (id, namn) => {
    hopp.append(el("a", { href: `#${id}` }, namn.replace(/^\d+\.\s*/, "")));
    const s = el("section", { class: "panel komp", id }, el("h2", {}, namn));
    rot.append(s);
    return s;
  };
  for (const k of FALL) {
    const s = sektion(k.id, k.namn);
    const rad = el("div", { class: "fall" });
    s.append(rad);
    for (const f of k.fall) await demo(rad, f);
  }
  const s11 = sektion("hjalp", "11. Hjälppanel (+ hel uppgift)");
  const r11 = el("div", { class: "fall" });
  s11.append(r11);
  await helUppgift(r11);
  const s12 = sektion("resultat", "12. Resultat och belöning");
  await resultat(s12);
  document.body.dataset.klar = "1";
}

$("#rita-om").addEventListener("click", ritaAllt);
ritaAllt().catch((e) => { document.body.prepend(el("pre", { class: "logg" }, String(e.stack || e))); throw e; });
