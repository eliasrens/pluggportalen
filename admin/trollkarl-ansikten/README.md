# Trollkarlsduellen – friläggning av ansiktslagren (#537)

Gör om referensbilderna till de friskurna WebP-lager som `trollkarl-figur.js`
visar (ett per uttryck och trollkarl).

## Körning

```bash
cd admin/trollkarl-ansikten
npm install          # hämtar sharp (enda beroendet)
node gor-ansiktslager.cjs
```

- **Indata:** `src/live/trollkarl/ref/Elias_3_bilder.png` och
  `src/live/trollkarl/ref/rasmus_3_bilder.png` (3 paneler: glad/arg/ledsen).
- **Utdata:** `src/live/trollkarl/ref/{elias,rasmus}-{happy,angry,sad}.webp`
  (~20–32 KB st, max 380 px, skrivs över).

## Vad skriptet gör

1. Flood-fill av den vita bakgrunden från bildkanterna (tänder/ögonvitor
   skonas eftersom de inte når kanten).
2. Vita fickor/halo nära konturen äts upp till `POCKET_DEPTH` px in.
3. Defringe: vitt avblandas ur kantpixlarna.
4. Per panel: beskärning (`JOBS`-boxarna), kantrörande småkomponenter
   (rökpuff-slivers) tas bort.
5. Käk-/halsmask som tar bort tröjan/hoodien:
   - **Elias:** linjen AUTO-SPÅRAS ur bilden (understa hudpixeln per kolumn
     + 6 px kontur, median+box-utjämning). `JAW`-punkterna används bara vid
     hårsidorna där hud saknas.
   - **Rasmus:** enbart manuella `JAW`-polylinjer – skägget täcker hakan så
     hudspårning fungerar inte där.
6. Ljusa lågkroma-rester längs hela silhuetten dämpas; därefter behålls bara
   den största sammanhängande ytan (annars svävar frånkopplade tröjfragment).
7. WebP-export med `alphaQuality: 100` (lossless alfa – annars bandning).

## Fallgropar (lärda den hårda vägen)

- Fade-faktorn MÅSTE klampas ≤ 1: `Math.round(alpha * 1.04)` wrappar förbi
  255 i en Uint8Array → prickad linje längs masken.
- Hattarna är borttagna ur grundfiguren; lagren ska visa HELA håret.
- Nya uttryck: lägg till panelbox i `JOBS`, Rasmus behöver även en
  `JAW`-polylinje; verifiera mot mörk bakgrund i preview-trollkarl-figurer.html
  (2× zoom på hår + haka).
