// ============================================================================
// Förhandsvisningen av kompisläget (#780): samma API som src/schack/schack-moln.js
// (lobby, parti, lyssnaKlass, lyssnaParti, serverNow …) men utan Firebase.
// Anropen kör den RIKTIGA serverkärnan (functions/schack-lobby.js och
// functions/schack-parti.js) mot låtsas-databasen i falsk-db.js, med en liten
// fördröjning så att "Skickar…" syns. Lyssnarna räknas (öppna/stängda) så att
// förhandsvisningen och testerna kan se att de stängs.
//
//   const moln = skapaFalskMoln({ db, uid, fordrojningMs, spola: () => ms });
// I webbläsaren kräver functions/-koden en import map för "node:crypto"
// (preview/schack-kompis/node-crypto.js).
// ============================================================================

import * as lobbyKarna from "../../functions/schack-lobby.js";
import * as partiKarna from "../../functions/schack-parti.js";
import { rensaLobby, klockaNu } from "../../src/schack/schack-server-delat.js";
import { oka } from "./falsk-db.js";

export * from "../../src/schack/schack-server-delat.js";

export class SchackMolnFel extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SchackMolnFel";
    this.code = code;
  }
}

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

/** Klassdokumentet i säker form – samma som schack-moln.js normaliseraKlass. */
export function normaliseraKlass(data, nu) {
  const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const k = { vantar: map(data?.vantar), utmaningar: map(data?.utmaningar), partier: map(data?.partier), tabell: map(data?.tabell), dold: data?.dold === true };
  const r = rensaLobby(k, nu);
  return { ...k, vantar: r.vantar, utmaningar: r.utmaningar, finns: Boolean(data) };
}

export function skapaFalskMoln({ db, uid, fordrojningMs = 250, spola = () => 0 }) {
  const serverNow = () => Date.now() + spola();
  const deps = { db, now: serverNow };
  const oppna = { klass: 0, parti: 0 };
  const logg = [];
  const lyssnarLogg = []; // felsökning: varje kontroll av ett lyssnat dokument

  async function call(namn, fn, data) {
    await vanta(fordrojningMs);
    logg.push({ namn, data, tid: serverNow() });
    try {
      return JSON.parse(JSON.stringify(await fn(deps, uid, data)));
    } catch (err) {
      throw new SchackMolnFel(err?.code || "internal", err?.message || "Något gick fel på servern – försök igen.");
    }
  }

  /** onSnapshot-liknande: cb direkt (asynkront) och vid varje ändring av dokumentet. */
  function lyssna(path, typ, map, cb, onError) {
    let senast;
    let aktiv = true;
    oppna[typ]++;
    const kolla = () => {
      if (!aktiv) return;
      const data = db.las(path);
      const json = JSON.stringify(data ?? null);
      lyssnarLogg.push({ path, ny: json !== senast, drag: data?.drag?.length, t: Date.now() });
      if (lyssnarLogg.length > 200) lyssnarLogg.shift();
      if (json === senast) return;
      senast = json;
      try {
        cb(map(data));
      } catch (e) {
        onError?.(e);
      }
    };
    const sluta = db.lyssna(kolla);
    setTimeout(kolla, 0);
    return () => {
      if (!aktiv) return;
      aktiv = false;
      oppna[typ]--;
      sluta();
    };
  }

  return {
    SchackMolnFel,
    serverNow,
    syncServerClock: () => {},
    normaliseraKlass,
    oppna,
    logg,
    lyssnarLogg,
    lobby: {
      vanta: (classId, klocka = null) => call("schackVanta", lobbyKarna.vanta, { classId, klocka }),
      slutaVanta: (classId) => call("schackSlutaVanta", lobbyKarna.slutaVanta, classId ? { classId } : {}),
      gaMed: (classId, motstandare) => call("schackGaMed", lobbyKarna.gaMed, { classId, motstandare }),
      utmana: (classId, till, klocka = null) => call("schackUtmana", lobbyKarna.utmana, { classId, till, klocka }),
      svara: (utmaningId, ja, classId) => call("schackSvara", lobbyKarna.svara, { utmaningId, ja: ja === true, classId }),
    },
    parti: {
      drag: (partiId, { from, to, promotion } = {}) => call("schackDrag", partiKarna.drag, { partiId, from, to, ...(promotion ? { promotion } : {}) }),
      geUpp: (partiId) => call("schackGeUpp", partiKarna.geUpp, { partiId }),
      remi: (partiId, handling) => call("schackRemi", partiKarna.remi, { partiId, handling }),
      kravaVinst: (partiId) => call("schackKravaVinst", partiKarna.kravaVinst, { partiId }),
    },
    lyssnaKlass: (classId, cb, onError) =>
      lyssna(`schackKlass/${classId}`, "klass", (d) => normaliseraKlass(d ?? null, serverNow()), cb, onError),
    lyssnaParti: (partiId, cb, onError) =>
      lyssna(`schackPartier/${partiId}`, "parti", (d) => {
        // Reglerna: bara de två spelarna (och läraren) får läsa ett parti som finns.
        if (d && d.vit !== uid && d.svart !== uid) throw new SchackMolnFel("permission-denied", "Inte din match.");
        return d ? { id: partiId, ...d } : null;
      }, cb, onError),
    klockaVisning(p, nu = serverNow()) {
      if (!p?.klocka) return null;
      if (p.status !== "pagar") return { vitMs: p.klocka.vitMs, svartMs: p.klocka.svartMs, slut: false };
      return klockaNu(p.klocka, p.tur, nu);
    },
    async datorPartiKlart() {
      await db.collection("studentData").doc(uid).set({}, { merge: true });
      await db.collection("studentData").doc(uid).update({ "schack.datorPartier": oka(1) });
      return true;
    },
  };
}
