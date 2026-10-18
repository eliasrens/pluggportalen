// ============================================================================
// Prov (#763, spec §2.3.1): logiken bakom elevens rutor för `ordna` och `para`
// – DOM-fri och testad (test/prov-ordna-para.test.js). Vyerna (renderElev i
// typer/ordna.js och typer/para.js) anropar bara de här funktionerna, så
// "n saker = n tryck" och "tryck tar isär" gäller i webbläsaren också.
// Alla funktioner returnerar NYA listor; inget ändras på plats.
//
// ordna – svaret är de placerade sakerna i ordning (samma form som förr):
//   ordnaKvar(alla, placerade)          sakerna som ännu ligger i "Kvar"
//   ordnaLagg(placerade, sak, n)        tryck i "Kvar" → nästa lediga plats
//   ordnaTaBort(placerade, i)           tryck i svaret → tillbaka, resten flyttar upp
//   ordnaSlapp(placerade, sak, plats)   dra till en plats i svaret (extra sätt)
//   ordnaStatus(antal, n)               "3 av 5 placerade"
// para – svaret är valt högerled per vänsterled ("" = inget), som förr:
//   paraTryck({ svar, vald }, sida, varde)  två tryck per par, tryck på par tar isär
//   paraKoppla(svar, i, hoger)              begrepp i ↔ förklaringen (dra eller tryck)
//   paraStatus(svar)                        "2 av 5 par klara"
// ============================================================================

export const ordnaKvar = (alla, placerade) => alla.filter((s) => !placerade.includes(s));

/** Ett tryck på en sak i "Kvar": den hamnar på nästa lediga plats. */
export function ordnaLagg(placerade, sak, n) {
  if (placerade.includes(sak) || placerade.length >= n) return placerade;
  return [...placerade, sak];
}

/** Ett tryck på plats i i svaret: saken går tillbaka och sakerna under flyttar upp. */
export const ordnaTaBort = (placerade, i) => placerade.filter((_, j) => j !== i);

/**
 * Dra och släpp på plats `plats` (0-baserad) i svaret – från "Kvar" eller
 * inifrån svaret. Svaret har inga hål: en plats efter de fyllda = sist.
 */
export function ordnaSlapp(placerade, sak, plats) {
  const utan = placerade.filter((s) => s !== sak);
  const p = Math.max(0, Math.min(Number(plats) || 0, utan.length));
  return [...utan.slice(0, p), sak, ...utan.slice(p)];
}

export const ordnaStatus = (antal, n) => (antal >= n ? `Alla ${n} placerade` : `${antal} av ${n} placerade`);

/** Koppla begrepp i till förklaringen (som då släpper sitt förra begrepp). */
export function paraKoppla(svar, i, hoger) {
  return svar.map((s, j) => (j === i ? hoger : s === hoger ? "" : s));
}

/**
 * Ett tryck i para-rutan. `vald` = { sida: "v"|"h", varde } – det första
 * trycket; `varde` är vänsterledets index (v) eller förklaringens text (h).
 *   - tryck på en sak i ett par (inget valt på andra sidan) → paret tas isär
 *   - första trycket väljer, ett tryck på samma sak igen avväljer
 *   - andra trycket på andra sidan → paret skapas (två tryck per par)
 * @returns {{ svar: string[], vald: { sida: string, varde: any } | null }}
 */
export function paraTryck({ svar, vald }, sida, varde) {
  const parat = sida === "v" ? svar[varde] !== "" && svar[varde] != null : svar.includes(varde);
  if (vald && vald.sida !== sida) {
    const ny = sida === "v" ? paraKoppla(svar, varde, vald.varde) : paraKoppla(svar, vald.varde, varde);
    return { svar: ny, vald: null };
  }
  if (parat) {
    return { svar: sida === "v" ? svar.map((s, j) => (j === varde ? "" : s)) : svar.map((s) => (s === varde ? "" : s)), vald: null };
  }
  if (vald && vald.varde === varde) return { svar, vald: null };
  return { svar, vald: { sida, varde } };
}

export function paraStatus(svar) {
  const klara = svar.filter((s) => s).length;
  return `${klara} av ${svar.length} par klara`;
}
