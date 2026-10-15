// Stubb för src/season.js (#732-förhandsvisningen): säsongen ur ?sasong=sommar|host|halloween,
// ingen Firebase. Importmappen i preview-by-namnskyltar-732.html pekar hit.
const s = new URLSearchParams(location.search).get("sasong") || "sommar";
const state = { season: s === "sommar" ? "sommar" : "host", halloween: s === "halloween", halloweenUntil: null, halloweenActive: s === "halloween" };
export const getSeason = () => state;
export const isHalloweenActive = () => state.halloweenActive;
export const onSeasonChange = () => () => {};
