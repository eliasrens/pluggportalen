// ============================================================================
// Kurragömma 🙈 (#839, spec §11.4, LIVE-FORMAT §8): LÅTSASSERVERN i demoläget –
// samma beslut som functions/kurragomma-core.js/-fas.js/-tick.js/-resultat.js,
// men i minnet: rollerna, gömställena, rättningen, visslingarna, sökningen,
// tystnadsregeln, "det finns alltid en sökare", slutet och resultatet (med
// result.rewards som servern – demot betalar ändå aldrig, sessionen är demo: true).
// Reglerna är de RIKTIGA (delat/kg-regler.js, kg-geometri.js); rörelsekanalen är
// den lokala bussen (kg-kanal.js skapaLokalBuss) som demots "server" skriver
// roll/med/pos/handelse/status i. Ingen Firestore, inga Cloud Functions.
// Bara kg-demo.js (demot), förhandsvisningarna och testerna laddar den.
//
//   skapaKgServer({ session, buss, now, rng, quiz?, latens? }) → server
//     session   demots sessionsdokument (muteras: kgFas, kgGomSlut, kgLetStart, status, result)
//     server.laggTill({ uid, name, classId })      en elev i players (lobbyn)
//     server.starta() · anslut(uid) · las(uid, p) · svara(uid, payload) · leta(uid, p)
//     server.tick() · avsluta() · getQuestions() · watchMe(uid, cb) → av
//     server.tystnadNu(uid?) · sokareBorta(bool) · hittaNu(gomda?, sokareUid?)   demoknapparna
//     tvingaSokare: uids som ska bli startsökare (demots "jag är sökare")
//     server.state() → { fas, spelare: [kgPlayers], secrets, events, status }
//   Fel kastas som { code, message, details? } (som KgError).
// ============================================================================

import { toMs } from "../../live-time.js";
import {
  rollVidAnslutning, laddningarNySokare, laddningarVidLetStart, svarsEffekt, visslingsplats, kontrolleraSokning, sok,
  poangForHittad, poangVidHittad, missFlodeTillats, tystnadVisslar, behoverNySokare, valjSlumpade,
  antalStartsokare, arSlut, normInstallningar,
} from "./delat/kg-regler.js";
import { byggDemoResultat } from "./kg-demo-resultat.js";
import { narmasteGiltiga, skydd, platsNamn, gomstalleNaraForemal } from "./delat/kg-geometri.js";
import { hamtaKarta } from "./delat/kg-karta.js";
import { LAS_MARGINAL_MS, LETA_SPARR_MS, TYSTNAD_MS, FRANKOPPLAD_MS } from "./delat/kg-config.js";

const fel = (code, message, details) => Object.assign(new Error(message), { code, ...(details ? { details } : {}) });
const SOK_FEL = {
  "inte-sokare": ["failed-precondition", "Bara sökare letar."],
  "ingen-laddning": ["failed-precondition", "Svara rätt för att ladda ficklampan."],
  sparr: ["resource-exhausted", "Vänta lite mellan sökningarna."],
  utanfor: ["invalid-argument", "Platsen ligger utanför ön."],
  orimlig: ["failed-precondition", "Du kan inte ha hunnit dit."],
};

