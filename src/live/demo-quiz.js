// ============================================================================
// Långa quizfrågor för demolägen och förhandsvisningar (#621). Riktiga
// Plugga-quiz har ofta långa frågor och svarsalternativ (och lästext, #582) –
// till skillnad från multiplikationens korta tal. Används av Snilleblixtens
// demo (?fragor=quiz) och preview/preview-live-langtext.html. Bara dynamiskt
// laddad (aldrig i bootkedjan).
//
// API
//   DEMO_QUIZ  [{ text, options[4], answerIndex, passage }]
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
