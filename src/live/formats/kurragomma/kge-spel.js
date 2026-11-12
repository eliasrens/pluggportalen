// ============================================================================
// Kurragömma 🙈 – elevskärmens SPEL (#839, spec §1.3–§1.6, §6): frågepanelen
// (kistspelets createQuestionFlow – ÅTERANVÄND: skriv själv, flerval, tidslinje),
// svaren (kgSvara → poäng, laddningar, egen vissling), sökningen (kgLeta med
// 2 s spärr), rörelsekanalen (sökarnas positioner → scenen, visslingar →
// markör/rad, hjärtslaget ur motorn) och sökarens egna positioner (högst 5/s –
// kanalen filtrerar – och minst var POS_PULS_MS även stilla: pulsen för "alltid en sökare"). Ingen DOM utöver frågepanelens värd; vyn (kge-elev-vy.js)
// äger texterna och faserna och får dem via `ui`.
//
//   skapaSpel({ sid, uid, api, mode, answerKind, questions, fragorHost, ui }) → spel
//     spel.koppla({ scen, kanal })      när scenen och kanalen finns
//     spel.lage(l)                      elevLage: gom-gomd | gom-sokare | leta-gomd | leta-sokare
//     spel.gomstalle(p | null)          den egna låsta platsen (hjärtslaget)
//     spel.fragor(on)                   visa/dölj frågorna
//     spel.leta()                       🔦 Leta (knapp, mellanslag, E)
//     spel.egenVissling(t)              tystnadsregelns referens (ur eget kgPlayers.tystRef): hand-
//                                       visslingen med samma t är min → ui.egenVissling(h) en gång
//     spel.setNextQ(n) · spel.laddningar · spel.destroy()
//   ui = { svar(res), fel(text), vissling(h, egen), egenVissling(h), hittade(lista), laddningar(n) }
// ============================================================================

import { createQuestionFlow } from "../../kistspel/ks-fraga.js";
import { hjartslag } from "./delat/kg-regler.js";
import { LETA_SPARR_MS, POS_PULS_MS } from "./delat/kg-config.js";
import { letaFel, skapaEgenVisslingar } from "./kge-logik.js";

const VISA_IGEN_MS = 550; // skriv själv visar ✅ en halv sekund innan nästa fråga

