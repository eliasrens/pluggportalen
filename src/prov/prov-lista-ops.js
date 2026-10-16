// ============================================================================
// Prov (#739, spec §5.1): raderna i "Mina prov" – DOM-fritt och testat
// (test/prov-redigera.test.js). Ägarskapet följer områdena (#680):
// canEditArea/createdByLabel ur teacher-role-core.js.
//
//   provRad(dok, role)        { id, namn, amne, antal, textblock, andrad, agare, kanAndra, egen }
//   delaProvlista(doks, role) { mina, andras } – nyast ändrade först
//   datumText(ms)             "18 okt 14:05" / "18 okt 2025"
//   tidMs(t)                  Timestamp/Date/ms → ms
// ============================================================================

import { canEditArea, createdByLabel } from "../teacher-role-core.js";
import { arFraga } from "./prov-fragetyper.js";

const str = (v) => (v == null ? "" : String(v));

/** Får kontot redigera/radera provet? Samma regel som områdena (#680). */
export const kanAndra = (dok, role) => canEditArea(dok, role);

/** En rad i "Mina prov": namn, antal frågor, senast ändrat, ägare. */
export function provRad(dok, role) {
  const fragor = Array.isArray(dok?.fragor) ? dok.fragor : [];
  const ms = tidMs(dok?.uppdaterad) ?? tidMs(dok?.skapad);
  return {
    id: dok.id,
    namn: str(dok.namn) || "(namnlöst prov)",
    amne: str(dok.amne),
    antal: fragor.filter(arFraga).length,
    textblock: fragor.length - fragor.filter(arFraga).length,
    andrad: ms,
    agare: createdByLabel(dok),
    kanAndra: kanAndra(dok, role),
    egen: !!role?.uid && dok?.createdBy === role.uid,
  };
}

/** Firestore-Timestamp / Date / ms → ms (eller null). */
export function tidMs(t) {
  if (t == null) return null;
  if (typeof t === "number") return t;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return null;
}

/**
 * "Mina prov" först (kontots egna – för admin även prov utan ägare), sedan
 * kollegornas. Båda nyast ändrade först.
 */
export function delaProvlista(doks, role) {
  const rad = (d) => provRad(d, role);
  const sortera = (a, b) => (b.andrad ?? 0) - (a.andrad ?? 0) || a.namn.localeCompare(b.namn, "sv");
  const mina = [];
  const andras = [];
  for (const d of doks || []) {
    const r = rad(d);
    if (r.egen || (role?.admin && !d.createdBy)) mina.push(r);
    else andras.push(r);
  }
  return { mina: mina.sort(sortera), andras: andras.sort(sortera) };
}

/** "18 okt 14:05" (i år) / "18 okt 2025" – senast ändrat i listan. */
export function datumText(ms, nu = Date.now()) {
  if (!ms) return "–";
  const d = new Date(ms);
  const iAr = d.getFullYear() === new Date(nu).getFullYear();
  const dag = d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", ...(iAr ? {} : { year: "numeric" }) });
  return iAr ? `${dag} ${d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}` : dag;
}
