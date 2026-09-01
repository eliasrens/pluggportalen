// ============================================================================
// Pluggportalen – Utveckling (#/elev/utveckling)
// ----------------------------------------------------------------------------
// Elevens evolutionssida (Pokémon-stil): visar figurens nuvarande steg, hur
// många stjärnor som är kvar till nästa utveckling och – när sista steget är
// nått – valet mellan grenvarianterna. Grenvalet sparas via
// data.setEvolutionChoice och syns sedan överallt (topbar, hem, profil...).
// Logiken (trösklar, härlett steg) ligger i evolution.js, konsten i
// art-characters-robot.js.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, avatarName, characterSvg, DEFAULT_AVATAR } from "./avatars.js";
import { STAGE_STARS, evoFromStudentData, nextGoal, evolutionFor } from "./evolution.js";
import { app, el, go, loading, renderTopbar, flash } from "./ui.js";

/** Stegraden: en prick per steg med stjärntröskeln under. */
function stageTimeline(stage) {
  const dots = STAGE_STARS.map((at, i) => {
    const n = i + 1;
    const cls = n < stage ? "klar" : n === stage ? "nu" : "";
    return `<div class="evo-steg ${cls}">
      <span class="evo-steg-prick">${n <= stage ? "★" : n}</span>
      <span class="evo-steg-text">Steg ${n}</span>
      <span class="evo-steg-krav">${at === 0 ? "start" : `${at} ⭐`}</span>
    </div>`;
  });
  return `<div class="evo-stegrad">${dots.join('<span class="evo-pil">→</span>')}</div>`;
}

export async function pageElevUtveckling() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  let sd;
  try {
    sd = await data.getStudentData();
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda utvecklingen: ${err.message}</div></div>`)
    );
    return;
  }

  const avatarId = sd.avatarId || DEFAULT_AVATAR;
  const evo = evoFromStudentData(sd);
  const def = evolutionFor(avatarId);
  const goal = nextGoal(evo.stars);
  const maxStage = def?.maxStage || 1;
  const atFinal = def && evo.stage >= maxStage;

  // Peppande statusrad under figuren.
  let statusHtml;
  if (!def) {
    statusHtml = `<p class="hint">${avatarName(avatarId)} kan inte utvecklas ännu – fler figurer får
      utvecklingar snart! Roboten kan redan – byt figur i profilen om du vill testa. 🤖</p>`;
  } else if (goal) {
    statusHtml = `<p class="evo-status">Du har <b>${evo.stars} ⭐</b> –
      bara <b>${goal.left} ⭐</b> kvar till nästa utveckling! Kör en övning till! 🚀</p>`;
  } else if (atFinal && !evo.branch) {
    statusHtml = `<p class="evo-status">WOW – du har nått sista steget med <b>${evo.stars} ⭐</b>!
      Välj hur din figur ska utvecklas här nedanför. 🎉</p>`;
  } else {
    statusHtml = `<p class="evo-status">Din figur är färdigutvecklad med <b>${evo.stars} ⭐</b> –
      superjobbat! Du kan byta gren när du vill. 🏆</p>`;
  }

  // Grenvalet (visas bara när sista steget är nått och figuren har grenar).
  let branchHtml = "";
  if (atFinal && def.branches) {
    const cards = Object.entries(def.branches)
      .map(
        ([bid, b]) => `<button class="evo-gren${evo.branch === bid ? " selected" : ""}" data-branch="${bid}">
          <span class="evo-gren-bild">${characterSvg(avatarId, { stage: maxStage, branch: bid })}</span>
          <span class="evo-gren-namn">${b.name}</span>
          <span class="evo-gren-desc">${b.desc}</span>
        </button>`
      )
      .join("");
    branchHtml = `<h2 class="center">Välj din utveckling! ⚡</h2>
      <p class="hint center">${evo.branch ? "Du kan ångra dig och byta när du vill." : "Vilken vill du bli? Klicka på en och spara!"}</p>
      <div class="evo-gren-grid" id="grenar">${cards}</div>
      <div class="center"><button class="btn stor gron" id="spara-gren" ${evo.branch ? "" : "disabled"}>Spara mitt val</button></div>`;
  }

  const view = el(`<div>
    <a class="back-link" id="back">← Till profilen</a>
    <div class="panel center">
      <h1>Utveckling ⚡</h1>
      <div class="hero-avatar evo-hero">${avatarMarkup(avatarId, sd.avatarItems || [], evo)}</div>
      ${stageTimeline(def ? evo.stage : 1)}
      ${statusHtml}
    </div>
    ${branchHtml ? `<div class="panel">${branchHtml}</div>` : ""}
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/profil"));

  if (branchHtml) {
    let chosen = evo.branch || null;
    const grid = view.querySelector("#grenar");
    const saveBtn = view.querySelector("#spara-gren");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".evo-gren");
      if (!card) return;
      chosen = card.dataset.branch;
      grid.querySelectorAll(".evo-gren").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      saveBtn.disabled = false;
    });
    saveBtn.addEventListener("click", async () => {
      if (!chosen) return;
      saveBtn.disabled = true;
      const old = saveBtn.textContent;
      saveBtn.textContent = "Sparar…";
      try {
        await data.setEvolutionChoice(avatarId, { stage: maxStage, branch: chosen });
        flash(`Snyggt! Du är nu en ${def.branches[chosen].name}! 🎉`);
        await renderTopbar();
        pageElevUtveckling(); // rita om sidan med det nya utseendet
      } catch (err) {
        flash(`Kunde inte spara: ${err.message}`, true);
        saveBtn.disabled = false;
        saveBtn.textContent = old;
      }
    });
  }

  app.replaceChildren(view);
}
