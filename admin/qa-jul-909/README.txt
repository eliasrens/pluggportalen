QA-rigg #909 (Tester): headless chromium via CDP (node 22, inga beroenden).
Kräver previewn preview/preview-jul-909-app.html (HEAD) och en bas-kopia (git archive ce94ba36 + preview/jul-909) på egna portar;
URL:erna (H/B) står överst i varje skript – byt till dina preview-adresser.
  node matris.mjs <shotdir> [sasonger] [extra] [scener]  skärmdumpar by/hus/gard/rum/port/gate med Jul på
  node diff.mjs <dir>        0 px-diff bas vs HEAD utan tillägg (reducerad rörelse, animationer frysta)
  node rm.mjs <dir>          reducerad rörelse, Jul av/på live (applyTheme), 375 px
  node fps.mjs               rAF-fps vid 4x CPU (by + port)
  node lt2.mjs               längsta long task vid laddning (4x CPU, DPR 1/2, kall webbläsare)
  node ovr.mjs               Plugga/Läsresan/profil/shop utan juldekor, konsolfel, klick genom dekoren
