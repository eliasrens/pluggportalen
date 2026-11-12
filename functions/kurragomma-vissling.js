// ============================================================================
// Kurragömma på SERVERN – VISSLINGEN (functions/kurragomma-vissling.js, #840)
// ----------------------------------------------------------------------------
// EN väg för alla visslingar som servern utlöser åt en gömd elev: tystnads-
// regeln (kurragomma-tick.js) och lärarens vissling (kgLarareVissla, här).
// kgSvara (fel svar) bygger sin händelse med samma visslingsHandelse i sin egen
// svarstransaktion. Händelsen i Realtime Database `hand` och i `kgEvents` har
// därför alltid samma form: { typ: "vissling", x, z, plats, t } – den
// UNGEFÄRLIGA platsen (visslingsplats, VISSLING_OSAKERHET_M), aldrig uid eller
// namn. Den visslade får senastVisslingAt (1,5× sökradie i VISSLING_FONSTER_MS),
// tystRef flyttas fram och hand-nyckeln läggs i kgPlayers.tystVissling, så att
// elevens skärm känner igen sin egen vissling på id:t (#839 N1b) och visar den
// neutrala raden – inte "Fel svar".
//
// Lärarens vissling (spec, Elias 2026-11-11):
//   • bara läraren som styr matchen (larareFor), bara en elev som är gömd just
//     nu, bara i letfasen medan matchen pågår – annars permission-denied /
//     failed-precondition.
//   • VISSLING_SPARR_MS gäller INTE; eget spamskydd LARARE_VISSLA_SPARR_MS per
//     elev (kgSecret.larareVisslaAt – ingen klient läser kgSecret).
//   • markeringen "utlöst av läraren" finns BARA i kgEvents (larare: true – bara
//     lärare läser samlingen). Aldrig i result (sessionen läses av eleverna, #840 F1):
//     lärarens historik räknar kgEvents själv.
//     Aldrig i hand, aldrig i kgPlayers.
//
//   visslingsHandelse(deps, karta, sec, nu)      → { typ, x, z, plats, t }
//   visslaGomd(deps, sid, s, { uid, nu, far(kp, sec) → true | "skal", patch?, event? })
//       → händelsen | null (en transaktion + hand-skrivningen under vald nyckel)
//   larareVissla(deps, auth, raw)                 kgLarareVissla({ sid, uid }) → { visslade: true, plats }
// ============================================================================

import { KsError } from "./kistspel-rattning.js";
import { visslingsplats } from "./kurragomma/kg-regler.js";
import { platsNamn } from "./kurragomma/kg-geometri.js";
import { LARARE_VISSLA_SPARR_MS } from "./kurragomma/kg-config.js";
import { refs, parseSid, sessionFor, assertLive, kartaFor, larareFor, fel } from "./kurragomma-sess.js";
import { redo } from "./kurragomma-fas.js";
import * as rt from "./kurragomma-rtdb.js";

/** Den ungefärliga platsen + platsnamnet på DEN (aldrig gömstället). Samma form i hand och kgEvents. */
export function visslingsHandelse(deps, karta, sec, nu) {
  const pl = visslingsplats(sec.x, sec.z, deps.rng(), deps.rng(), karta);
  return { typ: "vissling", x: pl.x, z: pl.z, plats: platsNamn(pl.x, pl.z, karta), t: nu };
}

/**
 * Visslar åt en gömd elev i en transaktion som läser färskt: far(kp, sec) avgör
 * (true = vissla; en sträng = skälet att låta bli, patch på kgPlayers via farPatch).
 * event = extra fält i kgEvents (tyst: true | larare: true). Ger händelsen eller null.
 */
export async function visslaGomd(deps, sid, s, { uid, nu, far = () => true, farPatch = null, patch = {}, secretPatch = {}, event = {} }) {
  const { db } = deps;
  const r = refs(db, sid);
  const karta = kartaFor(s);
  const id = rt.handelseId(deps.rtdb, sid);
  const ut = await db.runTransaction(async (tx) => {
    const [k, sc] = await tx.getAll(r.kgPlayer(uid), r.secret(uid));
    const kp = k.data();
    const sec = sc.data();
    if (!kp || kp.roll !== "gomd" || !sec?.gomd) return { skal: "inte-gomd" };
    const svar = far(kp, sec);
    if (svar !== true) {
      const p = farPatch?.(kp, sec);
      if (p) tx.update(r.kgPlayer(uid), p);
      return { skal: svar };
    }
    const ev = visslingsHandelse(deps, karta, sec, nu);
    tx.update(r.secret(uid), { senastVisslingAt: nu, ...secretPatch });
    tx.update(r.kgPlayer(uid), { tystRef: nu, tystVissling: id, ...patch });
    tx.create(r.events.doc(), { t: nu, typ: "vissling", x: ev.x, z: ev.z, plats: ev.plats, ...event });
    return { ev };
  });
  if (!ut.ev) return { ev: null, skal: ut.skal };
  await rt.handelseMedId(deps.rtdb, sid, id, ut.ev);
  return { ev: ut.ev, skal: null };
}

const LARARE_FEL = {
  "inte-gomd": ["failed-precondition", "Eleven är inte gömd just nu."],
  sparr: ["resource-exhausted", "Vänta några sekunder innan du visslar på samma elev igen."],
};

/** kgLarareVissla({ sid, uid }) – lärarens vissling på en gömd elev som bryter mot reglerna. */
export async function larareVissla(deps, auth, raw) {
  const sid = parseSid(raw);
  const uid = raw?.uid;
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new KsError("invalid-argument", "Elevens id saknas.");
  let s = await sessionFor(deps, sid);
  if (!larareFor(deps.roll ? await deps.roll(auth) : null, s)) throw new KsError("permission-denied", "Bara läraren som styr matchen kan vissla.");
  s = await redo(deps, sid);
  const nu = deps.now();
  assertLive(s, nu);
  if (s.kgFas !== "leta") throw new KsError("failed-precondition", "Visslingar finns bara under letfasen.");
  const { ev, skal } = await visslaGomd(deps, sid, s, {
    uid, nu, event: { larare: true },
    far: (_kp, sec) => (nu - (Number(sec.larareVisslaAt) || 0) < LARARE_VISSLA_SPARR_MS ? "sparr" : true),
    secretPatch: { larareVisslaAt: nu },
  });
  if (!ev) {
    const [code, msg] = LARARE_FEL[skal] || LARARE_FEL["inte-gomd"];
    throw fel(code, msg, { skal, ...(skal === "sparr" ? { vantaMs: LARARE_VISSLA_SPARR_MS } : {}) });
  }
  return { visslade: true, plats: ev.plats };
}
