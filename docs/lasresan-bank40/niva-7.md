# Läsresan – textbank nivå 7 (40 texter, issue #512, epic #482)

Ämnesplan för nivå 7 (280–500 ord, 9 frågor per text, blandade kategorier som i de befintliga texterna). De 6 befintliga texterna från #408 ligger kvar orörda först i `src/lasresan/content/bank/level-7.json`; de 34 nya ligger efter dem i tabellens ordning.

## Fördelning
- 20 story + 20 fact.
- Story: skola 3, vardag 3, mysterier 3, roliga situationer 3, relationer 3, äventyr 3, sport 2.
- Fact: djur 3, natur 3, historia 3, rymden 3, teknik 3, geografi 3, vetenskap 2.
- Frågekategorier (alla 360 frågor): fakta 98, ordförståelse 51, mellan raderna 150, helhet/slutsats 61.
- Rätt svars position (alla 360 frågor): A 91, B 91, C 89, D 89 (25 % var).
- Rätt svar unikt längst: 66 av 360 (18 %); bland de 306 nya frågorna 59 (19 %). De 6 befintliga texterna står för 7 av 54 (13 %).
- Ordantal för de nya texterna: 384–473.
- Huvudpersonernas och bipersonernas namn är unika inom nivån och krockar inte med andra nivåer (kontrollerat mot alla `level-*.json` på grenen och nivå 6 från #513:s färdiga gren).

## Undvikna överlapp mot andra nivåer
Planen är gjord mot alla `level-*.json` och `niva-1.md`–`niva-5.md` på grenen samt nivå 6 (`level-6.json`, `niva-6.md`) från #513:s gren. Inga faktaämnen som redan finns (t.ex. bin, blåval, lax, ål, elefanter, björndjur, hajar, kråkfåglar, flyttfåglar, invasiva arter, Pompeji, Vasaskeppet, digerdöden, emigrationen, tryckpressen, rösträtten, vaccinet, svarta hål, exoplaneter, rymdskrot, Voyager, Jupiter, Mars, solceller, broar, lås, slussar, kryptering, AI, Kiruna, Japan, Everest, tidszoner, monsunen, Grönland, urbanisering, bakterier, sömn, vetenskaplig metod). Nivå 6 (#513) skrevs parallellt och blev klar först. Den hade sju av de faktaämnen som först planerades här (elefanter, björndjur, rösträtt, rymdskrot, exoplaneter, kryptering, tidszoner). Därför ersattes de på nivå 7 med djuphavet, myggan, Titanic, meteoriten, Venus, vattenkraften och Antarktis. Elnätet byttes mot pekskärmen, eftersom det låg för nära vattenkraften. Även en del av lr-n7-glida-isar (ett elakt meddelande som raderas) skrevs om, eftersom den liknade lr-n6-nya-kompisen. Nivå 6 och 7 är jämförda mot varandra, både ämnen och namn.

## Texter
| id | typ | topic | titel | huvudperson | vinkel |
|---|---|---|---|---|---|
| (befintlig) lr-n7-eken | story | vardag | Eken på tomtgränsen | Idun | Grannar bråkar om en gammal ek; båda har rätt på olika sätt |
| (befintlig) lr-n7-bilden-i-chatten | story | relationer | Bilden i chatten | Arvid | En elak bild sprids; lojalitet mot vad som är rätt |
| (befintlig) lr-n7-overraskningen | story | roliga situationer | Den perfekta överraskningen | Vera | Överraskningsfesten där allt går fel |
| (befintlig) lr-n7-invasiva-arter | fact | natur | När en art hamnar på fel plats | — | Invasiva arter, orsak och följder |
| (befintlig) lr-n7-vetenskaplig-metod | fact | vetenskap | Hur vet vi att något fungerar? | — | Vetenskaplig metod, kontrollgrupp, placebo |
| (befintlig) lr-n7-staderna | fact | geografi | Varför flyttar allt fler till städerna? | — | Urbanisering, orsaker och följder |
| lr-n7-debatten | story | skola | Fel sida | Hjördis | Lottas att debattera för den sida hon ogillar och förstår motståndarna bättre |
| lr-n7-jubileet | story | skola | Hundra år i samma korridor | Elof | Intervjuar en äldre kvinna inför skolans jubileum; hennes bild av skolan förr är inte den han väntade sig |
| lr-n7-laxhjalpen | story | skola | Att förklara bråk | Harald | Mattesnillet blir läxhjälp åt en fyra och märker att han inte förstår det han kan |
| lr-n7-allergin | story | vardag | Kalaset utan nötter | Dagny | Lillasystern får svår nötallergi; vardagen ändras och Dagny tar ansvar på ett kalas |
| lr-n7-tidningsrundan | story | vardag | Klockan halv fem | Ville | Följer med mamma på morgonens tidningsrunda och ser hennes arbete med nya ögon |
| lr-n7-gastboken | story | mysterier | Gästboken i stugan | Truls | Hyrstugans gästbok har anteckningar från dagar då ingen hyrde; spåren leder till ägarens äldre bror |
| lr-n7-hotellet | story | mysterier | Stegen på fjärde våningen | Farah | Nattliga steg på ett gammalt hotell; logiska ledtrådar i stället för spöken |
| lr-n7-kartfallan | story | mysterier | Gatan som inte finns | Stina | En gata på en gammal stadskarta finns inte; det visar sig vara en avsiktlig kartfälla |
| lr-n7-oversattningen | story | roliga situationer | Appen som ljög | Tekla | Översättningsappen på utbytesresan säger något helt annat än hon tror |
| lr-n7-maskoten | story | roliga situationer | Inne i björnen | Valter | Får bära skolans maskotdräkt på en match, ser ingenting och hamnar fel |
| lr-n7-glida-isar | story | relationer | Två som brukade vara en | Signy, Iben | Bästa vännerna glider isär när den ena hittar nya intressen; ingen är skurk |
| lr-n7-ladbilen | story | relationer | Lådbilen | Loke | Bonuspappan försöker för mycket; ett misslyckat lådbilsbygge blir början |
| lr-n7-kajaken | story | äventyr | När åskan kom över fjärden | Elis | Kajaktur i skärgården, åskväder närmar sig, beslut om att gå i land |
| lr-n7-flotten | story | äventyr | Sex dagar på älven | Svea | Familjen bygger en timmerflotte och flyter nedför en älv; tålamod och samarbete |
| lr-n7-snogrottan | story | äventyr | Natten i snögrottan | Ossian | Vintertur, oväder, de gräver en snögrotta och måste lita på kunskap |
| lr-n7-volten | story | sport | Spärren | Thea | Gymnasten som plötsligt inte vågar göra volten hon kunnat i flera år |
| lr-n7-rullstolsbasket | story | sport | Fyra hjul och en korg | Joar, Yara | Joar följer med Yara på rullstolsbasket och förlorar stort; respekt och regler |
| lr-n7-vargen | fact | djur | Vargen kommer tillbaka | — | Vargens återkomst i Sverige, konflikter och olika intressen |
| lr-n7-ozonlagret | fact | natur | Hålet i himlen som håller på att läkas | — | Ozonlagret, freoner och ett internationellt förbud som fungerade |
| lr-n7-mikroplast | fact | natur | Plast man inte ser | — | Mikroplast: var den kommer ifrån, vart den tar vägen, vad vi vet och inte vet |
| lr-n7-berlinmuren | fact | historia | Muren genom staden | — | Berlinmuren 1961–1989, delat Tyskland och murens fall |
| lr-n7-fabrikerna | fact | historia | När maskinerna kom | — | Industriella revolutionen, ångmaskinen och barnarbete |
| lr-n7-ljusar | fact | rymden | Att se bakåt i tiden | — | Ljusår, ljusets fart och att stjärnljus är gammalt |
| lr-n7-djuphavet | fact | djur | Ljus i det eviga mörkret | — | Djuphavets mörker och tryck, bioluminiscens, marin snö, varma källor |
| lr-n7-myggan | fact | djur | Det farligaste djuret | — | Bara honor suger blod, malaria, frossan i Sverige förr, frågan om att utrota arter |
| lr-n7-titanic | fact | historia | Natten då det osänkbara sjönk | — | Titanic 1912, för få livbåtar enligt dåtidens regler, säkerhetsavtalet efteråt |
| lr-n7-meteoriten | fact | rymden | Dagen då dinosaurierna försvann | — | Iridiumlagret, kratern i Mexiko, asteroid/meteor/meteorit, följderna, DART 2022 |
| lr-n7-venus | fact | rymden | Planeten som blev för varm | — | Venus: hetast i solsystemet, skenande växthuseffekt, dygn längre än år |
| lr-n7-containern | fact | teknik | Lådan som förändrade världshandeln | — | Containern, standardmått och billigare transporter |
| lr-n7-vattenkraften | fact | teknik | Älvarna som ger ström | — | Vattenkraft: fallhöjd, turbin, magasin; för- och nackdelar, nationalälvarna |
| lr-n7-pekskarmen | fact | teknik | Skärmen som känner fingret | — | Hur en pekskärm känner av fingret (kapacitiv), varför vantar inte fungerar |
| lr-n7-golfstrommen | fact | geografi | Därför är Norden inte lika kallt | — | Golfströmmen och havsströmmar som värmepump |
| lr-n7-antarktis | fact | geografi | Kontinenten som ingen äger | — | Antarktis: is, kyla, forskning och Antarktisfördraget |
| lr-n7-antibiotika | fact | vetenskap | Läkemedlet som kan sluta fungera | — | Penicillinet och antibiotikaresistens |

Att jämföra i #514: lr-n7-oversattningen (översättningsapp, ordagranna idiom, komik) och lr-n6-tolken (tolkar sitt eget utvecklingssamtal) handlar båda om språk och översättning, men har olika genre och poäng. lr-n7-ladbilen (bonuspappa) och lr-n6-bonusbrodern handlar båda om en ny familjemedlem.
