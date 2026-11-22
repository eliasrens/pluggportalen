// ============================================================================
// Matchdagen på SERVERN – vänskapsmatchen, lägena (functions/md-vanskap-spel.js, #874)
// ----------------------------------------------------------------------------
// Spec §11.3–11.4. Varje läge: servern har skapat läget (fas.nr, fas.start) och motorn
// (md-vanskap.js vLage) säger vem som anfaller. Var och en av eleverna:
//   fraga  { matchId, val } → väljer sitt drag och får lägets fråga ur SIN bank i sitt
//          privata dokument (utan facit). Samma läge igen = samma fråga (idempotent).
//   svar   { matchId, svar } → (svar = null: elevens klocka tog slut – räknas som fel) servern rättar (md-vanskap-fragor.js ratta: Live:s rättning) och
//          svarar { ratt, facit }. När båda har svarat – eller den andras tid är ute – avgörs
//          läget med motorn och resultatet skrivs till matchdokumentet (båda lyssnar).
//   tick   { matchId, redo? } → klienten anropar när en tid gått ut: lägen vars tid är ute avgörs
//          (uteblivet svar = fel, inget val = standardvalet), halvtiden tar slut (båda redo eller
//          VANSKAP.halvtid s), och den som inte gjort något på VANSKAP.inaktiv s förlorar på walkover.
//   geUpp  { matchId } → walkover direkt (eleven lämnar matchen).
// Mattematchen (#879): ett besvarat multiplikationsläge (inte tiden ute) räknas i elevens aktiva
// Mattematch – mmLiveWrites (mattematchen-live.js) i svarets transaktion, som Live (#847). Svaret
// sparas i samma transaktion och ett omförsök svarar ur det → aldrig dubbelt. Inga mynt.
// EN transaktion per anrop (snabbTx: en krock med den andra spelaren görs om direkt, #895). Slutet (avsluta) skriver i samma transaktion: matchdokumentet,
// båda elevernas spärr och dagsräkning (mdVanskapElev), kassan och de inbördes mötena
// (matchdagen/{uid}, FieldValue.increment) och matchen i båda elevernas matcher (typ "vanskap").
// ============================================================================

import { VANSKAP } from "./matchdagen/md-config.js";
import { SIDOR, kassaFor, inaktivUtfall, motsida, vAndraHalvlek, vLage, vResultat, vSpela, vWalkover } from "./matchdagen/md-vanskap.js";
import { dagNyckel } from "./matchdagen/md-sasong.js";
import { ratta } from "./md-vanskap-fragor.js";
import { mmForLive, mmLiveWrites } from "./mattematchen-live.js";
import { MdFel, ctx, elevRef, facitRef, idEller, karriarRef, lobbyRef, matchRef, privatRef, snabbTx } from "./md-vanskap-state.js";

export { MdFel, snabbTx };

export const sidaFor = (m, uid) => (m.a === uid ? "a" : m.b === uid ? "b" : null);
/** När sidans tid i läget är ute (ms): lägets start + elevens sekunder + animationen. */
export const deadline = (m, s) => m.fas.start + ((Number(m.tid?.[s]) || VANSKAP.tid) + VANSKAP.anim) * 1000;
const klar = (m, p) => p?.fas === m.fas?.nr && p.svar != null;
const kanLosas = (m, P, nu) => SIDOR.every((s) => klar(m, P[s]) || nu >= deadline(m, s));
const svarFor = (m, p) => (p?.fas === m.fas.nr ? { val: p.val, ratt: p.svar?.ratt === true, kalla: p.kalla } : {});

