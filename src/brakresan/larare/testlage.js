// ============================================================================
// Bråkresan – lärarens testläge (src/brakresan/larare/testlage.js) · K #716
// ----------------------------------------------------------------------------
// Spec §12 "Lärarfunktioner": förhandsgranska och testspela alla 50 i ett
// TYDLIGT AVSKILT demonstrationsläge. Allt körs i klienten (demo.js: samma
// generator, omgångsplan och bedömning som servern) – inga anrop, inga
// skrivningar. Elevernas resultat, mynt, stjärnor, draknivåer och jaktdagar
// kan därför inte ändras; servern nekar dessutom lärarkonton i alla
// brakresa*-callables (functions/index.js, test/functions-brakresan*.mjs).
//
//   #/larare/brakresan                         alla 50, i ämnesgrupper
//   #/larare/brakresan?u=NN[&seed=…]           granska: tio uppgifter med facit och hjälp
//   #/larare/brakresan?u=NN&vy=spela[&seed=…]  spela som en elev (demoBackend)
// "Ny variant" byter seed – samma seed ger alltid samma tio uppgifter.
// Registreras i TEACHER_TABS (teacher-shared.js) med lazyPage (#271).
// ============================================================================

import { el, esc, icon, isTeacher, renderGate, teacherHead, teacherNav } from "../../teacher-shared.js";
import { getParams } from "../../ui.js";
import { CHALLENGES, SECTIONS, challengeMeta, extraLabel, isChallengeId } from "../schema/katalog.js";
import { loadChallenge } from "../utmaningar/index.js";
import { laddaLarareCss } from "./vy-delat.js";

