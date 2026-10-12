# Hitta rätt! – källor, licenser och storlek (#607)

Allt innehåll här ligger i repot. Spelet gör **inga** anrop till kart- eller
bildservrar. Tabellerna markerade "genereras" skrivs av
`node admin/hitta-ratt-packs.mjs` – redigera inte dem för hand.

## Filer

| Sökväg | Vad | Laddas av appen? |
| --- | --- | --- |
| `packs/index.json` | Lista för startsidan (id, titel, kategori, typ, svårighet, antal, geo) | ja |
| `packs/<packId>.json` | Ett officiellt pack: metadata + items (facit) | ja, när packen startar |
| `geo/<geoId>.json` | Förprojicerade SVG-vägar (format v1, arkitektur §2.3) | ja, bara packens egen geofil |
| `geo/<geoId>.nycklar.json` | Källnyckel → ogenomskinligt områdes-id (`"PRT": "o31"`) | **nej** – bara skripten och testet |
| `bilder/<itemId>.webp` | Bilder till Kända platser (max 800 px) | ja, lat (aktuell fråga + nästa) |
| `storlek.json` | Maskinläsbar storleksrapport | nej |

## Bygg om

```sh
node admin/hitta-ratt-geo.mjs        # geodata (hämtar till /tmp, mapshaper via npx) ~30 s
node admin/hitta-ratt-bilder.mjs     # nya/ändrade bilder från Commons (sharp-cli via npx)
node admin/hitta-ratt-packs.mjs      # synka områdes-id, index.json, tabellerna nedan
node admin/hitta-ratt-packs.mjs --kontrollera   # + jämför punkterna med Wikidata/Wikipedia
node --test test/hitta-ratt-packs.test.js        # datavalidering
```

Ändra en lista: redigera packfilen (ett item per rad) och kör
`hitta-ratt-packs.mjs` och testet. Ändras frågorna i ett pack som redan har en
topplista ska `version` höjas eller packId bytas (arkitektur §3.1).

## Geodata

