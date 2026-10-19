// ============================================================================
// Kistspel 🎁 (#653): HELSKÄRMSKNAPPEN – en diskret knapp som visar elevvyn i
// helskärm (Fullscreen-API:t, webkit-prefix som reserv). Ikonen = standard-
// ikonen (fyra hörn, SVG – ingen emoji); i helskärm "lämna helskärm". Esc
// eller systemets utgång synkar ikonen via fullscreenchange. Saknas API:t
// (t.ex. Safari på iPhone) visas ingen knapp alls. Formatet placerar och
// stilar knappen (cls); Guldrushen använder den inte.
//
// API
//   fullscreenSupported(doc?) → bool
//   createFullscreenButton(target, { cls?, doc? }) → { el, destroy() } | null
//     target  elementet som visas i helskärm (elevvyns rot)
//     el      knappen (vyn lägger in den där den ska synas)
// ============================================================================

// Själva logiken ligger i den delade helpern (src/helskarm.js, #783) som även
// Schack och elevskärmen använder – här finns bara kistspelets namn kvar.
export { fullscreenSupported, createFullscreenButton } from "../../helskarm.js";
