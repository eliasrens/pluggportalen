// Stubb för src/season.js (preview-vinter-908.html): läget ur ?sasong=vinter|host|sommar|halloween|jul,
// ingen Firebase. Importmappen pekar hit.
const s = new URLSearchParams(location.search).get("sasong") || "vinter";
const state = {
  season: ["vinter", "host", "sommar"].includes(s) ? s : s === "halloween" ? "host" : "vinter",
  halloween: s === "halloween", halloweenUntil: null, halloweenActive: s === "halloween",
  jul: s === "jul", julUntil: null, julActive: s === "jul",
};
export const getSeason = () => state;
export const isHalloweenActive = () => state.halloweenActive;
export const onSeasonChange = () => () => {};
