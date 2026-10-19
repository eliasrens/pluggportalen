// ============================================================================
// Partiet mot datorn – vyn (#776, §3.3): brädet + panelen med Ångra, Tips,
// "Varna mig" och Ge upp. Datorn tänker i workern (schack-dator.js); varningen
// räknas i huvudtråden (schack-varning.js) och visas som en ruta på sidan med
// "Ångra" / "Flytta ändå" – aldrig confirm(). Varje drag sparas via `spara`.
//
//   const vy = skapaDatorVy(host, { parti, namn, avatarHtml, dator, spara, onNytt, onBytNiva, onTillbaka });
//   vy.destroy();
// Ingen Firebase. Pluggmynten (#798): med `o.mynt` (schack-mynt.js) visar panelen nivåns
// belöning, och en VINST (matt) skickas till servern som kontrollerar partiet och betalar
// första gången – svaret står i slutrutan och panelen (Damen: pokalen). Ångra och Tips är
// tillåtna. Testbar i node via vy.brade (kontrollens API).
// ============================================================================

import { skapaSchackbrade } from "./schack-bradet.js";
import { pjasSvg } from "./schack-pjaser.js";
import { nivaFor } from "./schack-motor.js";
import { analyseraVarning } from "./schack-varning.js";
import { svenskSan } from "./schack-text.js";
import { esc } from "./schack-bradet-delar.js";
import { monteraHelskarm } from "./schack-helskarm.js";
import { myntHtml } from "./schack-mynt.js";
import { DATOR_MYNT, SCHACK_POKALER, TEXT_MYNT, harDator, nivaBelonningText, datorVinstText } from "./schack-mynt-delat.js";

const TANK_MIN_MS = 350; // datorn "tänker" minst så här länge, så draget inte känns som ett ryck

/** Panelens myntrad (#798): nivåns belöning och att Ångra/Tips är tillåtna. */
function myntRadHtml(niva, kvitto) {
  if (kvitto === undefined || !DATOR_MYNT[niva.id]) return "";
  return myntHtml(nivaBelonningText(niva.id, kvitto)) + (harDator(kvitto, niva.id) ? "" : `<small>${esc(TEXT_MYNT.hjalpTillaten)}</small>`);
}

function panelHtml(niva, parti, tillbakaText = "‹ Till Schack", mynt = false) {
  return (
    `<div class="schack-panel-niva"><span class="schack-panel-pjas">${pjasSvg(parti.egenFarg === "w" ? "b" : "w", niva.pjas)}</span>` +
    `<span>Du spelar mot <b>${esc(niva.namn)}</b><small>${esc(niva.text)}</small></span></div>` +
    (mynt ? `<p class="schack-mynt-rad" aria-live="polite"></p>` +
      `<button type="button" class="btn ghost liten schack-mynt-igen" data-act="mynt-igen" hidden>Försök igen</button>` : "") +
    `<div class="schack-fraga schack-varna-ruta" role="alertdialog" aria-labelledby="schack-varna-text" hidden>` +
    `<p id="schack-varna-text" class="schack-fraga-text"></p>` +
    `<div class="schack-fraga-knappar"><button type="button" class="btn liten" data-act="varna-angra">Ångra</button>` +
    `<button type="button" class="btn ghost liten" data-act="varna-anda">Flytta ändå</button></div></div>` +
    `<div class="schack-fraga schack-geupp-ruta" role="alertdialog" aria-labelledby="schack-geupp-text" hidden>` +
    `<p id="schack-geupp-text" class="schack-fraga-text">Vill du ge upp partiet? Då vinner datorn.</p>` +
    `<div class="schack-fraga-knappar"><button type="button" class="btn liten" data-act="geupp-nej">Nej, spela vidare</button>` +
    `<button type="button" class="btn ghost liten" data-act="geupp-ja">Ja, ge upp</button></div></div>` +
    `<div class="schack-knappar">` +
    `<button type="button" class="btn ghost liten" data-act="angra" title="Ta tillbaka ditt senaste drag och datorns svar">Ångra</button>` +
    `<button type="button" class="btn ghost liten" data-act="tips" title="Datorn visar ett bra drag med en pil">Tips</button>` +
    `<button type="button" class="btn ghost liten" data-act="geupp">Ge upp</button></div>` +
    `<label class="schack-varna-val"><input type="checkbox" data-act="varna"${parti.varna ? " checked" : ""} /> ` +
    `<span>Varna mig <small>om datorn kan ta min dam eller ett torn, eller göra matt</small></span></label>` +
    `<p class="schack-tips-text" aria-live="polite"></p>` +
    `<button type="button" class="btn ghost liten schack-tillbaka" data-act="tillbaka">${esc(tillbakaText)}</button>`
  );
}

