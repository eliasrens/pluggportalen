// ============================================================================
// Pluggporten – STANDARDPROFILEN för Pixi-rörelsens spegling (#396, F4 #418)
// ----------------------------------------------------------------------------
// Används för varje lager vars scen-profil (data-spegel-profil →
// varld-profil-<scen>.js) saknas eller inte kan laddas. Allt i lagret räknas
// som statiskt. Har lagret ändå levande animationer (moln, husdjur …) speglar
// motorn om hela lagret vid handoff, efter att varld-vila.js frusit dem – bilden
// blir då exakt, till priset av en kallare start. Scen-profilerna (S1–S6) gör
// det billigare.
//
// FORMATET (§2.4 i docs/pixi-arkitektur-396.md; semantiken bindande sedan #428)
//
//   ambient     Noder med LEVANDE animation/promenad (moln, rök, gårdsdjur,
//               grödor). Styr BARA invalideringen: mutationer inuti dem
//               (promenadens left/top, klasser) smutsar inte lagret. De BAKAS
//               IN i bas-texturen i rätt z-ordning – vid handoff i sin frusna
//               WAAPI-pose (lagret speglas om när det har levande animationer
//               utanför `sprites`). Den idle-förvärmda reservpyramiden bär
//               posen från förvärmningstillfället (accepterat).
//   sprites     Tunga levande noder som UTESLUTS ur basen och ritas som egna
//               speglaNod-sprites OVANPÅ basen, i DOM-ordning, utan tak – varje
//               handoff, i frusen pose, även när basen speglas om. Ignoreras av
//               invalideringen. Animationer inuti sprites kräver ingen
//               omspegling av basen → billig handoff (rummets PNG-husdjur).
//               OBS: allt i `sprites` hamnar över hela basen – lägg därför även
//               det som ska ligga ÖVER dem i DOM:en här (S4: dörrar, lista).
//   objekt      Kandidater för fokus-överlägg: en hovrad/fokuserad nod speglas
//               vid handoff som sprite ovanpå basen (t.ex. tomten i
//               scale(1.06)). I BASEN ritas samma nod alltid i vila-läge (utan
//               :hover/:focus-visible, varld-spegel-neutral.js) – annars slutar
//               en senare övergång med hover-skalan kvar på canvasen.
//   ignorera    Ritas aldrig (bubblor, paneler).
//   malSelektor Dynamiska klickmål (t.ex. ".by-tomt[data-fokus-x]"). Vid
//               pointerenter/focusin på ett mål förvärmer motorn (prio "nu")
//               fokus-pyramiden för övergången ett klick skulle starta. Målet
//               bär data-fokus-x / data-fokus-y = kamerans fokus i % av lagret
//               (samma tal som nivåns `fokus` får vid klicket) och kan bära
//               data-fokus-lager="<id>" = lagret klicket zoomar in till.
//               Scen-filerna anropar helst forvarmMal(el) själva; innerlagret:
//               forvarmLager(lagerEl). Båda krokarna: överst i varld-motor.js.
//   zoom        (valfri) målets zoom när varken data-fokus-zoom eller någon
//               registrerad kamera-nivå för lagret finns.
//   fangst      "stage" (övertecknad natur runt lagret) | "lager"
// Laddas bara via import() – aldrig i bootgrafen.
// ============================================================================

export default {
  id: "standard",
  ambient: [],
  sprites: [],
  // Allt klickbart i scenerna är role=button/tabindex (husgrupp, klasskylt,
  // by-tomter, skyltar) – det är dem hover/fokus skalar upp.
  objekt: '[role="button"], button, a[href], [tabindex]:not([tabindex="-1"])',
  ignorera: [],
  malSelektor: null,
  fangst: "stage",
};
