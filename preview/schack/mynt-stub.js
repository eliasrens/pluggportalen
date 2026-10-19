// ============================================================================
// Förhandsvisningarnas "server" för schackets pluggmynt (#798) – utan Firebase.
// Samma kontroll som Cloud Functionen (src/schack/schack-mynt-kontroll.js) körs
// här i webbläsaren, och kvittot + saldot ligger i localStorage, så att bockarna,
// "+200 mynt"-svaret, "redan"-svaret och pokalen går att se och prova.
//
//   const mynt = skapaMyntStub({ skriv, nyckel? });   // → skapaMynt(...) med stubbtransport
//   mynt.nollstall(); mynt.saldo()
// window.myntStub i sidorna = { kvitto(), saldo(), nollstall() } (tester).
// ============================================================================

import { skapaMynt } from "../../src/schack/schack-mynt.js";
import { DATOR_MYNT, DATOR_POKAL, LEKTION_MYNT, PUSSEL_MYNT, pusselNyckel, normaliseraKvitto } from "../../src/schack/schack-mynt-delat.js";
import { verifieraDatorParti, verifieraLektion, verifieraPussel } from "../../src/schack/schack-mynt-kontroll.js";
import { laddaPussel } from "../../src/schack/schack-pussel.js";

const FEL = (msg) => Object.assign(new Error(msg), { code: "invalid-argument" });

export function skapaMyntStub({ skriv = () => {}, nyckel = "pp:schack:mynt:preview", fordrojMs = 300 } = {}) {
  const las = () => { try { return JSON.parse(localStorage.getItem(nyckel) || "{}"); } catch { return {}; } };
  const spara = (v) => { try { localStorage.setItem(nyckel, JSON.stringify(v)); } catch {} };
  const vanta = () => new Promise((r) => setTimeout(r, fordrojMs));

  function betala(grupp, nyckelId, mynt) {
    const d = las();
    const k = normaliseraKvitto(d.kvitto);
    if (Object.hasOwn(k[grupp], nyckelId)) {
      skriv(`SERVERN: ${grupp}.${nyckelId} redan betald → 0 mynt`);
      return { mynt: 0, redan: true, nyckel: nyckelId, pokal: false };
    }
    const nu = Date.now();
    k[grupp][nyckelId] = nu;
    const pokal = grupp === "dator" ? DATOR_POKAL[nyckelId] || null : null;
    if (pokal) k.pokaler[pokal] = nu;
    k.total += mynt;
    spara({ kvitto: k, saldo: (d.saldo || 0) + mynt });
    skriv(`SERVERN: +${mynt} mynt för ${grupp}.${nyckelId}${pokal ? " + pokalen" : ""} (saldo ${(d.saldo || 0) + mynt})`);
    return { mynt, redan: false, nyckel: nyckelId, pokal: Boolean(pokal) };
  }

  const mynt = skapaMynt({
    hamtaKvitto: async () => { await vanta(); skriv("LÄSNING: schackMynt/{uid}"); return las().kvitto || {}; },
    datorVinst: async ({ niva, seed, drag }) => {
      await vanta();
      const t = performance.now();
      const r = verifieraDatorParti({ niva, seed, drag });
      skriv(`SERVERN kontrollerade partiet mot ${niva} (${drag.length} halvdrag) på ${Math.round(performance.now() - t)} ms: ${r.ok ? "ok" : r.fel}`);
      if (!r.ok) throw FEL("Datorns drag stämmer inte med nivån.");
      return betala("dator", niva, DATOR_MYNT[niva]);
    },
    lektion: async ({ nr, losning }) => {
      await vanta();
      const r = verifieraLektion(nr, losning);
      skriv(`SERVERN kontrollerade lektion ${nr}: ${r.ok ? "ok" : r.fel}`);
      if (!r.ok) throw FEL("Lösningen klarar inte övningen.");
      return betala("lektioner", String(nr), LEKTION_MYNT);
    },
    pussel: async ({ sort, nr, id, drag }) => {
      await vanta();
      const lista = await laddaPussel(sort);
      const p = lista.find((x) => x.id === id) || lista[nr - 1];
      const ok = verifieraPussel(p, sort, drag);
      skriv(`SERVERN kontrollerade pussel ${sort} ${nr} (${drag.join(" ")}): ${ok ? "ok" : "fel"}`);
      if (!ok) throw FEL("Det där löser inte pusslet.");
      return betala("pussel", pusselNyckel(sort, p.id), PUSSEL_MYNT);
    },
    onBetalt: (s) => skriv(`KLIENTEN: saldot läses om (+${s.mynt})`),
  });
  const api = {
    ...mynt,
    saldo: () => las().saldo || 0,
    kvittoData: () => normaliseraKvitto(las().kvitto),
    nollstall: () => { try { localStorage.removeItem(nyckel); } catch {} skriv("mynten nollställda"); },
  };
  return api;
}
