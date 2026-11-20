// ============================================================================
// Matchdagen: frågeströmmen för elevens besök – EN per besök (områdena läses en
// gång, §13), delad av matchen (md-match-spel.js) och träningslägret (#871,
// md-vy-lager.js) – och källornas namn till statistiken (perKalla).
//
//   strom(S) → { nasta, ratta, tom?, meddelande?, kallNamn }   (S.strom efter första gången)
// ============================================================================

export async function strom(S) {
  if (S.strom) return S.strom;
  const kallNamn = {};
  const { skapaFragestrom } = await import("../md-fragor.js");
  const s = await skapaFragestrom({
    inst: S.inst, uid: S.uid,
    hamtaOmrade: async (subj, area) => {
      const a = await S.hamtaOmrade(subj, area);
      if (a?.name) { kallNamn[`omrade:${subj}/${area}`] = a.name; kallNamn[`rakna:${subj}/${area}`] = a.name; }
      return a;
    },
  });
  for (const t of S.inst.tabeller) kallNamn[`tabell:${t}`] = `${t}:ans tabell`;
  S.strom = { ...s, kallNamn };
  return S.strom;
}
