// ============================================================================
// Bråkresan – en historisk omgång för läraren (src/brakresan/larare/omgang-vy.js) · K #716
// ----------------------------------------------------------------------------
// Spec §12 "Individvy": datum, de tio uppgifterna med URSPRUNGLIG modell,
// första svar, rätt/fel, stöd före kontroll och efterföljande bearbetning.
// Modellen ritas ur omgångens sparade uppgifter (round.tasks = publicTask-
// snapshot från starten, med generatorversionen i round.version) – inte ur
// dagens generator. En förbättrad uppgiftsmall ändrar alltså aldrig en
// historisk bild. Facit/förklaring = round.answers[i].reveal (sparad vid svaret).
// Läs-endast; inget här skriver.
// ============================================================================

import { el } from "../../teacher-shared.js";
import { challengeMeta } from "../schema/katalog.js";
import { omgangRad } from "./statistik.js";
import { datumText, esc } from "./vy-delat.js";

const STEG = { orientering: "orientering", princip: "princip", modellering: "modellering", atergang: "återgång" };
const stegText = (lista) => (lista || []).map((s) => STEG[s] || s).join(", ");

function uppgiftHuvud(i, a) {
  const first = a?.first;
  const utfall = !first ? `<span class="brl-tag brl-tag--inte">Inte besvarad</span>`
    : first.correct ? `<span class="brl-tag brl-tag--ratt">✓ Rätt på första svaret</span>`
      : `<span class="brl-tag brl-tag--fel">↻ Inte rätt på första svaret</span>`;
  return `<h4>Uppgift ${i + 1} av 10 ${utfall}</h4>`;
}

/**
 * Öppna omgången ovanpå individvyn.
 * @param {object} round  brakresaRounds-dokumentet
 * @param {{ namn: string, tillbaka?: HTMLElement }} o  tillbaka = fokus när vyn stängs
 */
export async function visaOmgang(round, { namn, tillbaka = null }) {
  const [{ monteraUppgift, promptNod }, { svarText }, { ensureOmgangCss }] = await Promise.all([
    import("../omgang-uppgift.js"), import("../omgang-resultat.js"), import("../omgang.js"),
  ]);
  await ensureOmgangCss();
  const o = omgangRad(round);
  const meta = challengeMeta(round.challengeId);
  const overlay = el(`<div class="cx-modal-overlay teacher-dark brl-omgang-overlay" role="dialog" aria-modal="true"
      aria-label="${esc(`Omgång i ${meta?.name || round.challengeId} – ${namn}`)}">
    <div class="cx-modal brl-omgang">
      <button class="cx-modal-close" aria-label="Stäng omgången">✕</button>
      <div class="cx-modal-head"><div>
        <h2 class="cx-modal-name">${esc(round.challengeId)} ${esc(meta?.name || "")}</h2>
        <p class="cx-modal-sub">${esc(namn)} · ${esc(datumText(o.startedAt, { tid: true }))} · ${esc(o.statusText)} · ${esc(o.resultat)}
          ${o.beloning ? ` · ${esc(o.beloning)}` : ""}</p>
        <p class="brl-svag">Stöd före svar i ${o.stodFore} av ${o.besvarade} besvarade uppgifter · ${o.bearbetning} bearbetningsförsök efter fel.
          Bilderna ritas ur omgångens sparade uppgifter${o.version != null ? ` (generatorversion ${esc(String(o.version))})` : ""}.</p>
      </div></div>
      <ol class="cx-modal-body brl-uppgifter"></ol>
    </div>
  </div>`);
  const stang = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    tillbaka?.focus?.();
  };
  const onKey = (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    stang();
  };
  overlay.querySelector(".cx-modal-close").addEventListener("click", stang);
  overlay.addEventListener("click", (e) => e.target === overlay && stang());
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(overlay);
  overlay.querySelector(".cx-modal-close").focus();

  const lista = overlay.querySelector(".brl-uppgifter");
  const tasks = Array.isArray(round.tasks) ? round.tasks : [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const a = round.answers?.[i] || {};
    const li = el(`<li class="brl-uppg">${uppgiftHuvud(i, a)}</li>`);
    li.append(promptNod(t.prompt || ""));
    const modell = el(`<div class="brl-uppg-modell"></div>`);
    li.append(modell);
    const info = el(`<dl class="brl-uppg-info"></dl>`);
    const satt = (dt, nod) => {
      const rad = el(`<div><dt>${esc(dt)}</dt><dd></dd></div>`);
      rad.querySelector("dd").append(nod);
      info.append(rad);
    };
    if (a.first) satt("Första svar", document.createTextNode(svarText(t, a.first.answer)));
    if (a.reveal?.display) satt("Rätt svar", promptNod(a.reveal.display, "span", ""));
    satt("Stöd före kontroll", document.createTextNode(a.helpBefore?.length ? `Ja – ${stegText(a.helpBefore)}` : "Nej"));
    if (a.helpAfter?.length) satt("Stöd efter fel", document.createTextNode(stegText(a.helpAfter)));
    if (a.rework?.length) {
      satt("Bearbetning", document.createTextNode(a.rework.map((r, k) =>
        `Försök ${k + 1}: ${r.correct ? "rätt" : "inte rätt"} (${svarText(t, r.answer).replace(/^Du /, "").replace(/\.$/, "")})`).join(" · ")));
    }
    if (a.first && !a.first.correct && a.first.message) satt("Återkoppling", document.createTextNode(a.first.message));
    li.append(info);
    lista.append(li);
    try {
      const m = await monteraUppgift(modell, t, { interactive: false, size: "kort" });
      if (a.first?.answer) m.setAnswer?.(a.first.answer);
      m.setLocked?.(true);
    } catch {
      modell.replaceChildren(el(`<p class="brl-svag">Modellen kunde inte ritas.</p>`));
    }
  }
  if (!tasks.length) lista.append(el(`<li class="brl-svag">Omgången saknar sparade uppgifter.</li>`));
}
