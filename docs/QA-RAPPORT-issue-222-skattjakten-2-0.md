# QA-rapport – Skattjakten 2.0 (issue #222)

Slut-QA av Skattjakten 2.0 efter motorn (#220) + ö-integrationen (#221). Verifierat
mot `preview-skattjakten.html` i headless-browsern (riktig sida, inte about:blank)
samt ren matte via enhetstester. **Inga buggar hittade** – banan är komplett och
spelbar. En hårdnings-åtgärd tillagd (flood-fill-test), i övrigt ingen kodändring.

## Testresultat
- `node --check` rent på hela `src/adventure/**` (motor + alla teman).
- Hela pure-sviten grön: **196/196** (`node --test test/*.test.js` utom
  `firestore-rules`/`e2e`, som kräver emulator). Var 193 – +3 nya flood-fill-tester.

## Live-verifiering (headless Chrome mot preview-skattjakten.html)
| Krav | Utfall |
| --- | --- |
| Start vid bryggan (anländer med båt, nere-höger) | ✅ start (0.74, 0.66), på sand |
| Kameran centrerar avataren, ~1/6 syns | ✅ synlig andel 0.167 av världsbredden |
| Mjuk scroll, ingen hoppighet | ✅ lerpad följning, första rutan snäpper |
| Clampad mot kanterna – ingen svart utanför bilden | ✅ inget svart i något hörn (top-left + bottom-right), zoom ≥ cover |
| Generös kollision (hav/damm/å/klippor blockerar) | ✅ avataren stoppas vid dammkant/vatten |
| Smidigt på gräs/sand/stigar, inga osynliga väggar | ✅ fri gång på land |
| 10 frågeobjekt utspridda, ej på rad/överlappande | ✅ 10 stationer, min-avstånd > 0.05 (enhetstest) |
| Fråga öppnas ovanpå, avatar fryst → tillbaka direkt | ✅ 0 px rörelse med piltangenter nedtryckta under modal |
| 10 rätt → kista dyker upp med tydlig effekt | ✅ `goalUp` efter 10 klarade, glow/strålar/gnistor i kist-SVG |
| Gå till kistan → bana klar + belöning | ✅ resultatskärm: "Du hittade skatten på Skattön! 🏴‍☠️💰", stjärnrad, coins/XP, "Spela igen" |

Full genomspelning kördes end-to-end: alla 10 stationer klarades via riktig
tangentstyrning + riktiga frågemodaler, kistan spawnade, nåddes och öppnades,
belöningen delades ut (grind-skalat mode `aventyr:skattjakten`).

## Edge-cases
- **Nåbarhet (flood-fill):** alla 18 fråge-kandidater + alla 3 kist-kandidater
  ligger i samma sammanhängande gångbara region som startbryggan – ingen kan hamna
  på en isolerad landtunga. **Nu låst med regressionstester** i
  `test/skattjakten-map.test.js`.
- **Öster om ån:** höger sida nås via bro-luckan (inte avskuret av vattnet). ✅
- **Område med <10 frågor:** hanteras snällt. Frågepoolen fylls på när den tömts
  (`refillIfEmpty`), så 10 stationer kan serveras även från 1 fråga. Tomt/otillräckligt
  innehåll (0 frågor, eller 1 par utan distraktor) → `hasQuestions()` = false →
  vänlig "Äventyret är inte redo än"-skärm (`index.js`), inte en trasig bana.
- **Väldigt liten/stor skärm:** kameran räknar om zoomen vid resize (ResizeObserver).
  Testat 273×397 och stort fönster – zoom ≥ cover, inget svart, ~1/6 syns i båda.
- **Avatar i hörn / vid bro-passage:** rörelsen är axel-separerad (glider längs
  väggar), fastnar inte permanent; bro-passagen korsades i genomspelningen.
- **Grid-teman orörda:** Spökjakten (👻) och Gruvan (💎) laddar felfritt i grid-läget
  (ingen `adv-world`/scroll, 176 tiles, 10 stationer), motorns delade flöde intakt.

## Dev-artefakter (städning inför merge)
- `preview-skattjakten.html` (#221) – **behåll.** Följer den etablerade
  `preview-*.html`-konventionen (preview-spokjakten, preview-gruvan m.fl. i repo-roten),
  Firebase-fri, ingen elev-route.
- `aventyr-scroll-demo.html` (#220) – **behåll.** Motor-nivå-demo (scroll-demo-temat,
  stubbad modal), refererad från `docs`/`themes/README.md` och `themes/scroll-demo.js`.
  Att ta bort den kräver att även referenserna städas; värdet av demot > städvinsten.

## Ändringar i detta issue
- `test/skattjakten-map.test.js`: +3 flood-fill-tester som låser nåbarheten för
  spawns/kista/öster-om-ån (annars kan en framtida karta-/kollisionsändring bryta
  banan utan att någon befintlig test fångar det).
- `docs/QA-RAPPORT-issue-222-skattjakten-2-0.md`: denna rapport.