/**
 * @param {HTMLElement} host
 * @param {object} o
 * @param {object} o.parti          partiet (schack-parti.js) – muteras: drag, varna, slut
 * @param {string} o.namn           elevens namn
 * @param {string} [o.avatarHtml]   elevens avatar-markup
 * @param {object} o.dator          skapaDator() – valjDrag/tips/avbryt
 * @param {(parti) => void} o.spara
 * @param {Function} [o.onNytt]     "Spela igen"
 * @param {Function} [o.onBytNiva]  "Byt nivå"
 * @param {Function} [o.onTillbaka] "Till Schack"
 * @param {string} [o.tillbakaText] knappens text (guidens lektion 12: "‹ Alla lektioner")
 * @param {(slut) => void} [o.onSlut] partiet tog slut – EN gång per parti (räknaren
 *        studentData.schack.datorPartier, #780); partiet får `raknad: true`, så en
 *        omladdning eller ett Ångra + nytt slut räknas inte igen
 * @param {object} [o.mynt]       skapaMynt() (#798) – utan den inga mynt (lektion 12, förhandsvisningar)
 * @param {boolean} [o.reducedMotion]
 * @param {number} [o.tidsgransMs]  motorns tidsgräns (standard: motorns)
 * @param {number} [o.tankMinMs]    minsta "tänketid" (0 i tester)
 */