export function skapaSpel({ sid, uid, api, mode, answerKind, questions = () => [], fragorHost, ui }) {
  const quiz = mode.id === "plugga_quiz";
  let scen = null;
  let kanal = null;
  let lage = "gom-gomd";
  let gomstalle = null;
  let laddningar = 0;
  let destroyed = false;
  let fragorPa = false;
  let letar = false;
  let senasteLetaAt = -Infinity;
  let egenVisslingAt = -Infinity;
  let visaT = 0;
  let pulsT = 0;
  const egna = skapaEgenVisslingar(); // tystnadsregelns egna visslingar (kgPlayers.tystRef ↔ hand.t)
  const sokare = new Map(); // uid → { x, z }
  const av = [];

  // --- frågorna: createQuestionFlow med kgSvara som send ---------------------------------
  async function send(payload) {
    const res = await api.svara(sid, payload);
    if (destroyed) return res;
    if (Number.isFinite(res?.laddningar)) laddningar = res.laddningar;
    if (res?.vissling) egenVisslingAt = Date.now();
    ui.svar(res);
    return res;
  }
  const flow = createQuestionFlow(fragorHost, {
    mode: quiz ? mode : { ...mode, createSource: () => mode.createSource() },
    answerKind, tlCls: "kge-svar-tl", questions, send,
    onCorrect: ({ answerP }) => {
      // Nästa fråga när servern bekräftat (eller nekat) svaret – facit visas ändå direkt.
      Promise.resolve(answerP).catch(() => null).then(() => {
        clearTimeout(visaT);
        visaT = setTimeout(() => { if (!destroyed && fragorPa) flow.show(); }, VISA_IGEN_MS);
      });
    },
    onProblem: (err) => {
      if (destroyed) return;
      ui.fel(err?.code === "failed-precondition" ? err.message : "Svaret kom inte fram – försök igen.");
      clearTimeout(visaT);
      visaT = setTimeout(() => { if (!destroyed && fragorPa) flow.show(); }, 1200);
    },
  });

  // --- rörelsekanalen ----------------------------------------------------------------------
  function pos(u, p) {
    if (u === uid) return;
    if (!p) { sokare.delete(u); scen?.sokareBort(u); }
    else { sokare.set(u, { x: p.x, z: p.z }); scen?.sokare([{ uid: u, x: p.x, z: p.z, yaw: p.yaw, t: p.t, namn: ui.namn?.(u) || null }]); }
    puls();
  }
  /** Hjärtslaget (§1.3): en sökare inom HJARTSLAG_M från det egna gömstället – räknas på klienten. */
  function puls() {
    if (!scen) return;
    const gomd = lage === "leta-gomd" && gomstalle;
    scen.hjartslag(!!gomd && hjartslag(gomstalle, [...sokare.values()]));
  }
  function handelse(h) {
    if (!h || destroyed) return;
    if (h.typ === "vissling") {
      const p = { x: Number(h.x) || 0, z: Number(h.z) || 0 };
      const tyst = egna.vissling(h);
      const egen = egna.arEgen(h.t) || Date.now() - egenVisslingAt < 2500;
      if (lage === "leta-sokare") scen?.vissling(p);
      ui.vissling(h, egen);
      if (tyst) ui.egenVissling?.(tyst);
    }
  }
  const arSokare = () => lage === "leta-sokare" || lage === "gom-sokare";
  function flytt(p) {
    if (arSokare()) kanal?.skickaPos(p);
    ui.flytt?.(p);
  }
  // Pulsen (§1.1 "det finns alltid en sökare", C läser pos.t): en sökare som står stilla
  // skickar ändå sin plats minst var POS_PULS_MS – kanalens filter släpper igenom den.
  function puls_() {
    if (destroyed || !scen || !kanal || !arSokare()) return;
    kanal.skickaPos(scen.jag());
  }

  // --- sökningen (§1.6) ----------------------------------------------------------------------
  async function leta() {
    if (destroyed || letar || lage !== "leta-sokare" || !scen) return false;
    const nu = Date.now();
    if (nu - senasteLetaAt < LETA_SPARR_MS) { ui.fel("Vänta lite mellan sökningarna."); return false; }
    if (laddningar <= 0) { ui.fel(letaFel({ details: { skal: "ingen-laddning" } })); return false; }
    letar = true;
    senasteLetaAt = nu;
    ui.letar?.(true);
    try {
      const r = await api.leta(sid, scen.jag());
      if (destroyed) return false;
      if (Number.isFinite(r?.laddningar)) laddningar = r.laddningar;
      ui.laddningar(laddningar);
      for (const h of r?.hittade || []) scen.hittad({ x: h.x, z: h.z });
      ui.hittade(r?.hittade || [], r);
      return true;
    } catch (err) {
      if (!destroyed) {
        if (err?.details?.skal === "sparr") senasteLetaAt = Date.now();
        ui.fel(letaFel(err));
      }
      return false;
    } finally {
      letar = false;
      ui.letar?.(false);
    }
  }

  return {
    koppla(k) {
      scen = k.scen;
      kanal = k.kanal;
      av.push(scen.on("flytt", flytt));
      av.push(kanal.paPos(pos));
      av.push(kanal.paHandelse(handelse));
      clearInterval(pulsT);
      pulsT = setInterval(puls_, POS_PULS_MS / 2);
    },
    /** Referens ur det egna kgPlayers.tystRef: hand-händelsen med samma t är min (kom den redan visas den nu). */
    egenVissling(t) { const h = egna.referens(t); if (h) ui.egenVissling?.(h); },
    lage(l) { lage = l; puls(); },
    gomstalle(p) { gomstalle = p ? { x: p.x, z: p.z } : null; puls(); },
    fragor(on) {
      fragorPa = !!on;
      clearTimeout(visaT);
      if (fragorPa) flow.show(); else flow.hide();
    },
    setNextQ: (n) => flow.setNextQ(n),
    leta,
    get laddningar() { return laddningar; },
    set laddningar(n) { laddningar = Number(n) || 0; },
    get letar() { return letar; },
    sokare: () => [...sokare.values()],
    destroy() {
      destroyed = true;
      clearTimeout(visaT);
      clearInterval(pulsT);
      for (const u of av.splice(0)) { try { u(); } catch { /* redan av */ } }
      flow.destroy();
    },
  };
}
