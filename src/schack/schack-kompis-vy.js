// ============================================================================
// Partiet mot en kompis – vyn (#780, §7.2–§7.3). Samma bräde och "möjliga
// drag" som mot datorn, men UTAN ångra, tips och varningar (de finns aldrig
// mot klasskompisar). Servern avgör allt:
//   - EN onSnapshot på schackPartier/{partiId} (moln.lyssnaParti); brädet följer
//     serverns draglista (motståndarens drag glider in med brade.move).
//   - Elevens drag går via brädets beforeMove → moln.parti.drag: pjäsen står
//     halvgenomskinlig på målrutan med "Skickar…"; nekar servern hoppar den tillbaka.
//   - Klockan räknas lokalt ur senastDragAt + serverNow() (ingen skrivning per
//     sekund); tiden slut → "Kräv vinsten" (schackKravaVinst, servern kontrollerar).
//   - §7.3 utan klocka: varning efter 4 min, motståndaren får avsluta efter 5 min.
//   - Ge upp / Föreslå remi med bekräftelse på sidan (aldrig confirm()).
//
//   const vy = skapaKompisVy(host, { kompis, partiId, fortsatt, avatarHtml, onSlut, tillLobby, spelaIgen });
//   vy.destroy();   // stänger partiets lyssnare och klockan
//   vy.verktyg      // .schack-parti-verktyg: tom verktygsrad ovanför brädet – kroken för
//                   // t.ex. helskärmsknappen (#783); vy.element = hela partivyn (det som visas i helskärm)
// ============================================================================

import { skapaSchackbrade } from "./schack-bradet.js";
import { esc } from "./schack-bradet-delar.js";
import {
  klockor, fargFor, motstandare, lamnatLage, slutText, dragDiff, klockaEtikett,
} from "./schack-kompis-data.js";
import { markeraLamnat } from "./schack-kompis.js";

const TICK_MS = 200;
const felText = (e) => e?.message || "Det gick inte just nu – försök igen.";

function panelHtml() {
  return (
    `<div class="schack-panel-niva schack-kompis-info"></div>` +
    `<div class="schack-fraga schack-remi-ruta" role="alertdialog" aria-labelledby="schack-remi-text" hidden>` +
    `<p id="schack-remi-text" class="schack-fraga-text"></p>` +
    `<div class="schack-fraga-knappar"><button type="button" class="btn liten" data-act="remi-ja">Ja, remi</button>` +
    `<button type="button" class="btn ghost liten" data-act="remi-nej">Nej, spela vidare</button></div></div>` +
    `<div class="schack-fraga schack-erbjud-ruta" role="alertdialog" aria-labelledby="schack-erbjud-text" hidden>` +
    `<p id="schack-erbjud-text" class="schack-fraga-text"></p>` +
    `<div class="schack-fraga-knappar"><button type="button" class="btn liten" data-act="erbjud-nej">Nej</button>` +
    `<button type="button" class="btn ghost liten" data-act="erbjud-ja">Ja, föreslå remi</button></div></div>` +
    `<div class="schack-fraga schack-geupp-ruta" role="alertdialog" aria-labelledby="schack-geupp-text" hidden>` +
    `<p id="schack-geupp-text" class="schack-fraga-text"></p>` +
    `<div class="schack-fraga-knappar"><button type="button" class="btn liten" data-act="geupp-nej">Nej, spela vidare</button>` +
    `<button type="button" class="btn ghost liten" data-act="geupp-ja">Ja, ge upp</button></div></div>` +
    `<div class="schack-knappar">` +
    `<button type="button" class="btn ghost liten" data-act="remi">Föreslå remi</button>` +
    `<button type="button" class="btn ghost liten" data-act="geupp">Ge upp</button></div>` +
    `<p class="schack-kompis-remi-vantar" hidden></p>` +
    `<p class="schack-tips-text schack-kompis-meddelande" role="alert"></p>`
  );
}

