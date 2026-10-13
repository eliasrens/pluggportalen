# Läsresan – nivå 1 del B (40 nya texter, issue #661)

Nya texter i `src/lasresan/content/bank/level-1-b.json`, listad i `manifest.json` under nivå 1 efter `level-1.json` (som inte är ändrad). Samma ramar som del A (#521/#524): 30–50 ord, korta meningar, 3–4 frågor, högst 4 ord per alternativ, svaret står i texten. Huvudpersonernas namn finns inte i någon annan text i banken.

Byggs med `node admin/lasresan-g1b-bygg.mjs` (källtexter i `admin/lasresan-g1b-story.mjs` och `admin/lasresan-g1b-fakta.mjs`, rätt svar först; skriptet balanserar positionerna seedat). Test: `test/lasresan-bank-niva1b.test.js`.

## Story (20)
| id | topic | titel |
|---|---|---|
| lr-g1-bonan | skola | Bönan i koppen |
| lr-g1-utflykten | skola | Bussen till djurparken |
| lr-g1-biblioteket | skola | En bok om hajar |
| lr-g1-pyjamas | roliga situationer | Pyjamas i skolan |
| lr-g1-polen | vardag | Hoppa i pölen |
| lr-g1-biltvatten | vardag | Vi tvättar bilen |
| lr-g1-stadningen | vardag | Under sängen |
| lr-g1-fisket | relationer | Fiske med morfar |
| lr-g1-applet | relationer | Ett äpple till två |
| lr-g1-forsta-stegen | relationer | Lillasyster går |
| lr-g1-simningen | sport | Jag kan simma! |
| lr-g1-pingisen | sport | Pingis med mamma |
| lr-g1-kullerbyttan | sport | Kullerbytta på mattan |
| lr-g1-taket | mysterier | Ljud på taket |
| lr-g1-salladen | mysterier | Hål i salladen |
| lr-g1-skattkartan | äventyr | Kartan till skatten |
| lr-g1-snorkeln | äventyr | Under vattnet |
| lr-g1-berget | äventyr | Upp på berget |
| lr-g1-glassen | roliga situationer | Var tog glassen vägen? |
| lr-g1-spegeln | roliga situationer | Valpen och spegeln |

## Fact (20)
| id | topic | titel |
|---|---|---|
| lr-g1-fisken | djur | Fisken |
| lr-g1-kon | djur | Kon |
| lr-g1-snigeln | djur | Snigeln |
| lr-g1-salen | djur | Sälen |
| lr-g1-humlan | djur | Humlan |
| lr-g1-molnen | natur | Molnen |
| lr-g1-hosten | natur | Hösten |
| lr-g1-maskrosen | natur | Maskrosen |
| lr-g1-stjarnorna | rymden | Stjärnorna |
| lr-g1-jorden | rymden | Jorden |
| lr-g1-nasan | vetenskap | Näsan |
| lr-g1-somnen | vetenskap | Vi behöver sova |
| lr-g1-cykeln | teknik | Cykeln |
| lr-g1-taget | teknik | Tåget |
| lr-g1-dinosaurierna | historia | Dinosaurierna |
| lr-g1-hast-och-vagn | historia | Häst och vagn |
| lr-g1-italien | geografi | Landet som ser ut som en stövel |
| lr-g1-finland | geografi | Finland |
| lr-g1-havet | natur | Havet |
| lr-g1-djungeln | geografi | Djungeln |

## Resultat
- 40 texter, 20 story + 20 fact, 160 frågor (alla texter har 4 frågor).
- Kategorier: fakta 138, mellan_raderna 9, helhet_slutsats 3, ordforstaelse 10.
- Rätt svars position i del B: A 40, B 40, C 40, D 40. Hela nivå 1: 69/69/68/68.
- Rätt svar unikt längst: 34 av 160 (21 %) i del B, 55 av 274 (20 %) på hela nivå 1.
- Ordantal 37–49, medel 44,8. Ord per mening i medel 5,1, max 10.
- `validateBank` på hela banken: 0 fel, 0 varningar.