export function skapaDatorVy(host, o) {
  const { parti, dator } = o;
  const niva = nivaFor(parti.niva);
  const egenFarg = parti.egenFarg;
  const datorFarg = egenFarg === "w" ? "b" : "w";
  const tankMin = o.tankMinMs ?? TANK_MIN_MS;
  let seq = 0; // ogiltigförklarar sena svar från datorn (Ångra, destroy)
  let varnaSvar = null; // resolve-funktionen för en väntande varning
  let tipsPagar = false;
  let levande = true;

  host.classList.add("schack-parti");
  host.innerHTML = `<div class="schack-parti-brade"></div><aside class="schack-panel" aria-label="Hjälp mot datorn">${panelHtml(niva, parti, o.tillbakaText, Boolean(o.mynt))}</aside>`;
  const $ = (s) => host.querySelector(s);
  const varnaRuta = $(".schack-varna-ruta");
  const geuppRuta = $(".schack-geupp-ruta");
  const tipsText = $(".schack-tips-text");
  const knapp = (act) => $(`[data-act="${act}"]`);

  // Helskärm (#783): hela sidans rot, så att "Spela igen" inte avbryter den.
  const helskarm = monteraHelskarm(host.closest?.(".schack-rot") || host, { knappPlats: $(".schack-knappar") });

  const spara = () => {
    parti.drag = brade.getGame().drag;
    try { o.spara(parti); } catch (e) { console.warn("schack: kunde inte spara partiet", e); }
  };

  const brade = skapaSchackbrade($(".schack-parti-brade"), {
    egenFarg, motstandare: "dator", interaktiv: egenFarg, reducedMotion: o.reducedMotion,
    namn: { [egenFarg]: o.namn, [datorFarg]: niva.namn },
    avatar: { [egenFarg]: o.avatarHtml, [datorFarg]: `<span class="schack-dator-avatar">${pjasSvg(datorFarg, niva.pjas)}</span>` },
    slutKnappar: [
      ...(o.onNytt ? [{ text: "Spela igen", onClick: o.onNytt }] : []),
      ...(o.onBytNiva ? [{ text: "Byt nivå", onClick: o.onBytNiva }] : []),
    ],
    beforeMove(drag, state) {
      if (!parti.varna) return true;
      const v = analyseraVarning(state.fen, drag);
      if (!v) return true;
      $("#schack-varna-text").textContent = v.text;
      varnaRuta.hidden = false;
      host.classList.add("schack-parti-varnar");
      brade.setStatus("Vänta – läs varningen!"); // inte "Din tur" medan rutan väntar (F1)
      knapp("varna-angra").focus({ preventScroll: true });
      return new Promise((resolve) => { varnaSvar = resolve; });
    },
    onMove(drag, state) {
      tipsText.textContent = "";
      spara();
      if (!state.slut && state.tur === datorFarg) datornDrar();
      uppdateraKnappar(state);
    },
    onGameOver(slut) {
      seq++;
      dator.avbryt();
      parti.slut = { resultat: slut.resultat, orsak: slut.orsak, vinnare: slut.vinnare };
      const nyttSlut = !parti.raknad;
      parti.raknad = true;
      spara();
      if (nyttSlut && o.onSlut) {
        try { o.onSlut(parti.slut); } catch (e) { console.warn("schack: räknaren", e); }
      }
      if (slut.vinnare === egenFarg && slut.orsak === "matt") hamtaMynt();
      uppdateraKnappar(brade.getState());
    },
  });

  // --- Pluggmynten (#798) -------------------------------------------------------
  const myntRad = $(".schack-mynt-rad");
  const myntIgen = $(".schack-mynt-igen");
  let myntSeq = 0;
  const visaMyntRad = (html) => { if (myntRad) myntRad.innerHTML = html; };
  if (o.mynt) {
    visaMyntRad(myntRadHtml(niva, o.mynt.nu() || undefined));
    o.mynt.kvitto().then((k) => { if (levande && k && !brade.getState().slut) visaMyntRad(myntRadHtml(niva, k)); });
  }

  /** En vinst: servern kontrollerar partiet och betalar första gången. Redan betald nivå = inget anrop. */
  async function hamtaMynt() {
    if (!o.mynt || !DATOR_MYNT[niva.id]) return;
    const token = ++myntSeq;
    if (myntIgen) myntIgen.hidden = true;
    const k = await o.mynt.kvitto();
    if (token !== myntSeq || !levande) return;
    if (k && harDator(k, niva.id)) return visaSvar({ mynt: 0, redan: true });
    visaMyntRad(esc(TEXT_MYNT.hamtar));
    brade.setSlutExtra(`<p class="schack-mynt-svar">${esc(TEXT_MYNT.hamtar)}</p>`);
    try {
      const svar = await o.mynt.datorVinst({ ...parti, drag: brade.getGame().drag });
      if (token === myntSeq && levande) await visaSvar(svar);
    } catch (e) {
      if (token !== myntSeq || !levande) return;
      console.warn("schack: mynten", e?.code || e);
      const t = esc(TEXT_MYNT.fel) + (e?.message ? ` <small>${esc(e.message)}</small>` : "");
      visaMyntRad(t);
      brade.setSlutExtra(`<p class="schack-mynt-svar">${t}</p>`);
      if (myntIgen) myntIgen.hidden = false;
    }
  }

  async function visaSvar(svar) {
    const t = myntHtml(datorVinstText(niva.id, svar));
    let pokal = "";
    if (svar.pokal) {
      try {
        const { schackPokalSvg } = await import("./schack-pokal-art.js");
        pokal = `<span class="schack-pokal-ny">${schackPokalSvg({ aria: SCHACK_POKALER.damen.namn })}</span>`;
      } catch { /* bara bilden saknas – mynten är betalda */ }
      if (!levande) return;
    }
    visaMyntRad(t);
    brade.setSlutExtra(`${pokal}<p class="schack-mynt-svar${svar.mynt > 0 ? " ny" : ""}">${t}</p>`);
  }

  if (parti.drag.length && !brade.loadGame({ drag: parti.drag })) {
    parti.drag = [];
    parti.slut = null;
    spara();
  }
  if (parti.slut && parti.slut.orsak === "gav-upp") {
    brade.avsluta({ ...parti.slut, titel: "Du gav upp – datorn vann." });
  }
  // Ett sparat parti som redan är vunnet (omladdning, eller nätet föll vid slutet): mynten
  // hämtas igen – servern betalar bara en gång och ett betalt kvitto kostar inget anrop (#798).
  const s0slut = brade.getState().slut;
  if (s0slut && s0slut.vinnare === egenFarg && s0slut.orsak === "matt") hamtaMynt();

  function uppdateraKnappar(s) {
    const gavUpp = s.slut && s.slut.orsak === "gav-upp";
    knapp("angra").disabled = !s.drag.length || gavUpp;
    knapp("tips").disabled = !!s.slut || s.tur !== egenFarg || tipsPagar;
    knapp("geupp").disabled = !!s.slut;
  }

  /** Datorns slumpvalda nöddrag om motorn inte svarar (tar hellre än inte). */
  function noddrag() {
    const s = brade.getState();
    const drag = s.pjaser.filter((p) => p.color === datorFarg).flatMap((p) => brade.lagligaDrag(p.ruta));
    return drag.find((d) => d.san.includes("#")) || drag.find((d) => d.captured) || drag[Math.floor(Math.random() * drag.length)] || null;
  }

  function datornDrar() {
    const token = ++seq;
    const start = Date.now();
    brade.setInteractive(false);
    const fen = brade.getFen();
    const seed = (parti.seed + brade.getHistory().length * 7919) >>> 0;
    const gor = (drag) => {
      if (token !== seq || !levande) return;
      const vanta = Math.max(0, tankMin - (Date.now() - start));
      setTimeout(() => {
        if (token !== seq || !levande) return;
        const gjort = (drag && brade.move(drag)) || brade.move(noddrag());
        if (!gjort) console.warn("schack: datorn hittade inget drag");
        if (!brade.getState().slut) brade.setInteractive(egenFarg);
      }, vanta);
    };
    // Partiet hittills följer med så att motorn undviker trefaldig upprepning (F3).
    dator.valjDrag(fen, { niva: niva.id, seed, tidsgransMs: o.tidsgransMs, historik: brade.getGame() })
      .then((res) => gor(res?.drag || null))
      .catch((e) => {
        if (token !== seq) return;
        console.warn("schack: motorn svarade inte", e?.message || e);
        gor(null);
      });
  }

  function svaraVarning(ok) {
    varnaRuta.hidden = true;
    host.classList.remove("schack-parti-varnar");
    const r = varnaSvar;
    varnaSvar = null;
    if (r) {
      if (!ok) brade.setStatus(null); // tillbaka till "Din tur" (ett gjort drag nollställer själv)
      r(ok);
    }
  }

  function angra() {
    const s = brade.getState();
    if (!s.drag.length || (s.slut && s.slut.orsak === "gav-upp")) return;
    seq++; // ett svar som är på väg från datorn kastas
    dator.avbryt();
    svaraVarning(false);
    geuppRuta.hidden = true;
    host.classList.remove("schack-parti-fragar");
    tipsText.textContent = "";
    brade.undo(s.tur === egenFarg ? 2 : 1);
    parti.slut = null;
    myntSeq++; // ett myntsvar på väg gäller det gamla slutet
    brade.setSlutExtra("");
    if (o.mynt) { visaMyntRad(myntRadHtml(niva, o.mynt.nu() || undefined)); if (myntIgen) myntIgen.hidden = true; }
    spara();
    const ny = brade.getState();
    if (ny.tur === datorFarg && !ny.slut) datornDrar();
    else brade.setInteractive(egenFarg);
    uppdateraKnappar(brade.getState());
  }

  async function tips() {
    const s = brade.getState();
    if (s.slut || s.tur !== egenFarg || tipsPagar) return;
    tipsPagar = true;
    const token = seq;
    uppdateraKnappar(s);
    tipsText.textContent = "Datorn funderar…";
    try {
      const r = await dator.tips(s.fen, { tidsgransMs: o.tidsgransMs, historik: brade.getGame() });
      if (token !== seq || !levande || brade.getFen() !== s.fen) return;
      if (r?.drag) {
        brade.showArrow(r.drag.from, r.drag.to);
        const san = brade.lagligaDrag(r.drag.from).find((d) => d.to === r.drag.to && (!r.drag.promotion || d.promotion === r.drag.promotion));
        tipsText.textContent = `Tips: ${san ? svenskSan(san.san) : `${r.drag.from}–${r.drag.to}`}`;
      } else tipsText.textContent = "";
    } catch {
      if (token === seq && levande) tipsText.textContent = "Tipset gick inte att hämta just nu.";
    } finally {
      tipsPagar = false;
      if (levande) uppdateraKnappar(brade.getState());
    }
  }

  function geUpp() {
    geuppRuta.hidden = true;
    host.classList.remove("schack-parti-fragar");
    seq++;
    dator.avbryt();
    svaraVarning(false);
    brade.avsluta({ resultat: datorFarg === "w" ? "1-0" : "0-1", orsak: "gav-upp", vinnare: datorFarg, titel: "Du gav upp – datorn vann." });
  }

  const HANDLING = {
    "varna-angra": () => svaraVarning(false),
    "varna-anda": () => svaraVarning(true),
    "geupp-nej": () => { geuppRuta.hidden = true; host.classList.remove("schack-parti-fragar"); },
    "geupp-ja": geUpp,
    angra,
    tips,
    geupp: () => { geuppRuta.hidden = false; host.classList.add("schack-parti-fragar"); knapp("geupp-nej").focus({ preventScroll: true }); },
    tillbaka: () => o.onTillbaka?.(),
    "mynt-igen": () => hamtaMynt(),
  };
  const klick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act && HANDLING[act]) HANDLING[act]();
  };
  host.addEventListener("click", klick);
  knapp("varna").addEventListener("change", (e) => {
    parti.varna = e.target.checked;
    spara();
  });

  uppdateraKnappar(brade.getState());
  const s0 = brade.getState();
  if (!s0.slut && s0.tur === datorFarg) datornDrar();

  return {
    brade,
    angra,
    tips,
    svaraVarning,
    /** Pluggmynten för en vinst (tester; körs annars av slutet). */
    hamtaMynt,
    /** Visas varningsrutan just nu? (tester) */
    varnar: () => !varnaRuta.hidden,
    destroy() {
      levande = false;
      seq++;
      dator.avbryt();
      host.removeEventListener("click", klick);
      helskarm?.destroy();
      brade.destroy();
      host.classList.remove("schack-parti");
      host.innerHTML = "";
    },
  };
}