/**
 * @param {HTMLElement} host
 * @param {object} o
 * @param {object} o.kompis      { moln: () => Promise<moln>, uid, classId, klasslista? }
 * @param {string} o.partiId
 * @param {boolean} [o.fortsatt] eleven kom tillbaka till partiet (inte från lobbyn): är det slut → lobbyn direkt
 * @param {string} [o.avatarHtml]  elevens egen avatar
 * @param {Function} [o.onSlut]  partiet tog slut (flödet visar utmaningsrutan igen)
 * @param {Function} o.tillLobby
 * @param {(parti) => Promise} [o.spelaIgen]  "Spela igen" = utmana samma kompis
 * @param {boolean} [o.reducedMotion]
 */
export function skapaKompisVy(host, o) {
  const k = o.kompis;
  let moln = null;
  let parti = null;
  let brade = null;
  let egen = null;
  let skickar = false;
  let avslutad = false;
  let levande = true;
  let stoppParti = null;
  let tick = null;
  let fraga = null; // vilken bekräftelseruta som är öppen
  let senastLage = "";

  host.classList.add("schack-parti", "schack-kompis");
  host.innerHTML =
    `<div class="schack-parti-brade"><div class="schack-parti-verktyg" data-krok="verktyg"></div>` +
    `<div class="schack-kompis-lage" aria-live="polite"></div><div class="schack-kompis-yta"></div></div>` +
    `<aside class="schack-panel" aria-label="Partiet mot en kompis">${panelHtml()}</aside>`;
  const $ = (s) => host.querySelector(s);
  const lageEl = $(".schack-kompis-lage");
  const meddelande = $(".schack-kompis-meddelande");
  const knapp = (act) => $(`[data-act="${act}"]`);
  const rutor = { remi: $(".schack-remi-ruta"), erbjud: $(".schack-erbjud-ruta"), geupp: $(".schack-geupp-ruta") };
  const nu = () => (moln?.serverNow ? moln.serverNow() : Date.now());
  const visa = (text) => { meddelande.textContent = text || ""; };

  function visaFraga(namn) {
    fraga = namn;
    for (const [n, el] of Object.entries(rutor)) el.hidden = n !== namn;
    host.classList.toggle("schack-parti-fragar", Boolean(namn));
    if (namn) rutor[namn].querySelector("button")?.focus({ preventScroll: true });
  }

  /** Bara meddelande + Till lobbyn (partiet saknas eller går inte att läsa). */
  function visaSaknas(text) {
    markeraLamnat(o.partiId);
    stoppa();
    brade?.destroy();
    brade = null;
    host.classList.remove("schack-parti-fragar");
    host.innerHTML = `<div class="schack-sida"><div class="panel schack-kompis-saknas"><p><b>${esc(text)}</b></p>` +
      `<button type="button" class="btn" data-act="lobby">Till lobbyn</button></div></div>`;
  }

  function skapaBrade(p) {
    egen = fargFor(p, k.uid);
    const m = motstandare(p, k.uid);
    const motstFarg = egen === "w" ? "b" : "w";
    brade = skapaSchackbrade($(".schack-kompis-yta"), {
      egenFarg: egen, motstandare: "kompis", interaktiv: egen, orientering: egen, reducedMotion: o.reducedMotion,
      namn: { w: p.vitNamn || "Vit", b: p.svartNamn || "Svart" },
      avatar: { [egen]: o.avatarHtml || "" },
      beforeMove: skickaDrag,
    });
    $(".schack-kompis-info").innerHTML =
      `<span>Du spelar mot <b>${esc(m.namn)}</b><small>${p.klocka ? `${esc(klockaEtikett(p.klocka.minuter))} var` : "Utan klocka"} · du har ${egen === "w" ? "vit" : "svart"}</small></span>`;
    Promise.resolve(k.klasslista?.() ?? []).then((lista) => {
      const a = (lista || []).find((x) => x.uid === m.uid)?.avatarHtml;
      if (a && levande && brade) brade.setSpelare({ avatar: { [motstFarg]: a } });
    }).catch(() => {});
  }

  /** Elevens drag: till servern först (§7.2) – pjäsen väntar halvgenomskinlig. */
  function skickaDrag(drag) {
    if (!parti || parti.status !== "pagar" || !moln) return false;
    skickar = true;
    visa("");
    brade.setStatus("Skickar…");
    return moln.parti.drag(o.partiId, { from: drag.from, to: drag.to, promotion: drag.promotion || undefined })
      .then((r) => {
        if (r?.gjort === false) visa("Din tid hann ta slut innan draget kom fram.");
        return r?.gjort !== false;
      })
      .catch((e) => {
        visa(felText(e));
        return false;
      })
      .then((ok) => {
        if (!ok && levande) brade.setStatus(null);
        return ok;
      })
      .finally(() => {
        skickar = false;
        // Brädet gör/ångrar draget i samma löfteskedja – synka mot servern efteråt.
        setTimeout(() => { if (levande && parti) synka(parti); }, 0);
      });
  }

  function synka(p) {
    if (!brade || skickar) return;
    const d = dragDiff(brade.getHistory(), Array.isArray(p.drag) ? p.drag : []);
    if (d.typ === "ett") {
      if (!brade.move(d.san)) brade.loadGame({ drag: p.drag });
    } else if (d.typ === "ladda") brade.loadGame({ drag: p.drag || [] });
    if (p.status !== "pagar") avsluta(p);
    else brade.setInteractive(egen);
    uppdatera();
  }

  function avsluta(p) {
    if (avslutad) return;
    avslutad = true;
    visaFraga(null);
    const lokal = brade.getState().slut?.orsak;
    const s = slutText(p, k.uid, lokal);
    brade.setInteractive(false);
    brade.avsluta({ resultat: s.resultat, orsak: s.orsak, vinnare: s.vinnare, titel: s.titel, text: s.text || undefined });
    const m = motstandare(p, k.uid);
    brade.setSlutKnappar([
      ...(o.spelaIgen && m.uid ? [{ text: "Spela igen", onClick: () => spelaIgen() }] : []),
      { text: "Till lobbyn", onClick: () => tillLobby() },
    ]);
    o.onSlut?.(p);
  }

  async function spelaIgen() {
    try {
      await o.spelaIgen(parti);
    } catch (e) {
      visa(felText(e));
      brade.setSlutKnappar([{ text: "Till lobbyn", onClick: () => tillLobby() }]);
    }
  }

  function tillLobby() {
    markeraLamnat(o.partiId);
    o.tillLobby?.();
  }

  /** Klockorna, §7.3-texterna och knapparna – räknas lokalt varje tick. */
  function uppdatera() {
    if (!parti || !brade || !levande) return;
    const n = nu();
    const kl = klockor(parti, n);
    if (kl) {
      const html = (f) => `<span class="schack-klocka${kl[f].aktiv ? " aktiv" : ""}${kl[f].lite ? " lite" : ""}" role="timer" aria-label="${f === egen ? "Din tid" : "Motståndarens tid"} ${esc(kl[f].text)}">${esc(kl[f].text)}</span>`;
      brade.setSpelarExtra({ w: html("w"), b: html("b") });
    }
    const m = motstandare(parti, k.uid).namn;
    const l = lamnatLage(parti, k.uid, n);
    let lage = "";
    if (parti.status === "pagar") {
      if (l.kanKrava) {
        lage = `<div class="schack-kompis-krav"><p>${parti.klocka ? `${esc(m)}s tid är slut!` : `${esc(m)} verkar ha gått. Avsluta partiet och ta vinsten?`}</p>` +
          `<button type="button" class="btn gron liten" data-act="krava">${parti.klocka ? "Kräv vinsten" : "Avsluta och ta vinsten"}</button></div>`;
      } else if (l.minTidSlut) lage = `<p class="schack-kompis-varning">Din tid är slut.</p>`;
      else if (l.varning) lage = `<p class="schack-kompis-varning">Din tur! Om en minut kan din motståndare avsluta partiet.</p>`;
    }
    if (lage !== senastLage) {
      senastLage = lage;
      lageEl.innerHTML = lage;
    }
    const pagar = parti.status === "pagar";
    const erbjudit = parti.remiErbjudenAv === k.uid;
    const erbjudenAvM = pagar && parti.remiErbjudenAv && parti.remiErbjudenAv !== k.uid;
    knapp("remi").disabled = !pagar || erbjudit;
    knapp("geupp").disabled = !pagar;
    host.querySelector(".schack-knappar").hidden = !pagar;
    const vantar = $(".schack-kompis-remi-vantar");
    vantar.hidden = !(pagar && erbjudit);
    vantar.textContent = erbjudit ? `Du har föreslagit remi – väntar på svar från ${m}.` : "";
    if (erbjudenAvM && fraga !== "remi" && fraga !== "geupp") {
      $("#schack-remi-text").textContent = `${m} föreslår remi – att ni slutar och ingen vinner. Vill du det?`;
      visaFraga("remi");
    } else if (!erbjudenAvM && fraga === "remi") visaFraga(null);
  }

  /** Ett partianrop (ge upp, remi, kräv vinst): fel som text, partiet uppdateras via lyssnaren. */
  async function gor(fn) {
    if (!moln) return;
    visa("");
    try {
      await fn(moln.parti);
    } catch (e) {
      if (levande) visa(felText(e));
    }
  }

  const HANDLING = {
    remi: () => {
      $("#schack-erbjud-text").textContent = `Vill du föreslå remi? Säger ${motstandare(parti, k.uid).namn} ja slutar partiet och ingen vinner.`;
      visaFraga("erbjud");
    },
    "erbjud-ja": () => { visaFraga(null); gor((p) => p.remi(o.partiId, "erbjud")); },
    "erbjud-nej": () => visaFraga(null),
    "remi-ja": () => { visaFraga(null); gor((p) => p.remi(o.partiId, "acceptera")); },
    "remi-nej": () => { visaFraga(null); gor((p) => p.remi(o.partiId, "neka")); },
    geupp: () => {
      $("#schack-geupp-text").textContent = `Vill du ge upp partiet? Då vinner ${motstandare(parti, k.uid).namn}.`;
      visaFraga("geupp");
    },
    "geupp-nej": () => { visaFraga(null); uppdatera(); },
    "geupp-ja": () => { visaFraga(null); gor((p) => p.geUpp(o.partiId)); },
    krava: (b) => {
      b.disabled = true;
      // Nekar servern (klockorna skiljer en aning) ritas knappen om och går att trycka igen.
      gor((p) => p.kravaVinst(o.partiId)).then(() => { senastLage = ""; uppdatera(); });
    },
    lobby: () => o.tillLobby?.(),
  };
  const klick = (e) => {
    const b = e.target.closest("[data-act]");
    if (b && !b.disabled && HANDLING[b.dataset.act]) HANDLING[b.dataset.act](b);
  };
  host.addEventListener("click", klick);

  function nyttParti(p) {
    if (!levande) return;
    if (!p) return visaSaknas("Partiet finns inte längre.");
    if (!fargFor(p, k.uid)) return visaSaknas("Du spelar inte i det här partiet.");
    const forsta = !parti;
    parti = p;
    if (forsta) {
      if (o.fortsatt && p.status !== "pagar") {
        markeraLamnat(o.partiId);
        stoppa();
        return o.tillLobby?.({ ersatt: true });
      }
      skapaBrade(p);
      tick = setInterval(uppdatera, TICK_MS);
    }
    synka(p);
  }

  function stoppa() {
    clearInterval(tick);
    tick = null;
    try { stoppParti?.(); } catch { /* redan stängd */ }
    stoppParti = null;
  }

  Promise.resolve(k.moln()).then((m) => {
    if (!levande) return;
    moln = m;
    stoppParti = m.lyssnaParti(o.partiId, nyttParti, () => { if (levande) visaSaknas("Partiet gick inte att öppna."); });
  }).catch(() => { if (levande) visaSaknas("Partiet gick inte att öppna just nu."); });

  return {
    get brade() { return brade; },
    /** Hela partivyn (brädet + panelen) – t.ex. det element som visas i helskärm. */
    element: host,
    /** Verktygsraden ovanför brädet (tom; döljs med CSS när den är tom) – montera knappar här. */
    verktyg: host.querySelector(".schack-parti-verktyg"),
    get parti() { return parti; },
    /** Lyssnar vyn på partiet just nu? (tester) */
    lyssnar: () => Boolean(stoppParti),
    destroy() {
      levande = false;
      stoppa();
      host.removeEventListener("click", klick);
      brade?.destroy();
      brade = null;
      host.classList.remove("schack-parti", "schack-kompis", "schack-parti-fragar");
      host.innerHTML = "";
    },
  };
}