const HASH = "#/larare/brakresan";
const STEG = { orientering: "Orientering", princip: "Princip", modellering: "Modellering", atergang: "Nu provar du själv" };
const nySeed = () => `larare-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
const rensaSeed = (s) => (typeof s === "string" ? s.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "");
const lank = (u, { vy = null, seed = null } = {}) =>
  `${HASH}?u=${u}${vy ? `&vy=${vy}` : ""}${seed ? `&seed=${encodeURIComponent(seed)}` : ""}`;

const BANNER = `<p class="brl-testbanner" role="note">${icon("eye", 16)}
  <span><b>Testläge.</b> Inget sparas: elevernas resultat, mynt, stjärnor, draknivåer och jaktdagar ändras aldrig.</span></p>`;

async function listaHtml() {
  const byggda = new Map(await Promise.all(CHALLENGES.map(async (c) => [c.id, !!(await loadChallenge(c.id).catch(() => null))?.implemented])));
  return SECTIONS.map((s) => `<section class="brl-test-grupp"><h3>${esc(s.name)} <span class="brl-svag">åk ${esc(s.grade)}</span></h3>
    <ul class="brl-test-lista">${CHALLENGES.filter((c) => c.section === s.id).map((c) => {
      const extra = extraLabel(c);
      const klar = byggda.get(c.id);
      return `<li class="brl-test-rad"><span class="brl-utm-nr">${c.id}</span>
        <span class="brl-test-namn"><b>${esc(c.name)}</b>${extra ? ` <span class="brl-tag">${esc(extra)}</span>` : ""}<br><span class="brl-svag">${esc(c.goal)}</span></span>
        ${klar ? `<a class="btn small" href="${lank(c.id)}">Granska</a><a class="btn small ghost" href="${lank(c.id, { vy: "spela" })}">Spela</a>`
          : `<span class="brl-svag">Byggs</span>`}</li>`;
    }).join("")}</ul></section>`).join("");
}

/** Granska: tio uppgifter ur EN planerad omgång, med kontroll, hjälp och facit. */
async function granska(yta, id, seed) {
  const [{ demoRound, gradeDemo, publicTask }, { monteraUppgift, promptNod }, { createHjalp }, { ensureOmgangCss }] = await Promise.all([
    import("../demo.js"), import("../omgang-uppgift.js"), import("../komponenter/index.js"), import("../omgang.js"),
  ]);
  await ensureOmgangCss();
  const { challenge, tasks } = await demoRound(id, seed);
  yta.replaceChildren();
  for (const task of tasks) {
    const pub = publicTask(task);
    const kort = el(`<section class="brl-test-uppg" data-index="${task.index}">
      <h4>Uppgift ${task.index + 1} av 10 <span class="brl-svag">· ${esc(task.role)} · kärna ${esc(String(task.core))}</span></h4></section>`);
    const modell = el(`<div class="brl-test-modell"></div>`);
    const knappar = el(`<div class="brl-test-knappar">
      <button type="button" class="br-knapp brl-kontroll">Kontrollera</button>
      <button type="button" class="br-knapp br-knapp--hjalp brl-hjalp">Visa hjälp</button></div>`);
    const utfall = el(`<p class="brl-test-utfall" role="status" aria-live="polite"></p>`);
    const facit = el(`<div class="brl-facit"><p><b>Facit:</b> </p>
      <p class="brl-svag"><b>Hjälpsteg:</b> ${task.help.map((h) => esc(STEG[h.step] || h.step)).join(" → ")}</p></div>`);
    facit.firstElementChild.append(promptNod(task.key.display, "span", ""));
    if (task.review) facit.append(promptNod(`Genomgång: ${typeof task.review === "string" ? task.review : task.review.text || ""}`, "p", "brl-svag"));
    const hjalpYta = el(`<div class="brl-test-hjalp"></div>`);
    kort.append(promptNod(pub.prompt), modell, knappar, utfall, facit, hjalpYta);
    yta.append(kort);
    const t = await monteraUppgift(modell, pub, { size: "stor" });
    const hjalpKnapp = knappar.querySelector(".brl-hjalp");
    const hjalp = await createHjalp(hjalpYta, pub.help, { model: t, returnFocus: hjalpKnapp });
    hjalpKnapp.addEventListener("click", () => (hjalp.isOpen() ? hjalp.next() : hjalp.open()));
    const skicka = () => {
      const v = t.validate?.();
      if (v && v.ok === false) return void (utfall.textContent = v.message);
      const r = gradeDemo(challenge, task, t.getAnswer());
      if (r.status === "invalid") return void (utfall.textContent = r.message);
      t.showResult(r);
      utfall.textContent = `${r.correct ? "✓ " : "↻ "}${r.correct ? r.reveal.feedback.correct : r.reveal.feedback.wrong}${r.message ? ` (${r.message})` : ""}`;
    };
    knappar.querySelector(".brl-kontroll").addEventListener("click", skicka);
    t.onSubmit?.(skicka);
  }
}

export async function pageLarareBrakresan(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  const p = getParams();
  const id = isChallengeId(p.u) ? p.u : null;
  const seed = rensaSeed(p.seed) || (id ? `larare-${id}` : "");
  const vy = p.vy === "spela" ? "spela" : "granska";
  await laddaLarareCss();
  const sida = el(`<div class="teacher-page teacher-dark brl-testsida"></div>`);
  sida.append(teacherNav(ctx, "brakresan"), teacherHead(ctx, "brakresan"), el(BANNER));
  ctx.app.replaceChildren(sida);

  if (!id) {
    const panel = el(`<div class="panel"><p class="brl-svag">Välj en utmaning. <b>Granska</b> visar tio uppgifter med facit och hjälp;
      <b>Spela</b> kör omgången som en elev ser den.</p><div class="spinner">Laddar utmaningarna…</div></div>`);
    sida.append(panel);
    panel.querySelector(".spinner").outerHTML = await listaHtml();
    return;
  }
  const meta = challengeMeta(id);
  const panel = el(`<div class="panel brl-test-panel">
    <div class="brl-test-huvud">
      <a class="btn small ghost" href="${HASH}">← Alla utmaningar</a>
      <h3><span class="brl-utm-nr">${id}</span> ${esc(meta.name)}</h3>
      <nav class="brl-delar" aria-label="Läge">
        <a class="brl-del${vy === "granska" ? " active" : ""}" href="${lank(id, { seed })}"${vy === "granska" ? ' aria-current="page"' : ""}>Granska med facit</a>
        <a class="brl-del${vy === "spela" ? " active" : ""}" href="${lank(id, { vy: "spela", seed })}"${vy === "spela" ? ' aria-current="page"' : ""}>Spela som elev</a>
      </nav>
      <form class="brl-seed"><label for="brl-seed">Variant</label>
        <input id="brl-seed" class="input" value="${esc(seed)}" maxlength="40" spellcheck="false">
        <button type="submit" class="btn small ghost">Visa</button>
        <button type="button" class="btn small brl-ny">Ny variant</button></form>
    </div>
    <p class="brl-svag">${esc(meta.goal)} Samma variant ger alltid samma tio uppgifter.</p>
    <div class="brl-ljus"><div class="spinner">Bygger uppgifterna…</div></div>
  </div>`);
  sida.append(panel);
  const gaTill = (s) => ctx.go(lank(id, { vy: vy === "spela" ? "spela" : null, seed: s }));
  panel.querySelector(".brl-seed").addEventListener("submit", (e) => {
    e.preventDefault();
    gaTill(rensaSeed(panel.querySelector("#brl-seed").value) || nySeed());
  });
  panel.querySelector(".brl-ny").addEventListener("click", () => gaTill(nySeed()));
  const yta = panel.querySelector(".brl-ljus");
  try {
    if (vy === "granska") return await granska(yta, id, seed);
    const [{ demoBackend }, { createUtmaningsvy }] = await Promise.all([import("../omgang-backend.js"), import("../omgang.js")]);
    await createUtmaningsvy(yta, {
      challengeId: id, backend: demoBackend(id, { seed }),
      onBack: () => ctx.go(HASH),
      onOpen: (nytt) => ctx.go(lank(nytt, { vy: "spela" })),
      onReward: () => {},
    });
  } catch (err) {
    yta.replaceChildren(el(`<div class="msg error">Kunde inte visa utmaningen: ${esc(err.message)}</div>`));
  }
}