export function skapaKgServer({ session, buss, now, rng, quiz = null, latens = () => 0, tvingaSokare = [] }) {
  const inst = normInstallningar(session.kgInstallningar);
  const karta = hamtaKarta(inst.karta);
  const players = new Map(); // uid → { uid, name, classId } (kärnans players)
  const kp = new Map(); // uid → kgPlayers-dokumentet
  const sec = new Map(); // uid → kgSecret
  const answers = new Map(); // attemptId → svarsdokumentet
  const events = [];
  const watchers = new Map(); // uid → Set(cb)
  let placerade = false;
  let nySokareAt = 0;
  let sokareBorta = false;

  const namnFor = (n) => (session.showNames === false ? null : String(n || "") || null);
  const tider = () => {
    const start = toMs(session.startedAt);
    const t0 = start == null ? null : start + (Number(session.countdownSeconds) || 0) * 1000;
    return { t0, gomSlut: toMs(session.kgGomSlut), letStart: toMs(session.kgLetStart), slut: t0 == null ? null : t0 + (Number(session.durationSeconds) || 0) * 1000 };
  };
  const vanta = () => new Promise((r) => setTimeout(r, Math.max(0, Number(latens()) || 0)));
  const rora = (uid) => { for (const cb of watchers.get(uid) || []) cb({ ...kp.get(uid) }); };
  const gomdaKvar = () => [...kp.values()].filter((p) => p.roll === "gomd").length;
  const spelareDoc = (p, roll, nu) => ({
    uid: p.uid, classId: p.classId, name: String(p.name || ""), roll, poang: 0, ratt: 0, besvarade: 0, hittade: 0,
    laddningar: 0, harLast: false, senastSvarAt: null, sokareSedan: roll === "sokare" ? nu : null, ...(roll === "gomd" ? { tystRef: 0 } : {}),
  });

  /** Den gömda blir sökare (hittad eller vald av regeln): kgPlayers, kgSecret, bussen. */
  function gorTillSokare(uid, nu, { hittadAv = null, hittadAvNamn = null } = {}) {
    const p = kp.get(uid);
    const s = sec.get(uid) || {};
    const x = Number(s.x) || 0;
    const z = Number(s.z) || 0;
    const { letStart } = tider();
    Object.assign(p, {
      roll: "sokare", laddningar: laddningarNySokare(), sokareSedan: nu, poang: (p.poang | 0) + poangVidHittad({ letStartAt: letStart ?? nu, hittadAt: nu }),
      ...(hittadAv ? { hittadAv, hittadAvNamn, hittadAt: nu } : { nySokareAt: nu }),
    });
    delete p.tystRef; delete p.tystVissladAt;
    sec.set(uid, { ...s, gomd: false, startpunkt: { x, z, at: nu }, senasteSok: null });
    buss.server.roll(uid, "sokare");
    buss.server.pos(uid, { x, z, yaw: 0 });
    buss.server.status({ gomda: gomdaKvar(), sokare: [...kp.values()].filter((q) => q.roll === "sokare").length });
    rora(uid);
    return { x, z, plats: platsNamn(x, z, karta) };
  }

  // --- starten och fasbytet (kurragomma-fas.js) -------------------------------------
  function starta() {
    if (session.kgFas) return;
    const { t0 } = tider();
    if (session.status !== "live" || t0 == null) throw fel("failed-precondition", "Matchen har inte startat.");
    const uids = [...players.keys()].sort();
    const antal = antalStartsokare(uids.length, inst.startsokare);
    const tvingade = tvingaSokare.filter((u) => players.has(u)).slice(0, antal);
    const sokare = new Set([...tvingade, ...valjSlumpade(uids.filter((u) => !tvingade.includes(u)), antal - tvingade.length, rng)]);
    session.kgFas = "gom";
    session.kgGomSlut = t0 + inst.gomtid * 1000;
    for (const uid of uids) {
      const roll = sokare.has(uid) ? "sokare" : "gomd";
      kp.set(uid, spelareDoc(players.get(uid), roll, t0));
      buss.server.roll(uid, roll);
      buss.server.med(uid);
      if (roll === "sokare") {
        sec.set(uid, { gomd: false, startpunkt: { ...karta.sokarStart, at: t0 }, senasteSok: null, senastVisslingAt: null });
        buss.server.pos(uid, { ...karta.sokarStart, yaw: 0 });
      }
      rora(uid);
    }
    buss.server.status({ fas: "gom", lasta: 0, gomda: uids.length - sokare.size, sokare: sokare.size });
  }
  function bytTillLeta() {
    const { gomSlut } = tider();
    if (session.kgFas !== "gom" || gomSlut == null || now() < gomSlut) return;
    session.kgFas = "leta";
    session.kgLetStart = gomSlut;
    for (const p of kp.values()) {
      if (p.roll !== "sokare" || p.letStartGjord) continue;
      p.laddningar = laddningarVidLetStart(p.laddningar);
      p.letStartGjord = true;
      rora(p.uid);
    }
    buss.server.status({ fas: "leta" });
  }
  function placeraOlasta() {
    const { gomSlut, letStart } = tider();
    if (session.kgFas !== "leta" || placerade || gomSlut == null || now() < gomSlut + LAS_MARGINAL_MS) return;
    let lasta = 0;
    for (const p of kp.values()) {
      if (p.roll !== "gomd" || p.harLast) continue;
      const plats = gomstalleNaraForemal(karta, rng);
      const gomstalle = { ...plats, skydd: skydd(plats.x, plats.z, karta), namn: platsNamn(plats.x, plats.z, karta) };
      sec.set(p.uid, { ...(sec.get(p.uid) || {}), ...plats, skydd: gomstalle.skydd, gomd: true, lastAt: letStart, senastVisslingAt: null, auto: true, gomstalle });
      Object.assign(p, { harLast: true, autoPlacerad: true });
      lasta++;
      rora(p.uid);
    }
    placerade = true;
    if (lasta) buss.server.status({ lasta: (buss.server.tillstand.status?.lasta || 0) + lasta });
  }
  function redo() {
    if (!session.kgFas) starta();
    if (session.kgFas === "gom") bytTillLeta();
    if (session.kgFas === "leta" && !placerade) placeraOlasta();
  }
  function assertLive() {
    const { slut } = tider();
    if (session.status !== "live" || slut == null || now() >= slut) throw fel("failed-precondition", "Matchen pågår inte.");
  }
  const spelare = (uid) => kp.get(uid) || (() => { throw fel("failed-precondition", "Anslut till matchen först."); })();

  // --- anropen (kurragomma-core.js) -------------------------------------------------
  async function anslut(uid) {
    await vanta();
    redo();
    if (!players.has(uid)) throw fel("permission-denied", "Du är inte med i matchen.");
    const nu = now();
    let p = kp.get(uid);
    if (!p) {
      const roll = rollVidAnslutning(session.kgFas);
      p = { ...spelareDoc(players.get(uid), roll, nu), ...(roll === "sokare" ? { laddningar: laddningarNySokare(), letStartGjord: true } : {}) };
      kp.set(uid, p);
      buss.server.roll(uid, roll);
      buss.server.med(uid);
      if (roll === "sokare") {
        sec.set(uid, { gomd: false, startpunkt: { ...karta.sokarStart, at: nu }, senasteSok: null, senastVisslingAt: null });
        buss.server.pos(uid, { ...karta.sokarStart, yaw: 0 });
      }
      buss.server.status({ gomda: gomdaKvar(), sokare: [...kp.values()].filter((q) => q.roll === "sokare").length });
      rora(uid);
    }
    const s = sec.get(uid);
    const { t0, gomSlut, letStart, slut } = tider();
    return {
      roll: p.roll, fas: session.kgFas, laddningar: p.laddningar | 0, poang: p.poang | 0, ratt: p.ratt | 0, besvarade: p.besvarade | 0,
      harLast: !!p.harLast, gomstalle: p.roll === "gomd" && p.harLast ? s?.gomstalle || null : null,
      start: p.roll === "sokare" ? { x: s?.startpunkt?.x ?? karta.sokarStart.x, z: s?.startpunkt?.z ?? karta.sokarStart.z } : null,
      nextQ: p.nextQ ?? null, hittadAvNamn: p.hittadAvNamn ?? null, tider: { t0, gomSlut, letStart, slut }, inst, showNames: session.showNames !== false,
    };
  }

  async function las(uid, raw) {
    await vanta();
    redo();
    const nu = now();
    const { gomSlut } = tider();
    if (session.status !== "live" || gomSlut == null) throw fel("failed-precondition", "Matchen pågår inte.");
    if (nu >= gomSlut + LAS_MARGINAL_MS) throw fel("failed-precondition", "Gömfasen är slut.");
    const p = spelare(uid);
    if (p.roll !== "gomd") throw fel("failed-precondition", "Bara gömmare låser ett gömställe.");
    if (p.harLast) return { gomstalle: sec.get(uid)?.gomstalle || null, flyttad: false, redan: true };
    const x = Number(raw?.x) || 0;
    const z = Number(raw?.z) || 0;
    const g = narmasteGiltiga(x, z, karta);
    const gomstalle = { x: g.x, z: g.z, skydd: skydd(g.x, g.z, karta), namn: platsNamn(g.x, g.z, karta) };
    sec.set(uid, { x: g.x, z: g.z, skydd: gomstalle.skydd, gomd: true, lastAt: nu, senastVisslingAt: null, gomstalle });
    Object.assign(p, { harLast: true, tystRef: tider().letStart ?? 0 });
    buss.server.status({ lasta: (buss.server.tillstand.status?.lasta || 0) + 1 });
    rora(uid);
    return { gomstalle, flyttad: Math.hypot(g.x - x, g.z - z) > 1e-9, redan: false };
  }

  /** Rättningen: multiplikation a·b, quiz ur frågelistan ({ options, answerIndex } | { kind: "timeline", year }). */
  function ratta(raw) {
    if (quiz) {
      const q = quiz[raw?.q];
      if (!q) throw fel("invalid-argument", "Ogiltig fråga.");
      if (q.kind === "timeline") return { isCorrect: Number(raw.year) === q.year, correctAnswer: String(q.year), correctYear: q.year, q: raw.q };
      return { isCorrect: raw?.choiceIndex === q.answerIndex, correctAnswer: String(q.options[q.answerIndex]), q: raw.q };
    }
    const a = Number(raw?.factorA);
    const b = Number(raw?.factorB);
    if (!Number.isInteger(a) || !Number.isInteger(b)) throw fel("invalid-argument", "Ogiltig fråga.");
    return { isCorrect: Number(raw?.answer) === a * b, correctAnswer: String(a * b) };
  }

  async function svara(uid, raw) {
    await vanta();
    redo();
    const nu = now();
    assertLive();
    const p = spelare(uid);
    const attemptId = String(raw?.attemptId || "");
    if (!attemptId) throw fel("invalid-argument", "attemptId saknas.");
    if (p.roll === "gomd" && session.kgFas !== "leta") throw fel("failed-precondition", "Inga frågor under gömfasen – göm dig!");
    const redan = answers.get(attemptId);
    if (redan) {
      if (redan.uid !== uid) throw fel("already-exists", "Svaret finns redan.");
      return { igen: true, attemptId, correct: redan.isCorrect, correctAnswer: redan.correctAnswer, nextQ: p.nextQ ?? null, poang: p.poang | 0, laddningar: p.laddningar | 0, vissling: false };
    }
    const g = ratta(raw);
    const nextQ = quiz ? (g.q + 1 + Math.floor(rng() * Math.max(1, quiz.length - 1))) % quiz.length : null;
    const s = sec.get(uid);
    const eff = svarsEffekt({ roll: p.roll, ratt: g.isCorrect, fas: session.kgFas, laddningar: p.laddningar | 0, senastVisslingAt: s?.senastVisslingAt ?? null, nu });
    answers.set(attemptId, { uid, isCorrect: g.isCorrect, correctAnswer: g.correctAnswer, at: nu });
    Object.assign(p, {
      poang: (p.poang | 0) + eff.poang, laddningar: eff.laddningar, ratt: (p.ratt | 0) + (g.isCorrect ? 1 : 0), besvarade: (p.besvarade | 0) + 1,
      senastSvarAt: nu, ...(p.roll === "gomd" ? { tystRef: nu } : {}), ...(nextQ != null ? { nextQ } : {}),
    });
    let vissling = null;
    if (eff.vissling && s?.gomd === true) vissling = vissla(uid, nu);
    rora(uid);
    return {
      attemptId, correct: g.isCorrect, correctAnswer: g.correctAnswer, nextQ, poang: p.poang, laddningar: p.laddningar,
      vissling: !!vissling, ...(vissling ? { plats: vissling.plats } : {}), ...(g.correctYear != null ? { correctYear: g.correctYear } : {}),
    };
  }
  /** En vissling vid den gömdas ungefärliga plats – aldrig uid/namn i händelsen (§1.5). */
  function vissla(uid, nu, tyst = false) {
    const s = sec.get(uid);
    const pl = visslingsplats(s.x, s.z, rng(), rng(), karta);
    s.senastVisslingAt = nu;
    const ev = { typ: "vissling", x: pl.x, z: pl.z, plats: platsNamn(pl.x, pl.z, karta), t: nu };
    events.push({ ...ev, ...(tyst ? { tyst: true } : {}) });
    buss.server.handelse(ev);
    return ev;
  }

  /** Sökningen – träffarna blir sökare; hittade = [{ uid, namn, x, z, plats }]. */
  function hitta(uid, traff, nu, { x, z }) {
    const p = kp.get(uid);
    const hittade = [];
    for (const h of traff) {
      const hp = kp.get(h);
      if (!hp || hp.roll !== "gomd") continue;
      const pl = gorTillSokare(h, nu, { hittadAv: uid, hittadAvNamn: namnFor(p.name) });
      events.push({ t: nu, typ: "hittad", x: pl.x, z: pl.z, plats: pl.plats, sokare: uid, hittad: h });
      hittade.push({ uid: h, namn: namnFor(hp.name), ...pl });
    }
    p.hittade = (p.hittade | 0) + hittade.length;
    p.poang = (p.poang | 0) + poangForHittad() * hittade.length;
    for (const h of hittade) buss.server.handelse({ typ: "hittad", x: h.x, z: h.z, plats: h.plats, t: nu, namn: namnFor(p.name), hittad: h.namn });
    return { hittade, plats: platsNamn(x, z, karta) };
  }
  async function leta(uid, raw) {
    await vanta();
    redo();
    const nu = now();
    assertLive();
    if (session.kgFas !== "leta") throw fel("failed-precondition", "Sökarna blundar – vänta tills gömfasen är slut.");
    const p = spelare(uid);
    const s = sec.get(uid) || {};
    const x = Number(raw?.x) || 0;
    const z = Number(raw?.z) || 0;
    const k = kontrolleraSokning({ roll: p.roll, laddningar: p.laddningar | 0, x, z, nu, senasteSok: s.senasteSok || null, startpunkt: s.startpunkt || null, karta });
    if (!k.ok) {
      const [code, msg] = SOK_FEL[k.skal];
      throw fel(code, msg, { skal: k.skal, ...(k.skal === "sparr" ? { vantaMs: LETA_SPARR_MS - (nu - s.senasteSok.at) } : {}) });
    }
    const gomda = [...sec.entries()].filter(([u, d]) => u !== uid && d.gomd === true).map(([u, d]) => ({ uid: u, ...d }));
    const { hittade, plats } = hitta(uid, sok({ x, z, nu }, gomda, karta), nu, { x, z });
    const flode = hittade.length === 0 && missFlodeTillats(s.senastMissFlodeAt, nu);
    p.laddningar = (p.laddningar | 0) - 1;
    sec.set(uid, { ...s, senasteSok: { x, z, at: nu }, ...(flode ? { senastMissFlodeAt: nu } : {}) });
    rora(uid);
    if (flode) buss.server.handelse({ typ: "miss", x, z, plats, t: nu, namn: namnFor(p.name) });
    return { hittade, flode, laddningar: p.laddningar, poang: p.poang, plats };
  }

  // --- kgTick (kurragomma-tick.js) -----------------------------------------------------
  function tystnad(nu) {
    const { letStart } = tider();
    let n = 0;
    for (const p of kp.values()) {
      const s = sec.get(p.uid);
      if (p.roll !== "gomd" || !s?.gomd || (Number(p.tystRef) || 0) >= nu - TYSTNAD_MS) continue;
      const pulsAt = buss.server.tillstand.med[p.uid] ? nu : null; // alla anslutna pulsar i demot
      const letStartAt = p.tvingadTystAt ?? letStart; // demoknappen "Tystnad": bara den här räknas som tyst
      if (!tystnadVisslar({ roll: p.roll, fas: session.kgFas, tystnadPa: true, senastSvarAt: p.senastSvarAt, senastVisslingAt: s.senastVisslingAt, letStartAt, pulsAt, nu })) {
        p.tystRef = Math.max(Number(p.senastSvarAt) || 0, Number(s.senastVisslingAt) || 0, letStart || 0, Number(p.tystRef) || 0);
        continue;
      }
      p.tystRef = nu; p.tystVissladAt = nu; // före händelsen: referensen får gärna vara på plats när hand-visslingen kommer
      delete p.tvingadTystAt;
      rora(p.uid);
      vissla(p.uid, nu, true);
      n++;
    }
    return n;
  }
  function alltidEnSokare(nu) {
    const pos = buss.server.tillstand.pos;
    const sokare = [...kp.values()].filter((p) => p.roll === "sokare").map((p) => ({ pulsAt: sokareBorta ? null : pos[p.uid]?.t ?? null }));
    if (!behoverNySokare({ fas: session.kgFas, sokare, gomdaKvar: gomdaKvar(), nu }) || nu - nySokareAt < FRANKOPPLAD_MS) return null;
    const [vald] = valjSlumpade([...kp.values()].filter((p) => p.roll === "gomd").map((p) => p.uid).sort(), 1, rng);
    if (!vald) return null;
    nySokareAt = nu;
    const namn = namnFor(kp.get(vald).name);
    const pl = gorTillSokare(vald, nu);
    events.push({ t: nu, typ: "nySokare", x: pl.x, z: pl.z, plats: pl.plats, sokare: vald });
    buss.server.handelse({ typ: "nySokare", x: pl.x, z: pl.z, plats: pl.plats, t: nu, namn });
    return vald;
  }
  async function tick() {
    if (session.status !== "live") return { fas: session.kgFas, klart: true, result: session.result || null };
    redo();
    const nu = now();
    const { slut } = tider();
    const kvar = session.kgFas === "leta" ? gomdaKvar() : null;
    if (arSlut({ fas: session.kgFas, nu, slutAt: slut, gomdaKvar: kvar })) return { fas: session.kgFas, klart: true, result: (await avsluta()).result };
    const ut = { fas: session.kgFas, klart: false, visslade: 0, nySokare: null };
    if (session.kgFas === "leta") {
      if (inst.tystnad) ut.visslade = tystnad(nu);
      ut.nySokare = alltidEnSokare(nu);
    }
    return ut;
  }

  // --- slutet (kurragomma-resultat.js byggResultat) -------------------------------------
  async function avsluta() {
    if (session.result) return { result: session.result, redan: true };
    const { t0, letStart, slut } = tider();
    if (t0 == null) throw fel("failed-precondition", "Matchen har inte startat.");
    const nu = now();
    if (session.status !== "finished") { session.status = "finished"; session.finishedAt = nu; }
    const { result, totaler } = byggDemoResultat({ session, spelare: [...kp.values()], secrets: sec, events, t0, letStart, slut: Math.min(slut, nu) });
    session.result = result;
    for (const [uid, tot] of Object.entries(totaler)) { Object.assign(kp.get(uid), tot); rora(uid); }
    return { result, redan: false };
  }

  return {
    laggTill(p) { if (!players.has(p.uid)) players.set(p.uid, { uid: p.uid, name: p.name, classId: p.classId }); },
    starta: async () => { await vanta(); starta(); return { fas: session.kgFas, tider: tider() }; },
    anslut, las, svara, leta, tick, avsluta,
    async getQuestions() { return (quiz || []).map(({ answerIndex, year, ...q }) => q); },
    watchMe(uid, cb) {
      const set = watchers.get(uid) || watchers.set(uid, new Set()).get(uid);
      set.add(cb);
      setTimeout(() => { if (set.has(cb)) cb(kp.has(uid) ? { ...kp.get(uid) } : null); }, 0);
      return () => set.delete(cb);
    },
    /** Demoknappen "Tystnad": den gömda (eller en slumpad) räknas som tyst sedan TYSTNAD_MS – nästa tick visslar. */
    tystnadNu(uid = null) {
      const g = uid ? kp.get(uid) : [...kp.values()].filter((p) => p.roll === "gomd" && sec.get(p.uid)?.gomd).sort((a, b) => a.uid.localeCompare(b.uid))[0];
      if (!g || g.roll !== "gomd") return null;
      g.tystRef = now() - TYSTNAD_MS - 1;
      g.senastSvarAt = null;
      g.tvingadTystAt = now() - TYSTNAD_MS - 1;
      if (sec.get(g.uid)) sec.get(g.uid).senastVisslingAt = null;
      return g.uid;
    },
    /** Demoknappen "Sökarna försvinner": inga pulser → regeln "det finns alltid en sökare" i nästa tick. */
    sokareBorta(v) { sokareBorta = !!v; if (v) nySokareAt = 0; },
    /** Demoknapparna "Hittad"/"Alla hittade": sökaren (eller den första) hittar de gömda (alla om listan saknas) nu. */
    hittaNu(gomda = null, sokareUid = null) {
      const nu = now();
      const s = sokareUid && kp.get(sokareUid)?.roll === "sokare" ? kp.get(sokareUid) : [...kp.values()].find((p) => p.roll === "sokare" && p.uid !== sokareUid);
      if (!s || session.kgFas !== "leta") return [];
      const lista = [...sec.entries()].filter(([u, d]) => u !== s.uid && d.gomd === true && (!gomda || gomda.includes(u))).map(([u]) => u);
      return hitta(s.uid, lista, nu, { x: 0, z: 0 }).hittade;
    },
    state: () => ({ fas: session.kgFas || null, spelare: [...kp.values()].map((p) => ({ ...p })), secrets: Object.fromEntries(sec), events: events.slice(), status: buss.server.tillstand.status, players: [...players.values()] }),
    get karta() { return karta; },
    get inst() { return inst; },
  };
}
