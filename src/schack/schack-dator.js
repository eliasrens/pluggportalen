// ============================================================================
// Datormotståndaren i sidan (#776, §3.1): startar motorn i en Web Worker och
// ger ett löftes-API. Går workern inte att starta (gammal webbläsare, blockerad
// modul-worker) eller svarar den inte i tid, körs motorn i huvudtråden i
// stället (dynamisk import av schack-motor.js) – då kan brädet frysa en stund,
// men partiet fortsätter alltid.
//
//   const dator = skapaDator();
//   const svar = await dator.valjDrag(fen, { niva: "tornet", seed });   // { drag, djup, ms … } | null
//   const tips = await dator.tips(fen);                                 // { drag, … } | null
//   dator.avbryt();   // glöm pågående frågor (svaren ignoreras)
//   dator.destroy();
// ============================================================================

import { TIDSGRANS_MS } from "./schack-motor.js";

const VAKT_MS = 2500; // svarar workern inte inom tidsgränsen + så här mycket startas den om

/** @param {object} [opt]  { Worker?, motor?, vaktMs? } – bara för tester (egen Worker-klass, motorn i tråden, kortare vakt) */
export function skapaDator(opt = {}) {
  const Workern = opt.Worker ?? (typeof Worker === "function" ? Worker : null);
  const vaktMs = opt.vaktMs ?? VAKT_MS;
  let worker = null;
  let trasig = !Workern;
  let nasta = 1;
  const vantande = new Map(); // id → { resolve, reject, timer }
  let motorP = null;

  function iTraden() {
    return (motorP ??= opt.motor ? Promise.resolve(opt.motor) : import("./schack-motor.js"));
  }

  function slapp(id, ok, varde) {
    const v = vantande.get(id);
    if (!v) return;
    vantande.delete(id);
    clearTimeout(v.timer);
    ok ? v.resolve(varde) : v.reject(varde instanceof Error ? varde : new Error(String(varde)));
  }

  function starta() {
    if (worker || trasig) return worker;
    try {
      worker = new Workern(new URL("./schack-motor-worker.js", import.meta.url), { type: "module" });
    } catch (e) {
      console.warn("schack: workern kunde inte startas, motorn körs i huvudtråden", e);
      trasig = true;
      return null;
    }
    worker.onmessage = (e) => {
      const d = e.data || {};
      if (d.id != null) slapp(d.id, d.ok, d.ok ? d.resultat : d.fel);
    };
    worker.onerror = (e) => {
      console.warn("schack: fel i motorns worker, motorn körs i huvudtråden", e?.message || e);
      stang(true);
    };
    return worker;
  }

  /** Stäng workern; pågående frågor körs om i huvudtråden. */
  function stang(fallTillbaka) {
    const w = worker;
    worker = null;
    if (w) w.terminate();
    if (!fallTillbaka) return;
    trasig = true;
    for (const [id, v] of [...vantande]) {
      vantande.delete(id);
      clearTimeout(v.timer);
      iTraden().then((m) => v.resolve(v.kor(m))).catch(v.reject);
    }
  }

  function fraga(typ, fen, o) {
    const tids = o.tidsgransMs ?? TIDSGRANS_MS;
    const kor = (m) => (typ === "tips" ? m.analysera(fen, { ...o, tidsgransMs: tids }) : m.valjDrag(fen, { ...o, tidsgransMs: tids }));
    const w = starta();
    if (!w) return iTraden().then(kor);
    return new Promise((resolve, reject) => {
      const id = nasta++;
      const timer = setTimeout(() => {
        if (!vantande.has(id)) return;
        console.warn("schack: motorn svarade inte i tid – startar om workern");
        stang(true);
      }, tids + vaktMs);
      vantande.set(id, { resolve, reject, timer, kor });
      w.postMessage({ id, typ, fen, opt: { ...o, tidsgransMs: tids } });
    });
  }

  /**
   * Glöm alla pågående frågor (svaren förkastas) – t.ex. vid Ångra medan datorn
   * tänker. Workern är entrådad och kan inte avbrytas mitt i en sökning: tänker
   * den just nu dödas den och en ny startas direkt (kallstart ~75 ms), så att
   * nästa fråga inte köar bakom den gamla sökningens tidsgräns (F2).
   */
  const avbryt = () => {
    const tankte = vantande.size > 0;
    for (const [id] of [...vantande]) slapp(id, false, new Error("avbruten"));
    if (tankte && worker) {
      stang(false);
      starta();
    }
  };

  return {
    valjDrag: (fen, o = {}) => fraga("drag", fen, o),
    tips: (fen, o = {}) => fraga("tips", fen, o),
    avbryt,
    /** Körs motorn i workern just nu (annars i huvudtråden)? */
    iWorker: () => !!worker && !trasig,
    destroy() {
      avbryt();
      stang(false);
    },
  };
}