| Data | Källa | Licens | Version |
| --- | --- | --- | --- |
| Länder, kust, öar | [Natural Earth](https://www.naturalearthdata.com/) `admin_0_countries` 10m (Sverige, Europa) och 50m (världen) | Public domain | v5.1.2 (git-tagg) |
| Sjöar, vattendrag | Natural Earth `lakes`, `rivers_lake_centerlines` 10m/50m | Public domain | v5.1.2 |
| Län | Natural Earth `admin_1_states_provinces` 10m (Sverige = 21 län) | Public domain | v5.1.2 |
| Landskap | [perliedman/svenska-landskap](https://github.com/perliedman/svenska-landskap), byggt ur **Lantmäteriets Distriktskarta**. Den oklippta varianten klipps mot Natural Earths 10m-kust, så landskap och län har samma kust. | CC0 | commit `64f033e` |

Lantmäteriets egna länsytor (`lansyta`, CC0) kräver ett Geotorget-konto och kan
bytas in senare utan att packen ändras (arkitektur §2.2).

**Attribution på kartan** (diskret, nere till vänster):
- Sverige: "Kartdata: Natural Earth · Lantmäteriet (CC0)"
- Europa och världen: "Kartdata: Natural Earth"

Varken public domain eller CC0 kräver erkännande, men vi ger det ändå.

### Bearbetning

- mapshaper 0.6.121: klippning, `-clean` (glipor mot riksgränsen), topologisk
  förenkling med `keep-shapes`, inre punkt per område (klickring/zoom).
- Interaktiva områden och bakgrund förenklas i **samma** lager, så att delade
  gränser inte glipar.
- Natural Earth-delar som slås ihop med sitt land: Åland → Finland,
  Färöarna → Danmark, Nordcypern → Cypern, Somaliland → Somalia,
  Hongkong/Macao → Kina.
- **Europa** (46 länder): EU27, Island, Norge, Schweiz, Liechtenstein,
  Storbritannien, Albanien, Bosnien och Hercegovina, Montenegro,
  Nordmakedonien, Serbien, Kosovo, Moldavien, Ukraina, Belarus, Ryssland,
  Andorra, Monaco, San Marino, Vatikanstaten. Turkiet, Georgien, Armenien,
  Azerbajdzjan, Kazakstan, Jersey, Guernsey, Isle of Man och Gibraltar ritas
  som bakgrund. Ryssland klipps strax utanför kartans kant.
- **Världen**: suveräna stater + Kosovo, Israel och Palestina, minst
  5 000 km² (mindre stater och beroende områden ritas som bakgrund – annars en
  klickring per ö på helvyn). Antarktis är utanför kartan.
- Små länder (Vatikanen, Monaco, San Marino, Liechtenstein, Andorra, Malta,
  Luxemburg …) behåller alltid sin form (minst en liten romb). Motorn ritar en
  klickring när de är för små på skärmen (arkitektur §1.3).

### Storlek per geofil (genereras)

Budget per fil: ≤ 40 000 punkter och ≤ 90 kB gzip (arkitektur §1.5).

<!-- geo:start -->
| Geofil | Områden | Punkter | Storlek | gzip |
| --- | --- | --- | --- | --- |
| `sverige-landskap` | 25 | 34 083 | 176.4 kB | 70.3 kB |
| `sverige-lan` | 21 | 31 995 | 167.5 kB | 67 kB |
| `europa` | 46 | 31 806 | 166.9 kB | 67 kB |
| `varlden` | 166 | 29 060 | 133 kB | 49.5 kB |
<!-- geo:slut -->

## Storlek per pack (genereras)

När ett pack startar laddas packfilen + **en** geofil. En svensk fråga laddar
aldrig Europa- eller världsdata.

<!-- packs:start -->
| Pack | Items | Geofil | Packfil | Geofil | Bilder (lat, en åt gången) |
| --- | --- | --- | --- | --- | --- |
| `sverige-stader` | 20 | `sverige-landskap` | 3.2 kB (1 gzip) | 176.4 kB (70.3 gzip) | – |
| `sverige-landskap` | 25 | `sverige-landskap` | 2.9 kB (0.8 gzip) | 176.4 kB (70.3 gzip) | – |
| `sverige-lan` | 21 | `sverige-lan` | 2.7 kB (0.7 gzip) | 167.5 kB (67 gzip) | – |
| `sverige-geografi` | 20 | `sverige-landskap` | 3.1 kB (1.1 gzip) | 176.4 kB (70.3 gzip) | – |
| `europa-lander-20` | 20 | `europa` | 2.2 kB (0.7 gzip) | 166.9 kB (67 gzip) | – |
| `europa-lander-alla` | 46 | `europa` | 4.7 kB (1.3 gzip) | 166.9 kB (67 gzip) | – |
| `europa-huvudstader-20` | 20 | `europa` | 3.3 kB (1.2 gzip) | 166.9 kB (67 gzip) | – |
| `europa-huvudstader-alla` | 46 | `europa` | 7.1 kB (2.1 gzip) | 166.9 kB (67 gzip) | – |
| `varlden-lander-30` | 30 | `varlden` | 3.1 kB (0.9 gzip) | 133 kB (49.5 gzip) | – |
| `varlden-huvudstader-30` | 30 | `varlden` | 4.2 kB (1.4 gzip) | 133 kB (49.5 gzip) | – |
| `europa-kanda-platser` | 20 | `europa` | 11 kB (2.7 gzip) | 166.9 kB (67 gzip) | 20 st, 1345.6 kB (största 107.9 kB) |
| `varlden-kanda-platser` | 20 | `varlden` | 10.8 kB (2.7 gzip) | 133 kB (49.5 gzip) | 20 st, 1236.3 kB (största 116.3 kB) |
<!-- packs:slut -->

## Koordinater

Punkternas koordinater kommer från **Wikidata** (P625, `wikidata`-fältet i
varje item) och kontrolleras två gånger:
1. `admin/hitta-ratt-packs.mjs --kontrollera` jämför med Wikidata och med
   engelska Wikipedias koordinater. Inget item avviker mer än packens `fullKm`.
2. Testet kontrollerar att varje stad, huvudstad och sevärdhet ligger i rätt
   landskap/land (`inom`) enligt Natural Earth/Lantmäteriet.

Där Wikidatas punkt inte är en bra målpunkt (älvar: källan eller mynningen)
har itemet en egen koordinat och ett `malpunkt`-fält som förklarar valet:
Dalälven vid Hedemora, Göta älv vid Lilla Edet, Torne älv vid Pajala och
Klarälven vid Ekshärad (mitt på älvens lopp).

## Bilder (genereras)

Wikimedia Commons, bara Public domain, CC0, CC BY och CC BY-SA (skriptet
stoppar andra licenser, t.ex. GFDL och FAL). Nerskalade till WebP, max 800 px,
max 120 kB. I spelet visas "Foto: {fotograf}, {licens}, Wikimedia Commons"
diskret under bilden, med länk till filsidan. CC BY och CC BY-SA kräver det
erkännandet; ändringen (nerskalning) är tillåten under samma licens.

<!-- bilder:start -->
| Plats | Fil (Wikimedia Commons) | Fotograf | Licens |
| --- | --- | --- | --- |
| Eiffeltornet | [Tour Eiffel Wikimedia Commons.jpg](https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons.jpg) | Benh LIEU SONG | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |
| Colosseum | [Colosseo 2020.jpg](https://commons.wikimedia.org/wiki/File:Colosseo_2020.jpg) | FeaturedPics | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Big Ben | [Elizabeth Tower and the north front of the Palace of Westminster, London.jpg](https://commons.wikimedia.org/wiki/File:Elizabeth_Tower_and_the_north_front_of_the_Palace_of_Westminster,_London.jpg) | Christian David | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Sagrada Família | [SF maig 2026.jpg](https://commons.wikimedia.org/wiki/File:SF_maig_2026.jpg) | Canaan | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Akropolis | [Attica 06-13 Athens 50 View from Philopappos - Acropolis Hill.jpg](https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_50_View_from_Philopappos_-_Acropolis_Hill.jpg) | A.Savin | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Lutande tornet i Pisa | [Campanile Dôme - Pise (IT52) - 2022-08-31 - 20.jpg](https://commons.wikimedia.org/wiki/File:Campanile_D%C3%B4me_-_Pise_(IT52)_-_2022-08-31_-_20.jpg) | Chabe01 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Brandenburger Tor | [Brandenburger Tor morgens.jpg](https://commons.wikimedia.org/wiki/File:Brandenburger_Tor_morgens.jpg) | Thomas Wolf , www.foto-tw.de | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Neuschwanstein | [Neuschwanstein Castle 2024-02.jpg](https://commons.wikimedia.org/wiki/File:Neuschwanstein_Castle_2024-02.jpg) | Wilfredor | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Stonehenge | [Stonehenge Total.jpg](https://commons.wikimedia.org/wiki/File:Stonehenge_Total.jpg) | Stefan Kühn | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Mont-Saint-Michel | [Mont St Michel 3, Brittany, France - July 2011.jpg](https://commons.wikimedia.org/wiki/File:Mont_St_Michel_3,_Brittany,_France_-_July_2011.jpg) | Diliff | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |
| Matterhorn | [0 106 Walliser Alpen - Matterhorn.jpg](https://commons.wikimedia.org/wiki/File:0_106_Walliser_Alpen_-_Matterhorn.jpg) | W. Bulach | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Markusplatsen i Venedig | [Piazza San Marco (Venice) at night-msu-2021-6449-.jpg](https://commons.wikimedia.org/wiki/File:Piazza_San_Marco_(Venice)_at_night-msu-2021-6449-.jpg) | Matthias Süßen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Alhambra | [Alhambra detail.jpg](https://commons.wikimedia.org/wiki/File:Alhambra_detail.jpg) | Jebulon | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Atomium | [Laeken Atomium 06.jpg](https://commons.wikimedia.org/wiki/File:Laeken_Atomium_06.jpg) | Zairon | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Kronborgs slott | [Kronborg castle, Helsingør, Denmark.JPG](https://commons.wikimedia.org/wiki/File:Kronborg_castle,_Helsing%C3%B8r,_Denmark.JPG) | Pudelek | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Geirangerfjorden | [Fiordo de Geiranger desde Flydalsjuvet, Noruega, 2019-09-07, DD 61.jpg](https://commons.wikimedia.org/wiki/File:Fiordo_de_Geiranger_desde_Flydalsjuvet,_Noruega,_2019-09-07,_DD_61.jpg) | Diego Delso | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Karlsbron | [North view of Charles Bridge from Mánesův most, Prague 20160808 1.jpg](https://commons.wikimedia.org/wiki/File:North_view_of_Charles_Bridge_from_M%C3%A1nes%C5%AFv_most,_Prague_20160808_1.jpg) | DXR | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Basiliuskatedralen | [00 0568 Saint Basil's Cathedral - Moscow.jpg](https://commons.wikimedia.org/wiki/File:00_0568_Saint_Basil%27s_Cathedral_-_Moscow.jpg) | W. Bulach | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Vasamuseet | [Vasa Museum building view from the sea (3).jpg](https://commons.wikimedia.org/wiki/File:Vasa_Museum_building_view_from_the_sea_(3).jpg) | Hanay | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Jättarnas väg | [Giant's Causeway - Basalt Columns (49527744158).jpg](https://commons.wikimedia.org/wiki/File:Giant%27s_Causeway_-_Basalt_Columns_(49527744158).jpg) | Ajay Suresh from New York, NY, USA | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| Frihetsgudinnan | [Statue of Liberty and a sightseeing boat, Liberty Island, New York.jpg](https://commons.wikimedia.org/wiki/File:Statue_of_Liberty_and_a_sightseeing_boat,_Liberty_Island,_New_York.jpg) | Christian David | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Pyramiderna i Giza | [Pyramids of the Giza Necropolis.jpg](https://commons.wikimedia.org/wiki/File:Pyramids_of_the_Giza_Necropolis.jpg) | KennyOMG | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Taj Mahal | [Taj Mahal (Edited).jpeg](https://commons.wikimedia.org/wiki/File:Taj_Mahal_(Edited).jpeg) | Yann ; edited by Jim Carter | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Operahuset i Sydney | [00 1375 Sydney Opera House (Australia).jpg](https://commons.wikimedia.org/wiki/File:00_1375_Sydney_Opera_House_(Australia).jpg) | W. Bulach | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Kinesiska muren | [GreatWall Badaling.jpg](https://commons.wikimedia.org/wiki/File:GreatWall_Badaling.jpg) | DF08 at English Wikipedia | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |
| Machu Picchu | [80 - Machu Picchu - Juin 2009 - edit.jpg](https://commons.wikimedia.org/wiki/File:80_-_Machu_Picchu_-_Juin_2009_-_edit.jpg) | Martin St-Amant ( S23678 ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Kristusstatyn i Rio de Janeiro | [Christ the Redeemer - Cristo Redentor.jpg](https://commons.wikimedia.org/wiki/File:Christ_the_Redeemer_-_Cristo_Redentor.jpg) | Arne Müseler | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/de/deed.en) |
| Chichén Itzá | [Chichen Itza 3.jpg](https://commons.wikimedia.org/wiki/File:Chichen_Itza_3.jpg) | Daniel Schwen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Grand Canyon | [Grand Canyon view from Pima Point 2010.jpg](https://commons.wikimedia.org/wiki/File:Grand_Canyon_view_from_Pima_Point_2010.jpg) | Chensiyuan | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Golden Gate-bron | [GoldenGateBridge-001.jpg](https://commons.wikimedia.org/wiki/File:GoldenGateBridge-001.jpg) | Rich Niewiroski Jr. | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5) |
| Burj Khalifa | [Dubai skyline 2015 (crop).jpg](https://commons.wikimedia.org/wiki/File:Dubai_skyline_2015_(crop).jpg) | Tim.Reckmann | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Angkor Wat | [Angkor Wat.jpg](https://commons.wikimedia.org/wiki/File:Angkor_Wat.jpg) | Bjørn Christian Tørrissen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Petra | [The Treasury, Petra, Jordan5.jpg](https://commons.wikimedia.org/wiki/File:The_Treasury,_Petra,_Jordan5.jpg) | Diego Delso | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Uluru | [Sunset at Uluru on July 30, 2005.jpg](https://commons.wikimedia.org/wiki/File:Sunset_at_Uluru_on_July_30,_2005.jpg) | Thomas Schoch | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Fuji | [Kodaki fuji frm shojinko refurb.jpg](https://commons.wikimedia.org/wiki/File:Kodaki_fuji_frm_shojinko_refurb.jpg) | 名古屋太郎, (edited by Hannes_24 ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| Niagarafallen | [Horseshoe Falls (Niagara Falls).jpg](https://commons.wikimedia.org/wiki/File:Horseshoe_Falls_(Niagara_Falls).jpg) | Maksimsokolov | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Kilimanjaro | [Kilimanjaro from Amboseli.jpg](https://commons.wikimedia.org/wiki/File:Kilimanjaro_from_Amboseli.jpg) | Sergey Pesterev | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Victoriafallen | [Cataratas Victoria, Zambia-Zimbabue, 2018-07-27, DD 05.jpg](https://commons.wikimedia.org/wiki/File:Cataratas_Victoria,_Zambia-Zimbabue,_2018-07-27,_DD_05.jpg) | Diego Delso | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| Mount Everest | [Mount Everest as seen from Drukair2 PLW edit.jpg](https://commons.wikimedia.org/wiki/File:Mount_Everest_as_seen_from_Drukair2_PLW_edit.jpg) | shrimpo1967 (bearbetad av Papa Lima Whiskey 2) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) |
| Moai-statyerna på Påskön | [Ahu Tongariki.jpg](https://commons.wikimedia.org/wiki/File:Ahu_Tongariki.jpg) | Rivi | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
<!-- bilder:slut -->