async function lasMatch(c, tx, matchId, uid) {
  const snap = await tx.get(matchRef(c, matchId));
  if (!snap.exists) throw new MdFel("not-found", "Matchen finns inte.");
  const m = snap.data();
  if (uid != null && !sidaFor(m, uid)) throw new MdFel("permission-denied", "Du spelar inte i den matchen.");
  return m;
}
async function lasPrivata(c, tx, matchId, m) {
  const [a, b] = await Promise.all([tx.get(privatRef(c, matchId, m.a)), tx.get(privatRef(c, matchId, m.b))]);
  return { a: a.exists ? a.data() : null, b: b.exists ? b.data() : null };
}
const pagar = (m) => {
  if (m.status !== "pagar") throw new MdFel("failed-precondition", "Matchen är slut.");
};

/**
 * Matchen framåt så långt serverns klocka tillåter: walkover, halvtidens slut eller lägets
 * avgörande. P = båda privata dokumenten (med anroparens nya svar). Läser (vid slutet) före
 * skrivningar och skriver matchdokumentet om något ändrats.
 */
async function stega(c, tx, matchId, m, P, nu, { redo = null } = {}) {
  const aktiv = Object.fromEntries(SIDOR.map((s) => [s, Math.max(Number(P[s]?.aktiv) || 0, Number(m.skapad) || 0, s === redo ? nu : 0)]));
  const ina = inaktivUtfall(aktiv, nu);
  if (ina) return avsluta(c, tx, matchId, m, ina === "avbruten" ? { typ: "avbruten" } : { typ: "walkover", forlorare: ina }, nu);
  let ny = null;
  if (m.halvtid) {
    const r = { ...m.halvtid.redo, ...(redo ? { [redo]: true } : {}) };
    if ((r.a && r.b) || nu >= m.halvtid.start + VANSKAP.halvtid * 1000) {
      ny = { V: vAndraHalvlek(m.V), halvtid: null, fas: { nr: m.fas.nr, start: nu } };
    } else if (redo && !m.halvtid.redo?.[redo]) ny = { halvtid: { ...m.halvtid, redo: r } };
  } else if (kanLosas(m, P, nu)) {
    const { V, h } = vSpela(m.V, { a: svarFor(m, P.a), b: svarFor(m, P.b) }, c.rng);
    ny = { V, h, fas: { nr: m.fas.nr + 1, start: nu }, ...(V.halvtid ? { halvtid: { start: nu, redo: { a: false, b: false } } } : {}) };
    if (V.slut) return avsluta(c, tx, matchId, { ...m, ...ny }, { typ: "slut" }, nu);
  }
  if (!ny) return m;
  tx.update(matchRef(c, matchId), { ...ny, uppdaterad: nu });
  return { ...m, ...ny };
}

/** Den sista matchminuten som en verklig tid: sekunderna sedan avspark (högst 10 h, som solospelet). */
const sekunder = (m, nu) => Math.min(36000, Math.max(0, Math.round((nu - (Number(m.skapad) || nu)) / 1000)));

/**
 * Slutet (§11.4): { typ: "slut" } | { typ: "walkover", forlorare } | { typ: "avbruten" } (båda borta –
 * inget resultat, ingen kassa, inga inbördes möten). Kassan: kassaFor för högst VANSKAP.kassa.perDag
 * matcher per dag och elev; den som förlorar på walkover får ingen deltagarpeng.
 */
