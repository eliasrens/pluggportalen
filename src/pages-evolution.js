// ============================================================================
// Pluggportalen – Utveckling (#/elev/utveckling)
// ----------------------------------------------------------------------------
// Elevens evolutionssida (Pokémon-stil): visar figurens NIVÅ, en XP-mätare mot
// nästa nivå, nuvarande steg + vid vilken nivå nästa utveckling sker och – när
// sista steget är nått – valet mellan grenvarianterna. Grenvalet sparas via
// data.setEvolutionChoice och syns sedan överallt (topbar, hem, profil...).
// Logiken (nivåtrösklar, härlett steg) ligger i evolution.js, XP/nivåkurvan i
// leveling.js, konsten i art-characters-robot.js.
// ============================================================================

import * as data from "./data.js";
import { avatarMarkup, avatarName, characterSvg, DEFAULT_AVATAR } from "./avatars.js";
import { STAGE_LEVELS, evoFromStudentData, nextEvolution, evolutionFor } from "./evolution.js";
import { app, el, go, loading, renderTopbar, flash } from "./ui.js";

/** Stegraden: en prick per steg med nivåtröskeln under. */
function stageTimeline(stage) {
  const dots = STAGE_LEVELS.map((atLevel, i) => {
    const n = i + 1;
    const cls = n < stage ? "klar" : n === stage ? "nu" : "";
    return `<div class="evo-steg ${cls}">
      <span class="evo-steg-prick">${n <= stage ? "★" : n}</span>
      <span class="evo-steg-text">Steg ${n}</span>
      <span class="evo-steg-krav">${atLevel <= 1 ? "start" : `nivå ${atLevel}`}</span>
    </div>`;
  });
  return `<div class="evo-stegrad">${dots.join('<span class="evo-pil">→</span>')}</div>`;
}

/** XP-mätare mot nästa nivå + text om hur mycket XP som är kvar. */
function xpMeter(evo) {
  const pct = Math.round(Math.min(1, Math.max(0, evo.progressRatio)) * 100);
  const left = Math.max(0, evo.neededForNext - evo.intoLevel);
  return `<div class="evo-niva-rad">
      <span class="evo-niva-badge">⭐ Nivå ${evo.level}</span>
      <span class="evo-niva-xp">${evo.intoLevel} / ${evo.neededForNext} XP</span>
    </div>
    <div class="evo-xp-bar"><div class="evo-xp-fyll" style="width:${pct}%"></div></div>
    <p class="hint center">Bara <b>${left} XP</b> kvar till nivå ${evo.level + 1}! 🚀</p>`;
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
  const nextEvo = nextEvolution(evo.level); // nästa evolutionssteg (eller null)
  const maxStage = def?.maxStage || 1;
  const atFinal = def && evo.stage >= maxStage;

  // Peppande statusrad under figuren – berättar vid vilken NIVÅ nästa steg sker.
  let statusHtml;
  if (!def) {
    statusHtml = `<p class="hint">${avatarName(avatarId)} kan inte utvecklas ännu – fler figurer får
      utvecklingar snart! Roboten kan redan – byt figur i profilen om du vill testa. 🤖</p>`;
  } else if (nextEvo && nextEvo.stage <= maxStage) {
    statusHtml = `<p class="evo-status">Nästa utveckling (steg ${nextEvo.stage}) sker vid
      <b>nivå ${nextEvo.atLevel}</b> – bara <b>${nextEvo.levelsLeft} nivåer</b> kvar! Kör en övning till! 🚀</p>`;
  } else if (atFinal && !evo.branch) {
    statusHtml = `<p class="evo-status">WOW – du har nått sista steget på <b>nivå ${evo.level}</b>!
      Välj hur din figur ska utvecklas här nedanför. 🎉</p>`;
  } else {
    statusHtml = `<p class="evo-status">Din figur är färdigutvecklad (<b>nivå ${evo.level}</b>) –
      superjobbat! Du fortsätter levla uppåt och kan byta gren när du vill. 🏆</p>`;
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
      ${xpMeter(evo)}
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
