# Testrapport #735 – Bråkresan i fokusläget (Coder, 2026-10-16)

Mot emulatorn (`admin/qa-brakresan-preview.sh`: Auth + Firestore + Functions, grenens
regler). Låsen satta via lärar-UI:t (qalarare → Klasser → QA-klass 4A → Fokusläge).
Direktlänkar från elevens sida, slutlig hash avläst efter 2,5 s.

| Lås | Bråkresan | Andra inlärningsmoduler | Shop/hus | Meny |
|---|---|---|---|---|
| Bråkresan (1366×768) | öppen, även `?u=03` | Plugga, Läsresan, Ekvationsresan, Hitta rätt!, område → `#/elev/brakresan` | öppna | Hem, Shoppen, Bråkresan |
| Läsresan, bytt live (390×844) | `#/elev/brakresan` och `?u=12` → `#/elev/lasresan` | spärrade | öppna | Hem, Shoppen, Läsresan |

- Eleven stod i Bråkresan när läraren bytte till Läsresan → flyttades utan omladdning.
- `#/elev/brakresan/12` finns inte som route (utmaningarna är `?u=NN`) → "Sidan finns inte".
- Målväljaren: Bråkresan under "Moduler"; efter att klassen dolt Bråkresan (Synlighet) →
  "🐉 Bråkresan (dold för klassen)" gråad.
- Servern: `brakresaStartRound` nekas vid lås till annat / dold modul
  (test/functions-brakresan-core.test.mjs, "fokusläge och dold modul").
- Enhet 2729/2729 (+1 skip), test:rules 613/613 (efter rättat test), Bråkresan-functions 47/47,
  bootgraf 107 (ingen Bråkresan-fil).
- Emoji visas som rutor i headless-skärmdumparna (saknad font), inte en bugg.

Skärmdumpar: `larare-las-brakresan-1366.png`, `elev-last-brakresan-1366.png`,
`elev-lasresan-las-brakresan-sparrad-390.png`.
