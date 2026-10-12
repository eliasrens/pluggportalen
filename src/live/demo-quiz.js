// ============================================================================
// Långa quizfrågor för demolägen och förhandsvisningar (#621). Riktiga
// Plugga-quiz har ofta långa frågor och svarsalternativ (och lästext, #582) –
// till skillnad från multiplikationens korta tal. Används av Snilleblixtens
// demo (?fragor=quiz) och preview/preview-live-langtext.html. Bara dynamiskt
// laddad (aldrig i bootkedjan).
//
// API
//   DEMO_QUIZ  [{ text, options[4], answerIndex, passage }]
//   DEMO_TIMELINE  Vasatiden-händelser i områdets form (#596: area.timeline[]) –
//                  tidslinjefrågor i Snilleblixtens demo (?fragor=tidslinje, #600)
// ============================================================================

export const DEMO_QUIZ = Object.freeze([
  {
    text: "Familjen Berg har 4 000 kr. Flygbiljetter kostar 1 604 kr per person och de är fyra personer. Räcker pengarna till biljetterna?",
    options: ["Ja, och det blir pengar över", "Nej, de kostar ungefär 6 400 kr", "Ja, det går precis jämnt ut", "Nej, de kostar ungefär 5 000 kr"],
    answerIndex: 1,
    passage: "Familjen Berg ska resa till sin mormor i Luleå under sportlovet. Pappa har sparat ihop 4 000 kronor i en burk på köksbänken. På resebyråns hemsida ser de att en flygbiljett kostar 1 604 kronor per person. Familjen är fyra personer: mamma, pappa, Lisa och lillebror Måns.",
  },
  {
    text: "Varför byggde vikingarna sina långskepp med låg köl och grunt skrov?",
    options: ["För att kunna segla uppför grunda floder", "För att skeppen skulle bli snabbare i storm", "För att det fanns för lite trä i Norden", "För att kungen bestämde att alla skepp skulle se likadana ut"],
    answerIndex: 0,
    passage: "Vikingarnas långskepp var smala och lätta. De kunde både ros och seglas. Eftersom skrovet var grunt kunde skeppen ta sig långt upp i floderna i Ryssland och Frankrike, och besättningen kunde dra upp dem direkt på en strand.",
  },
  {
    text: "Vilket av alternativen beskriver bäst vad fotosyntesen är?",
    options: ["Växter gör socker av ljus, vatten och koldioxid", "Djur andas in syre och andas ut koldioxid", "Vatten avdunstar från haven och blir moln", "Rötterna suger upp näring ur jorden"],
    answerIndex: 0,
    passage: "",
  },
  {
    text: "Vad är huvudstaden i Norge?",
    options: ["Oslo", "Bergen", "Trondheim", "Stavanger"],
    answerIndex: 0,
    passage: "",
  },
]);

export const DEMO_TIMELINE = Object.freeze([
  { id: "e1", event: "Stockholms blodbad", question: "Vilket år inträffade Stockholms blodbad?", year: 1520,
    description: "Den danske kungen Kristian II lät avrätta många svenska stormän på Stortorget i Stockholm.",
    explanation: "Stockholms blodbad skedde i november 1520." },
  { id: "e2", event: "Gustav Vasa väljs till kung", question: "Vilket år valdes Gustav Vasa till Sveriges kung?", year: 1523,
    description: "Efter upproret mot danskarna valdes Gustav Vasa till kung i Strängnäs.",
    explanation: "Den 6 juni 1523 – därför är 6 juni Sveriges nationaldag." },
  { id: "e3", event: "Riksdagen i Västerås", question: "Vilket år tog kungen över kyrkans egendom vid riksdagen i Västerås?", year: 1527,
    description: "Kungen fick makt över kyrkan och dess rikedomar. Det blev början på reformationen.",
    explanation: "Riksdagen i Västerås hölls 1527." },
  { id: "e4", event: "Bibeln på svenska", question: "Vilket år trycktes hela Bibeln på svenska för första gången?", year: 1541,
    description: "Hela Bibeln översattes till svenska och trycktes. Den kallas Gustav Vasas bibel.",
    explanation: "Gustav Vasas bibel trycktes 1541 i Uppsala." },
  { id: "e5", event: "Gustav Vasa dör", question: "Vilket år dog Gustav Vasa?", year: 1560,
    description: "Den gamle kungen dog efter en lång tid på tronen, och hans son Erik blev kung.",
    explanation: "Gustav Vasa dog 1560 och sonen blev kung Erik XIV." },
]);
