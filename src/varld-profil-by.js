// ============================================================================
// Pluggporten – Pixi-profilen för BYN (#396, S2 #420)
// ----------------------------------------------------------------------------
// Gäller #by-lager (klassbyn, 25-husbyn = rotorsaksscenen från #374) och
// #grannby-lager (en annan klass by – samma mountByScen-markup). Lagren pekar
// hit via data-spegel-profil="by" (pages-varld.js); motorn laddar filen med
// import() (varld-motor-textur.js laddaProfil) – aldrig i bootgrafen.
//
//   ambient     inga noder som ska bakas in frusna.
//   sprites     .hus-rok: skorstensröken på minihusen (stuga – standardskalet –
//               tidstorn, drakgrotta) är byns ENDA levande animation (uppmätt
//               i desk över alla husskal). Ritad som egna sprites ovanpå behöver
//               25-husbyn inte speglas om vid varje handoff (≈ 250–750 ms i
//               desk) – den förvärmda pyramiden räcker. Nyckeln läses av F4b
//               (#428); F4-motorn ignorerar den och speglar då om lagret med
//               röken frusen (exakt bild, kallare start). Tomternas hover-scale
//               är en CSS-transition och räknas inte som levande.
//   objekt      .by-tomt: den hovrade/fokuserade tomten (svg scale(1.06) +
//               ev. focus-visible-ram) speglas som fokus-överlägg vid handoff,
//               så tomten man klickar på inte "poppar" när Pixi tar över.
//   ignorera    .by-last-bubbla: 🔒-rutan på ett låst hus är flyktig UI och
//               ska aldrig bakas in i en textur (den leder heller ingen resa).
//   malSelektor tomter med data-fokus-x/y (varld-by-scen.js, = layout.fokusFor
//               = kamerans fokus). Kamratens exteriör förrenderas vid
//               pointerover/focusin på målet (varld-kompis.js) så att T4:s
//               pyramid hinner byggas innan klicket.
//   fangst      "stage": marken/himlen är övertecknad långt utanför lagret
//               (#373) och syns runt om när byn står nedkrympt (T1 in).
// ============================================================================

export default {
  id: "by",
  ambient: [],
  sprites: [".hus-rok"],
  objekt: ".by-tomt",
  ignorera: ".by-last-bubbla",
  malSelektor: ".by-tomt[data-fokus-x]",
  fangst: "stage",
};
