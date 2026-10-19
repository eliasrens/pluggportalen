// ============================================================================
// Prov (#741, spec §7 "Elevens resultatvy"): modellen för elevens rättade
// prov – ren logik, ingen Firebase/DOM (prov-resultat-vy.js ritar den).
// #765: poängen per avsnitt ("Del 1: 8 av 10 · Del 2: 9,5 av 14") och
// fritextens poängkriterier – bara när läraren valt att visa dem.
// ============================================================================

import { arFraga } from "./prov-fragetyper.js";
import { fragaNummer, poangAvsnitt } from "./prov-modell.js";
import { arOmprov, elevProvNamn } from "./prov-anpassningar.js";
import { nivaNamn, summera } from "./prov-rattning-logik.js";
import { summaPoang } from "./prov-poang.js";

/**
 * Poängen per avsnitt i ett rättat prov (#765): summan av frågornas poäng
 * (som totalen, summera) av avsnittets maxpoäng. [] för ett prov utan avsnitt.
 * @returns {{ id: string, titel: string, poang: number, max: number }[]}
 */
export function avsnittsPoang(r, fragor) {
  return poangAvsnitt(fragor).map((a) => ({
    id: a.id, titel: a.titel, poang: summaPoang(a.fragor.map((f) => r?.fragor?.[f.id]?.poang)), max: a.maxPoang,
  }));
}

/**
 * Elevens resultat (§7 "Elevens resultatvy"): null tills provet lämnats
 * tillbaka. Facit finns bara om läraren valde att visa det (rattning.facit),
 * poängkriterierna (#765) bara när tillfället visar dem (visaKriterier) OCH
 * tillbakalämningen kopierade dem (rattning.kriterier).
 * @param {object} tf   tillfället (frågorna utan facit)
 * @param {object|null} svarDok  elevens svar-dokument
 * @param {object|null} r  elevens rättning
 */
export function resultatModell(tf, svarDok, r) {
  if (!r || r.aterlamnad !== true) return null;
  const fragor = tf?.fragor || [];
  const nr = fragaNummer(fragor);
  const poangsatt = tf?.installningar?.poang !== false;
  const visaFacit = !!r.facit && Object.keys(r.facit).length > 0;
  const kriterier = tf?.installningar?.visaKriterier === true && r.kriterier && typeof r.kriterier === "object" ? r.kriterier : null;
  const summa = summera(r, fragor);
  const avsnitt = avsnittsPoang(r, fragor);
  const perAvsnitt = new Map(avsnitt.filter((a) => a.id).map((a) => [a.id, a]));
  return {
    namn: tf ? elevProvNamn(tf) : r.provNamn || "Prov",
    omprov: arOmprov(tf),
    poangsatt,
    totalPoang: summa.totalPoang,
    maxPoang: summa.maxPoang,
    avsnitt,
    niva: r.niva || null,
    nivaNamn: nivaNamn(r.niva),
    helhetskommentar: r.helhetskommentar || "",
    mynt: Number.isInteger(r.myntUtbetalt) && r.myntUtbetalt > 0 ? r.myntUtbetalt : 0,
    visaFacit,
    poster: fragor.map((f) => ({
      fraga: f,
      nr: nr[f.id] ?? null,
      svar: svarDok?.svar?.[f.id],
      post: arFraga(f) ? r.fragor?.[f.id] || null : null,
      facit: visaFacit ? r.facit[f.id] ?? null : null,
      kriterier: kriterier && Array.isArray(kriterier[f.id]) && kriterier[f.id].length ? kriterier[f.id] : null,
      avsnitt: perAvsnitt.get(f.id) || null, // avsnittets poäng (bara på avsnitts-blocket)
    })),
  };
}