export async function avsluta(c, tx, matchId, m, slut, nu) {
  const uid = { a: m.a, b: m.b };
  const [ea, eb, ka, kb, lob] = await Promise.all([
    tx.get(elevRef(c, m.a)), tx.get(elevRef(c, m.b)), tx.get(karriarRef(c, m.a)), tx.get(karriarRef(c, m.b)), tx.get(lobbyRef(c, m.classId)),
  ]);
  const elev = { a: ea.exists ? ea.data() : {}, b: eb.exists ? eb.data() : {} };
  const K = { a: ka.exists ? ka.data() : null, b: kb.exists ? kb.data() : null };
  const V = slut.typ === "walkover" ? vWalkover(m.V, slut.forlorare) : m.V;
  const res = slut.typ === "avbruten" ? null : vResultat(V);
  const dag = dagNyckel(nu);
  const kassa = { a: 0, b: 0 };
  const { FieldValue } = c;
  for (const s of SIDOR) {
    const o = motsida(s);
    const idag = elev[s].dag === dag ? Number(elev[s].antal) || 0 : 0;
    if (res && res.walkover !== s) kassa[s] = kassaFor(res.vinnare === s, idag);
    tx.set(elevRef(c, uid[s]), { aktiv: elev[s].aktiv === matchId ? null : elev[s].aktiv ?? null, dag, antal: idag + (res ? 1 : 0) });
    if (!res || !K[s]) continue;
    const vof = res.vinnare === s ? "v" : res.vinnare === o ? "f" : "o";
    tx.update(karriarRef(c, uid[s]), {
      kassa: FieldValue.increment(kassa[s]),
      [`inbordes.${uid[o]}.${vof}`]: FieldValue.increment(1),
      [`inbordes.${uid[o]}.namn`]: String(m.V.lag[o].namn).slice(0, 24),
    });
    const st = res.stat[s];
    const { perKalla, fragor, ratt, ...stat } = st;
    tx.set(karriarRef(c, uid[s]).collection("matcher").doc(matchId), {
      datum: FieldValue.serverTimestamp(), sasong: Number(K[s].sasong) || 1, div: Number(K[s].div) || 0, typ: "vanskap",
      mot: String(m.V.lag[o].namn).slice(0, 40), oss: res.stallning[s], dem: res.stallning[o],
      mal: res.mal.map((x) => ({ min: x.min, lag: x.lag === s ? "oss" : "dem" })), stat: { ...stat, fragor, ratt, sekunder: sekunder(m, nu) },
      fragor, ratt, perKalla, sekunder: sekunder(m, nu),
    });
  }
  const resultat = res ? { vinnare: res.vinnare, walkover: res.walkover, stallning: res.stallning, kassa } : null;
  tx.update(matchRef(c, matchId), {
    V, h: m.h ?? null, fas: m.fas ?? null, halvtid: null, status: res ? "slut" : "avbruten", resultat, uppdaterad: nu,
  });
  if (lob.exists && lob.data().matcher?.[matchId]) tx.update(lobbyRef(c, m.classId), { [`matcher.${matchId}`]: FieldValue.delete() });
  return { ...m, V, status: res ? "slut" : "avbruten", resultat };
}

const fasSvar = (m, s, p) => ({ fas: m.fas.nr, roll: p.roll, val: p.val, fraga: p.fraga, svar: p.svar ?? null, deadline: deadline(m, s) });

export async function fraga(deps, uid, data = {}) {
  const c = ctx(deps);
  const matchId = idEller(data.matchId, "match-id");
  return snabbTx(c, async (tx) => {
    const nu = c.now();
    const m = await lasMatch(c, tx, matchId, uid);
    pagar(m);
    if (m.halvtid) throw new MdFel("failed-precondition", "Det är halvtid.");
    const s = sidaFor(m, uid);
    const [ps, fs] = await Promise.all([tx.get(privatRef(c, matchId, uid)), tx.get(facitRef(c, matchId, uid))]);
    const p = ps.exists ? ps.data() : null;
    if (p?.fas === m.fas.nr && p.fraga) return fasSvar(m, s, p);
    if (nu >= deadline(m, s)) throw new MdFel("deadline-exceeded", "Tiden är ute – nästa läge kommer.");
    const l = vLage(m.V);
    const roll = l.anf === s ? "anf" : "forsv";
    const lista = roll === "anf" ? l.valAnf : l.valForsv;
    const v = lista.find((x) => x.id === data.val);
    if (!v || v.av) throw new MdFel("invalid-argument", "Välj ett av dragen.");
    const bank = fs.exists && Array.isArray(fs.data().bank) ? fs.data().bank : [];
    if (!bank.length) throw new MdFel("failed-precondition", "Frågorna saknas.");
    const post = bank[(m.fas.nr - 1) % bank.length];
    const ny = { classId: m.classId, sida: s, fas: m.fas.nr, roll, val: v.id, fraga: post.pub, kalla: post.kalla || null, svar: null, aktiv: nu };
    tx.set(privatRef(c, matchId, uid), ny);
    return fasSvar(m, s, ny);
  });
}

