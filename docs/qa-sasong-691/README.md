# #691 Höstvärld, fallande löv, inloggningens tre teman – QA

Spec: UTVECKLINGSUPPDRAG_HOST_HALLOWEEN.md §1.3–1.5, §2.1. Emulator-preview:
`admin/qa-sasong-preview.sh` (app 8691) + `admin/qa-klasscenter-by-seed.mjs` (eleven kc01 / lilla123, endast emulator)
och `admin/qa-sasong-satt.mjs <sommar|host|bort> [halloween [sek]]` för att byta läge live.

## Så funkar det
- **Palett:** konsten ritar `sz("namn", sommarfärg)` = `var(--sz-namn, sommarfärg)` (art-style.js).
  Paletterna bor i `season-config.js` (`SEASONS.host.palette`, `HALLOWEEN_LOGIN_PALETTE`) och skrivs
  av `season-world.js` som `<style id="sz-palett">` – bara för `.varld-stage`, `.room-window`,
  `.port-scen` och lärarspärren. Sommar = ingen variabel = exakt dagens färger.
- **Dekor i konsten** (lövhögar, pumpor, måne, spöke) ritas med klasserna `.sz-bara-host` /
  `.sz-bara-halloween` och visas via `<html data-sasong data-halloween>` (styles/31-sasong.css).
- **Ingen blink:** `applyCachedTheme()` läser `localStorage["pp:season"]` synkront innan porten/världen
  ritas; `season-world.js` laddas parallellt med port-SVG:n resp. elevdatan (ingen extra väntan).
- **Rummet** följer inte säsongen; fönstrets himmel/kulle gör det. Löven döljs i rummet/laggården.
- Halloween i världen = bara små pumpor (vid husets gång/brevlåda och vid byns lyktstolpar).

## Tester
| Test | Resultat |
| --- | --- |
| 1 Utan config/season = som i dag | ✅ Pixeljämförelse mot basen 1156f5c (animationer frysta, 1366×768): hus 0 px, by 0 px, inloggning 0 px skillnad |
| 2 Höst live utan omladdning | ✅ `qa-sasong-satt.mjs host` → hus/by/gård/fönster byter direkt; Plugga har inga lager/variabler |
| 4 Löven | ✅ se mätningen; `elementFromPoint` på alla 16 löv träffar aldrig lövet; reducerad rörelse → `display:none`; dold flik → `.sz-paus` |
| 4b Inloggningen | ✅ sommar/höst/Halloween live + vid omladdning direkt ur cachen; login-skylten och fälten oförändrade (samma kräm/kontur/knapp), "Lärare →" får kräm-pastill på mörk mark |
| Boot-graf | ✅ 107 filer, identisk lista (`node admin/qa-bootgraf-bfs.mjs`) |
| Enhetstester | ✅ 2368/2368 (alla utom rules/functions/e2e), varav `test/season-world.test.js` ny |

## Lövmätning (test 4)
Headless Chrome, 1366×768, hus-vyn i höst, **4× CPU-strypning** (≈ skol-Chromebook), 3 × 6 s
växelvis med och utan löv (`data-lov` av/på), requestAnimationFrame-intervall:

| | fps | p95 (ms) | bildrutor > 33 ms |
| --- | --- | --- | --- |
| Med löv (16) | 60,0 / 58,3 / 59,7 | 16,8 | 0 / 4 / 3 |
| Utan löv | 60,1 / 60,1 / 59,9 | 16,7–16,8 | 0 / 0 / 0 |

Löven animeras bara med transform/opacity (en animation per löv = ett kompositorlager). Headless-Chrome
här saknar GPU (SwiftShader rastrerar kompositorn i mjukvara), så enstaka tappade bildrutor med löv är
troligen mjukvarukompositorn – **bekräfta gärna på en riktig Chromebook** (DevTools → Rendering → FPS).

## Skärmdumpar
`login-{sommar,host,halloween}-{1366,1920}.png`, `varld-{sommar,host}-*.png`, `by-*.png`, `gard-host-1366.png`
(Halloween + höst samtidigt i gård-bilden).
