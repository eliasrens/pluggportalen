// ============================================================================
// Matchdagen: frågeströmmen för elevens besök – EN per besök (områdena läses en
// gång, §13), delad av matchen (md-match-spel.js) och träningslägret (#871,
// md-vy-lager.js) – och källornas namn till statistiken (perKalla).
//
//   strom(S) → { nasta, ratta, tom?, meddelande?, kallNamn }   (S.strom efter första gången)
// Mattematchen (#879): ratta räknar ett giltigt multiplikationssvar (match, straffar och
// träningslägret – alla rättar här) i elevens aktiva Mattematch via S.data.mmRaknaIn
// (md-data.js; förhandsvisningens stubbe saknar den). Skickas iväg utan att vänta – spelet
// märker ingenting, och inga mynt. Utan aktiv match händer ingenting.
// ============================================================================

export async function strom(S) {
  if (S.strom) return S.strom;
  const kallNamn = {};
  const { skapaFragestrom, mmSvar } = await import("../md-fragor.js");
  const s = await skapaFragestrom({
    inst: S.inst, uid: S.uid,
    hamtaOmrade: async (subj, area) => {
      const a = await S.hamtaOmrade(subj, area);
      if (a?.name) { kallNamn[`omrade:${subj}/${area}`] = a.name; kallNamn[`rakna:${subj}/${area}`] = a.name; }
      return a;
    },
  });
  for (const t of S.inst.tabeller) kallNamn[`tabell:${t}`] = `${t}:ans tabell`;
  const mm = typeof S.data?.mmRaknaIn === "function" ? S.data.mmRaknaIn : null;
  const ratta = s.ratta && mm
    ? (fraga, svar) => {
      const r = s.ratta(fraga, svar);
      const x = r.giltig ? mmSvar(fraga, svar) : null;
      if (x) mm({ uid: S.uid, ...x }).catch(() => {});
      return r;
    }
    : s.ratta;
  S.strom = { ...s, ...(ratta ? { ratta } : {}), kallNamn };
  return S.strom;
}