export async function svar(deps, uid, data = {}) {
  const c = ctx(deps);
  const matchId = idEller(data.matchId, "match-id");
  const raw = data.svar;
  if (!(raw === null || Number.isInteger(raw) || (typeof raw === "string" && raw.length <= 200))) throw new MdFel("invalid-argument", "Ogiltigt svar.");
  return snabbTx(c, async (tx) => {
    const nu = c.now();
    const m = await lasMatch(c, tx, matchId, uid);
    pagar(m);
    if (m.halvtid) throw new MdFel("failed-precondition", "Det är halvtid.");
    const s = sidaFor(m, uid);
    const [P, fs] = await Promise.all([lasPrivata(c, tx, matchId, m), tx.get(facitRef(c, matchId, uid))]);
    const p = P[s];
    if (p?.fas !== m.fas.nr || !p.fraga) throw new MdFel("failed-precondition", "Välj ditt drag först.");
    if (p.svar) return { giltig: true, ...p.svar };
    const bank = fs.data()?.bank || [];
    const post = bank[(m.fas.nr - 1) % bank.length];
    const ute = raw === null || nu >= deadline(m, s); // null = elevens klocka tog slut: fel
    const r = ute ? { giltig: true, ratt: false, facit: String(post?.r?.facit ?? "") } : ratta(post, raw);
    if (!r.giltig) return { giltig: false };
    const ny = { ...p, svar: { ratt: r.ratt, facit: r.facit, ...(ute ? { tidenUte: true } : {}) }, aktiv: nu };
    const mm = !ute && post?.r?.s === "mult" ? await mmForLive(c, m.classId) : null; // cachat
    await stega(c, tx, matchId, m, { ...P, [s]: ny }, nu);
    tx.set(privatRef(c, matchId, uid), ny);
    mmLiveWrites(tx, c, mm, {
      uid, classId: m.classId, name: m.namn?.[s], attemptId: `md_${matchId}_${s}${m.fas.nr}`.slice(0, 64),
      svar: [{ factorA: post.r.a, factorB: post.r.b, isCorrect: r.ratt }],
    });
    return { giltig: true, ...ny.svar };
  });
}

/** Tiden ute, halvtiden, walkover. uid = null: servern städar (lobbyn, mdSvara/mdUtmana). */
export async function tick(deps, uid, data = {}) {
  const c = ctx(deps);
  const matchId = idEller(data.matchId, "match-id");
  return snabbTx(c, async (tx) => {
    const nu = c.now();
    const m = await lasMatch(c, tx, matchId, uid);
    if (m.status !== "pagar") return { status: m.status, fas: m.fas?.nr ?? null };
    const P = await lasPrivata(c, tx, matchId, m);
    const s = uid == null ? null : sidaFor(m, uid);
    const redo = data.redo === true && m.halvtid && s ? s : null;
    const ny = await stega(c, tx, matchId, m, P, nu, { redo });
    if (redo && ny.status === "pagar") tx.set(privatRef(c, matchId, uid), { classId: m.classId, sida: s, aktiv: nu }, { merge: true });
    return { status: ny.status, fas: ny.fas?.nr ?? null };
  });
}

export async function geUpp(deps, uid, data = {}) {
  const c = ctx(deps);
  const matchId = idEller(data.matchId, "match-id");
  return snabbTx(c, async (tx) => {
    const m = await lasMatch(c, tx, matchId, uid);
    pagar(m);
    const r = await avsluta(c, tx, matchId, m, { typ: "walkover", forlorare: sidaFor(m, uid) }, c.now());
    return { status: r.status };
  });
}
