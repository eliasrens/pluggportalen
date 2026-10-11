// Ett inklistrat AI-svar för ett Vasatiden-område med quiz, par OCH tidslinje
// (Tidsjakten, issue #596). Används av test/tidsjakt-innehall.test.js (validering
// + merge) och test/firestore-rules-tidsjakt.test.js (sparas mot emulatorn).
// Sträng – precis som läraren klistrar in den i materialrutan.

export const VASATIDEN_JSON = `{
  "id": "vasatiden",
  "name": "Vasatiden",
  "order": 3,
  "coverEmoji": "👑",
  "description": "Gustav Vasa, kyrkan och det nya Sverige.",
  "texts": [
    { "id": "gustav-vasa", "title": "Gustav Vasa", "body": "Gustav Vasa blev kung efter ett uppror mot den danske kungen. Han gjorde Sverige till ett eget land med en stark kung." }
  ],
  "quiz": [
    {
      "id": "q1",
      "question": "Vem blev kung efter upproret mot Kristian II?",
      "options": ["Gustav Vasa", "Erik XIV", "Karl XII", "Gustav II Adolf"],
      "answerIndex": 0,
      "explanation": "Gustav Vasa ledde upproret och valdes till kung.",
      "passage": "Kristian II var kung över hela Norden. Många svenskar ville inte ha en dansk kung. Gustav Vasa samlade bönder i Dalarna och gjorde uppror. Efter upproret valdes han till Sveriges kung.",
      "category": "fakta"
    },
    {
      "id": "q2",
      "question": "Vad betyder reformationen?",
      "options": ["Kyrkan blev protestantisk", "Sverige fick en ny flagga", "Bönderna fick rösta", "Kungen flyttade till Danmark"],
      "answerIndex": 0,
      "explanation": "Reformationen gjorde kyrkan protestantisk och kungen fick makt över den.",
      "passage": "Under Gustav Vasas tid förändrades kyrkan. Kungen tog kyrkans pengar och mark. Gudstjänsterna började hållas på svenska. Det kallas reformationen.",
      "category": "begrepp"
    }
  ],
  "pairs": [
    { "id": "p1", "term": "Reformationen", "definition": "När kyrkan blev protestantisk", "category": "begrepp" },
    { "id": "p2", "term": "Arvrike", "definition": "Kungens barn ärver kronan", "category": "begrepp" }
  ],
  "timeline": [
    {
      "id": "e1",
      "event": "Stockholms blodbad",
      "question": "Vilket år inträffade Stockholms blodbad?",
      "year": 1520,
      "description": "Den danske kungen Kristian II lät avrätta många svenska stormän på Stortorget i Stockholm.",
      "explanation": "Stockholms blodbad skedde i november 1520 och fick många svenskar att göra uppror."
    },
    {
      "id": "e2",
      "event": "Gustav Vasa väljs till kung",
      "question": "Vilket år valdes Gustav Vasa till Sveriges kung?",
      "year": 1523,
      "description": "Efter upproret mot danskarna valdes Gustav Vasa till kung i Strängnäs.",
      "explanation": "Gustav Vasa valdes till kung den 6 juni 1523. Därför är 6 juni Sveriges nationaldag."
    },
    {
      "id": "e3",
      "event": "Riksdagen i Västerås och reformationen",
      "question": "Vilket år bestämde riksdagen i Västerås att kungen skulle ta över kyrkans egendom?",
      "year": 1527,
      "description": "Kungen fick makt över kyrkan och dess rikedomar. Det blev början på reformationen i Sverige.",
      "explanation": "Riksdagen i Västerås hölls 1527."
    },
    {
      "id": "e4",
      "event": "Bibeln på svenska",
      "question": "Vilket år trycktes hela Bibeln på svenska för första gången?",
      "year": 1541,
      "description": "Hela Bibeln översattes till svenska och trycktes. Den kallas Gustav Vasas bibel.",
      "explanation": "Gustav Vasas bibel trycktes 1541 i Uppsala."
    },
    {
      "id": "e5",
      "event": "Gustav Vasa dör",
      "question": "Vilket år dog Gustav Vasa?",
      "year": 1560,
      "description": "Den gamle kungen dog efter en lång tid på tronen, och hans son Erik blev kung.",
      "explanation": "Gustav Vasa dog 1560 och hans son blev kung Erik XIV."
    }
  ],
  "timelineSpan": { "from": 1500, "to": 1580 }
}`;
