// ============================================================================
// Meteorstormen ☄️ (#823, spec §8, LIVE-FORMAT §8): ELEVDELEN AV DEMOLÄGET –
// en isolerad match i minnet för elevskärmen: ingen Firestore, inga Cloud
// Functions, inga pluggmynt. En LÅTSASSERVER svarar på elevklientens anrop
// (msAgera, msRatta, msLage, msAvsluta) med formatets RIKTIGA delade regler
// (delat/: energiEffekt, kanAgera, effektPerTryck, simulera) – samma beslut
// som functions/meteorstorm-core.js – och 2 påhittade klasser med simulerade
// elever som svarar i olika takt (70 % / 60 % rätt) fyller loggen, så att
// stationerna, händelserna och dragstrålen lever. Bara förhandsvisningen
// (preview/preview-meteorstorm-elev.html) och testerna laddar den.
//
// createMsElevDemo({ seed?, lage?, attacker?, minuter?, me?, elever?, quiz?,
//                    latens?, statusMs?, klocka? })
// → {
//   session                 sessionsdokumentet (demo: true – betalar aldrig)
//   api                     = meteorstorm-data.js-formen för ms-elev-vy.js:
//                             skapaKlient, skapaStatusvakt, getQuestions, avsluta
//   now()                   demots klocka (Date.now + hopp)
//   st(phase?)              live-feed-liknande tillstånd { phase, session, clock, result }
//   tick()                  låter de simulerade eleverna svara fram till now()
//   hoppa(ms) · snartSlut(sek) · tillHandelse()   flytta klockan framåt
//   status()                stationerna nu (som msPublic/status)
//   handlingar()            loggen (kopia) · result() → msAvsluta-resultatet
// }
// ============================================================================

import { simulera } from "./delat/ms-motor.js";
import { energiEffekt, kanAgera, effektPerTryck, stormPlan } from "./delat/ms-agera.js";
import { ENERGI_TAK, HANDLINGAR, RENDER_FORDROJNING_MS } from "./delat/ms-balans.js";
import { MS_MIN_GAP_MS } from "./delat/ms-anrop.js";
import { skapaPrng } from "./delat/ms-prng.js";
import { createMsKlient } from "./ms-klient.js";
import { placementPrize, perCorrectCoins } from "../../live-rewards.js";

const NAMN = ["Alma", "Omar", "Ines", "Leo", "Clara", "Sam", "Ella", "Noah", "Maja", "Elias", "Wilma", "Adam", "Saga", "Hugo",
  "Vera", "Liam", "Nora", "Ali", "Selma", "Melvin", "Tyra", "Isak", "Juni", "Otto", "Stella", "Malte", "Siri", "Ebbe", "Lova", "Ahlaam"];
const fel = (code, message, details) => Object.assign(new Error(message), { code, ...(details ? { details } : {}) });
const runda = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

/** Som functions/meteorstorm-status.js statusFran – stationerna nu − 1,5 s. */
export function statusFran(cfg, handlingar, now) {
  const st = simulera({ ...cfg, handlingar }, Math.max(cfg.startMs, now - RENDER_FORDROJNING_MS));
  const h = st.handelser[0];
  return {
    tMs: now, visarMs: st.tMs, kvarMs: st.kvarMs, klart: st.klart,
    handelse: h ? { typ: h.typ, slutMs: h.slutMs } : null,
    stationer: st.stationer.map((x) => ({
      classId: x.classId, skrov: x.skrov, skold: runda(x.skold), laddning: runda(x.laddning, 2), skott: x.skott,
      nedskjutna: x.nedskjutna, flyter: x.flyter, hjalp: x.hjalp,
      drag: { tillaten: x.drag.tillaten, kostnad: x.drag.kostnad, armerad: x.drag.armerad, redoMs: x.drag.redoMs },
    })),
  };
}

export function createMsElevDemo({
  seed = 4711, lage = "klass-mot-klass", attacker = "milda", minuter = 10,
  me = { uid: "jag", name: "Jag", classId: "4b" }, elever = 24, quiz = null,
  latens = () => 120, statusMs = 20_000, klocka = () => Date.now(),
} = {}) {
  const klasser = lage === "en-klass" ? ["4b"] : ["4b", "4d"];
  const classNames = { "4b": "4B", "4d": "4D" };
  let hopp = 0;
  const now = () => klocka() + hopp;
  const startMs = now() + 1000;
  const session = {
    id: `demo-ms-${seed}`, name: "Meteorstormen (demo)", format: "meteorstorm", demo: true,
    gameMode: quiz ? "plugga_quiz" : "multiplication_0_10", answerKind: quiz ? "choice" : "free",
    participatingClassIds: klasser, classNames, durationSeconds: minuter * 60, countdownSeconds: 0, startedAt: startMs,
    msSeed: seed, msInstallningar: { lage, attacker: lage === "en-klass" ? "av" : attacker },
    rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, questionCount: quiz ? quiz.length : undefined,
  };
  const slutMs = startMs + minuter * 60_000;
  const spelare = [{ ...me }];
  klasser.forEach((c, ci) => {
    const n = c === me.classId ? elever - 1 : elever;
    for (let i = 0; i < n; i++) spelare.push({ uid: `${c}-${i}`, name: NAMN[(i + ci * 7) % NAMN.length], classId: c, bot: true });
  });
  const cfg = {
    seed, startMs, varaktighetMs: minuter * 60_000, installningar: session.msInstallningar,
    stationer: klasser.map((c) => ({ classId: c, aktiva: spelare.filter((p) => p.classId === c).length })),
  };
  const logg = [];
  const kedja = new Map(); // uid → { nr, energi, k, t, svar: Map attemptId → svar }
  const raknare = new Map(); // uid → { correct, incorrect }
  const rng = skapaPrng(`${seed}|demo`, "elever");
  const botNasta = new Map(spelare.filter((p) => p.bot).map((p) => [p.uid, startMs + 2000 + rng.tal() * 8000]));
  let resultat = null;

  const lank = (uid) => kedja.get(uid) || kedja.set(uid, { nr: 0, energi: 0, k: -1, t: -Infinity, svar: new Map() }).get(uid);
  const svarLogg = []; // { classId, key, text, statKeys, ok } – andel rätt per fråga i result
  const fragaAv = (sv) => {
    if (Number.isInteger(sv?.q)) return { key: `q:${sv.q}`, text: quiz?.[sv.q]?.text || `Fråga ${sv.q + 1}`, statKeys: [] };
    const [x, y] = [sv?.factorA ?? 0, sv?.factorB ?? 0].sort((a, b) => a - b);
    return { key: `m:${x}x${y}`, text: `${x} × ${y}`, statKeys: [...new Set([`t${x}`, `t${y}`])] };
  };
  const rakna = (uid, ratt, sv = null) => {
    const r = raknare.get(uid) || raknare.set(uid, { correct: 0, incorrect: 0 }).get(uid);
    r[ratt ? "correct" : "incorrect"]++;
    const classId = spelare.find((p) => p.uid === uid)?.classId;
    const f = sv || (quiz ? { q: Math.floor(rng.tal() * quiz.length) } : { factorA: Math.floor(rng.tal() * 11), factorB: Math.floor(rng.tal() * 11) });
    svarLogg.push({ classId, ...fragaAv(f), ok: ratt });
  };
  const status = () => statusFran(cfg, logg, now());

  /** Serverns beslut (som meteorstorm-core.js beslut): energi, kostnad, nekad. */
  function utfor(p, typ, t, mal = null, sv = null) {
    const l = lank(p.uid);
    const eff = energiEffekt(cfg, t);
    let kostnad = 0;
    let nekad = null;
    let redoMs = null;
    if (typ !== "spara") {
      const ka = kanAgera({ ...cfg, handlingar: logg }, t, p.classId, typ);
      if (!ka.ok) {
        nekad = ka.orsak;
        redoMs = ka.redoMs ?? null;
      } else if (l.energi + eff.energi < ka.kostnad) nekad = "energi";
      else kostnad = ka.kostnad;
    }
    const utfort = nekad ? "spara" : typ;
    l.nr += 1;
    l.energi = Math.min(ENERGI_TAK, l.energi + eff.energi - kostnad);
    l.t = t;
    logg.push({ id: `${p.uid}_${l.nr}`, t, classId: p.classId, uid: p.uid, typ: utfort, ...(utfort === "drag" && mal ? { mal } : {}) });
    rakna(p.uid, true, sv);
    return {
      correct: true, nr: l.nr, typ: utfort, energi: l.energi, vinst: eff.energi, kostnad, handelse: eff.handelse,
      ...(nekad ? { onskad: typ, nekad } : {}), ...(redoMs != null ? { redoMs } : {}),
      effekt: utfort === "skold" || utfort === "laser" ? { [utfort]: effektPerTryck(cfg, p.classId)[utfort] } : null,
    };
  }

  /** De simulerade eleverna fram till nu: 4B ~70 %, 4D ~60 % rätt, ett svar per ~6–11 s. */
  function tick() {
    const t1 = Math.min(now(), slutMs - 1);
    // I tidsordning över alla elever – motorn stegar då bara framåt (billigt vid hopp).
    for (;;) {
      let p = null;
      let t = Infinity;
      for (const [uid, n] of botNasta) if (n < t) { t = n; p = uid; }
      if (!p || t > t1) break;
      const bot = spelare.find((x) => x.uid === p);
      const ratt = rng.tal() < (bot.classId === "4b" ? 0.7 : 0.6);
      if (ratt && t - lank(p).t >= MS_MIN_GAP_MS) {
        const st = simulera({ ...cfg, handlingar: logg }, t).stationer.find((x) => x.classId === bot.classId);
        const r = rng.tal();
        const typ = st.drag.tillaten && !st.drag.armerad && lank(p).energi >= 2 && r < 0.15 ? "drag"
          : st.skold >= 55 ? "laser" : st.laddning >= 9.5 ? "skold" : r < 0.55 ? "skold" : "laser";
        utfor(bot, typ, Math.round(t));
      } else if (!ratt) rakna(p, false);
      botNasta.set(p, t + 6000 + rng.tal() * 5000);
    }
    logg.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  }

  async function call(namn, data) {
    await new Promise((r) => setTimeout(r, Math.max(0, Number(latens()) || 0)));
    tick();
    const t = now();
    const p = spelare.find((x) => x.uid === me.uid);
    const l = lank(me.uid);
    if (namn === "msLage") return { nr: l.nr, energi: l.energi, k: l.k, status: status() };
    if (namn === "msAvsluta") return { result: avsluta(), redan: !!resultat };
    if (namn === "msRatta") {
      const q = quiz?.[data.svar.q];
      const correct = !!q && (data.svar.year != null ? data.svar.year === q.year : data.svar.choiceIndex === q.a);
      if (!correct) rakna(me.uid, false, data.svar);
      return { correct, correctAnswer: q ? q.options?.[q.a] ?? q.year : null, ...(q?.year != null ? { correctYear: q.year } : {}), k: data.svar.k };
    }
    if (namn !== "msAgera") throw fel("not-found", `Okänt anrop ${namn}`);
    if (!data.svar) {
      if (!quiz) for (const f of data.fel || []) rakna(me.uid, false, f);
      return { ok: true, fel: (data.fel || []).length };
    }
    if (t < startMs || t >= slutMs) throw fel("failed-precondition", "Matchen pågår inte.");
    const tidigare = l.svar.get(data.attemptId);
    if (tidigare) return { ...tidigare, igen: true, status: status() };
    const sv = data.svar;
    const ratt = quiz ? true : Number(sv.answer) === sv.factorA * sv.factorB;
    if (!ratt) return { correct: false, correctAnswer: sv.factorA * sv.factorB, k: sv.k };
    if (t - l.t < MS_MIN_GAP_MS) throw fel("resource-exhausted", "Lugn i stormen – ett svar i taget!", { vantaMs: Math.ceil(MS_MIN_GAP_MS - (t - l.t)) });
    if (!HANDLINGAR.includes(data.typ)) throw fel("invalid-argument", "Välj sköld, laser, dragstråle eller spara.");
    if (!quiz) for (const f of data.fel || []) rakna(me.uid, false, f);
    const ut = { ...utfor(p, data.typ, t, data.mal || null, sv), k: sv.k };
    l.k = sv.k;
    l.svar.set(data.attemptId, ut);
    logg.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    return { ...ut, status: status() };
  }

  /** msAvsluta i minnet: motorns slut + elevernas totaler + mynten (som servern – men demo betalar aldrig). */
  function avsluta() {
    if (resultat) return resultat;
    tick();
    const slut = simulera({ ...cfg, handlingar: logg }, slutMs);
    const r = slut.resultat;
    const ranking = spelare.map((p) => {
      const c = raknare.get(p.uid) || { correct: 0, incorrect: 0 };
      const h = Object.fromEntries(HANDLINGAR.map((x) => [x, logg.filter((e) => e.uid === p.uid && e.typ === x).length]));
      return { uid: p.uid, name: p.name, classId: p.classId, correct: c.correct, answered: c.correct + c.incorrect, handlingar: h,
        bidrag: slut.bidrag?.[p.uid] || { skold: 0, laser: 0, drag: 0, nedskjutna: 0, kast: 0 } };
    });
    const plats = (classId) => (r.lage === "en-klass" ? 4 - r.stjarnor : r.placering.find((x) => x.classId === classId)?.plats || 2);
    const rewards = {};
    for (const row of ranking) {
      if (!row.answered) continue;
      const prize = placementPrize(session.rewards.firstPrize, plats(row.classId));
      const correctCoins = perCorrectCoins(row.correct, session.rewards.perCorrect, session.rewards.cap);
      rewards[row.uid] = { rank: plats(row.classId), correct: row.correct, prize, correctCoins, total: prize + correctCoins };
    }
    const perClass = Object.fromEntries(slut.stationer.map((x) => [x.classId, {
      name: classNames[x.classId], players: ranking.filter((p) => p.classId === x.classId && p.answered).length, aktiva: x.aktiva,
      skrov: x.skrov, skold: x.skold, nedskjutna: x.nedskjutna, traffar: x.traffar, kastade: x.kastade,
      handlingar: Object.fromEntries(HANDLINGAR.map((h) => [h, logg.filter((e) => e.classId === x.classId && e.typ === h).length])),
      correct: ranking.filter((p) => p.classId === x.classId).reduce((n, p) => n + p.correct, 0),
      ogonblick: ogonblick(ranking.filter((p) => p.classId === x.classId)),
    }]));
    const per = new Map();
    for (const a of svarLogg) {
      const row = per.get(a.key) || per.set(a.key, { key: a.key, text: a.text, statKeys: a.statKeys, answered: 0, correct: 0, byClass: {} }).get(a.key);
      const b = (row.byClass[a.classId] ||= { answered: 0, correct: 0 });
      row.answered++;
      b.answered++;
      if (a.ok) { row.correct++; b.correct++; }
    }
    const perQuestion = [...per.values()].sort((a, b) => (a.key < b.key ? -1 : 1)).map((r, index) => ({ index, ...r }));
    resultat = {
      format: "meteorstorm", lage: r.lage, winner: r.vinnare, draw: r.oavgjort, placering: r.placering,
      ...(r.lage === "en-klass" ? { stjarnor: r.stjarnor, overlevde: r.overlevde } : {}),
      startMs, slutMs, players: ranking.filter((p) => p.answered).length,
      totalCorrect: ranking.reduce((n, p) => n + p.correct, 0), totalAnswered: ranking.reduce((n, p) => n + p.answered, 0),
      handlingar: Object.fromEntries(HANDLINGAR.map((x) => [x, logg.filter((e) => e.typ === x).length])), nekade: 0,
      perClass, ranking, perQuestion, rewards,
    };
    return resultat;
  }

  /** Bästa ögonblicken (bara det som är bra): flest nedskjutna, flest sköldtryck, flest kast. */
  function ogonblick(rader) {
    const bast = (f) => rader.filter((r) => f(r) > 0).sort((a, b) => f(b) - f(a) || (a.uid < b.uid ? -1 : 1))[0];
    const ut = [];
    for (const [typ, f] of [["nedskjutna", (r) => r.bidrag.nedskjutna], ["skold", (r) => r.handlingar.skold], ["kast", (r) => r.bidrag.kast]]) {
      const b = bast(f);
      if (b) ut.push({ typ, uid: b.uid, namn: b.name, antal: f(b) });
    }
    return ut;
  }

  function skapaStatusvakt(_sid, cb) {
    let senast = 0;
    let stoppad = false;
    const fran = (s) => { if (s && !stoppad) { senast = Date.now(); cb(s); } };
    const iv = setInterval(() => { if (!stoppad && Date.now() - senast >= statusMs) { tick(); fran(status()); } }, 500);
    tick();
    fran(status());
    return { fran, stop() { stoppad = true; clearInterval(iv); } };
  }

  const api = {
    skapaKlient: (opts) => createMsKlient({ ...opts, call, lagring: null, vanta: (ms) => new Promise((r) => setTimeout(r, ms)) }),
    skapaStatusvakt,
    getQuestions: async () => (quiz || []).map(({ text, options }) => ({ text, options })),
    avsluta: async () => ({ result: avsluta() }),
  };

  function st(phase = null) {
    const t = now();
    const ph = phase || (t < startMs ? "lobby" : t < slutMs ? "live" : "ended");
    const kvar = Math.max(0, slutMs - t);
    const clock = `${Math.floor(kvar / 60_000)}:${String(Math.floor((kvar % 60_000) / 1000)).padStart(2, "0")}`;
    return { phase: ph, session, clock, msLeft: kvar, now: t, result: ph === "ended" || ph === "finished" ? resultat : null };
  }

  return {
    session, api, now, st, tick, status, avsluta,
    handlingar: () => logg.map((h) => ({ ...h })),
    result: () => resultat,
    hoppa(ms) { hopp += Math.max(0, ms); tick(); },
    snartSlut(sek = 20) { hopp += Math.max(0, slutMs - sek * 1000 - now()); tick(); },
    tillHandelse() {
      const rel = now() - startMs;
      const h = stormPlan(cfg).handelser.find((x) => x.startMs > rel);
      if (h) { hopp += h.startMs - rel + 200; tick(); }
      return h ? h.typ : null;
    },
    spelare: () => spelare.map((p) => ({ ...p })),
  };
}
