// ============================================================================
// Pluggporten – lärarsidan: guiderna i Hjälp och guide (teacher-hjalp-guider.js, #808)
// ----------------------------------------------------------------------------
// Epic #802 DEL 8. Ren data utan importer och utan DOM. EN guide = nyckel, titel, en
// rad om vad den gör och 3–5 steg. Varje steg kan ha en länk (hash + knapptext) som går
// DIREKT till rätt ställe i den nya strukturen – aldrig via en gammal adress som
// omdirigeras (test/lararsida-hjalp.test.js kontrollerar att varje länk är en riktig
// route och att ?flik=, ?del= och ?verktyg= finns).
//   roll: "admin"    – steget (eller hela guiden) visas bara för admin
//   roll: "arskurs"  – steget visas bara för årskurslärare (admins alternativ står bredvid)
// Texterna är egen markup (<b>), aldrig användartext. Byter en flik adress ändras bara raderna här.
// ============================================================================

const MINA = "#/larare/mina-klasser";

export const GUIDER = [
  {
    key: "ny-klass", titel: "Kom igång med en ny klass",
    kort: "Från en tom klass till elever som kan logga in och ett första område.",
    steg: [
      { roll: "admin", text: "Skapa klassen under <b>Admin → Skapa klass</b>, gärna med elevkonton på en gång.", hash: "#/larare/admin?verktyg=skapa", knapp: "Skapa klass" },
      { roll: "arskurs", text: "Klassen skapas av admin och läggs på ditt konto. Den syns sedan under <b>Mina klasser</b>; saknas den, hör av dig till admin.", hash: MINA, knapp: "Mina klasser" },
      { text: "Välj klassen och öppna fliken <b>Elever</b>. Där finns varje elevs användarnamn och lösenord.", hash: `${MINA}?flik=elever`, knapp: "Elever" },
      { text: "Klicka <b>Skriv ut inloggningskort</b> och dela ut korten. Behöver någon ett nytt lösenord finns <b>Byt lösenord</b> i menyn ⋯.", hash: `${MINA}?flik=elever`, knapp: "Skriv ut korten" },
      { text: "Bestäm vad eleverna ser: markera områdena ni jobbar med under <b>Vad eleverna ser</b>.", hash: `${MINA}?flik=ser`, knapp: "Vad eleverna ser" },
    ],
  },
  {
    key: "vad-eleverna-ser", titel: "Välj vad eleverna ser",
    kort: "Styr vilka områden och delar en klass har i sin meny.",
    steg: [
      { text: "Gå till <b>Mina klasser</b>, välj klassen och öppna fliken <b>Vad eleverna ser</b>.", hash: `${MINA}?flik=ser`, knapp: "Vad eleverna ser" },
      { text: "<b>Steg 1 – områden:</b> markera områdena ni jobbar med nu. Markerar du inga ser eleverna alla.", hash: `${MINA}?flik=ser`, knapp: "Områden" },
      { text: "<b>Steg 2 – delar i elevernas meny:</b> slå på Läsresan, Ekvationsresan, Bråkresan, Schack och de andra delarna klassen ska ha.", hash: `${MINA}?flik=ser`, knapp: "Delar" },
      { text: "Klicka <b>Spara</b>. Eleverna ser ändringen direkt. Under <b>Avancerat</b> kan du dölja enstaka övningslägen i ett område.", hash: `${MINA}?flik=ser`, knapp: "Spara" },
      { text: "Saknas ett område? Skapa eller kopiera det under <b>Material → Plugga-områden</b>.", hash: "#/larare/material?flik=plugga", knapp: "Plugga-områden" },
    ],
  },
  {
    key: "fokuslage", titel: "Fokusläge",
    kort: "Lås en klass till en enda sak, till exempel ett område eller ett prov.",
    steg: [
      { text: "Öppna <b>Mina klasser</b>, välj klassen och fliken <b>Fokusläge</b>.", hash: `${MINA}?flik=fokus`, knapp: "Fokusläge" },
      { text: "Välj vad klassen ska låsas till – ett område, Läsresan, ett prov eller en annan del.", hash: `${MINA}?flik=fokus`, knapp: "Välj mål" },
      { text: "Ställ in till vilken tid låset gäller och klicka <b>Lås klassen</b>. Resten av Pluggporten är stängd för eleverna tills tiden är ute.", hash: `${MINA}?flik=fokus`, knapp: "Lås klassen" },
      { text: "Behöver ni längre tid: klicka <b>+10 min</b> eller liknande. Vill du avsluta: <b>Lås upp nu</b>, eller <b>Stäng av</b> under Att göra på Hem.", hash: "#/larare/hem", knapp: "Hem" },
    ],
  },
  {
    key: "omrade-ai", titel: "Skapa ett område med AI",
    kort: "Låt en AI-tjänst skriva frågorna och klistra in resultatet i Pluggporten.",
    steg: [
      { text: "Öppna <b>Material → Plugga-områden</b> och klicka <b>Skapa nytt område</b>.", hash: "#/larare/material?flik=plugga", knapp: "Plugga-områden" },
      { text: "Fyll i <b>Grundinställningar</b> och välj vad området ska innehålla (frågor, par, texter).", hash: "#/larare/material?flik=plugga", knapp: "Skapa nytt område" },
      { text: "I <b>AI-verkstaden</b> klickar du <b>Kopiera AI-prompt</b>, klistrar in den i en AI-tjänst och kopierar svaret.", hash: "#/larare/material?flik=plugga", knapp: "AI-verkstaden" },
      { text: "Klistra in svaret i Pluggporten och klicka <b>Kontrollera</b>. Rätta det som markeras och granska frågorna.", hash: "#/larare/material?flik=plugga", knapp: "Kontrollera" },
      { text: "Under <b>Synlighet &amp; spara</b> sparar du området. Sedan väljer du det för klassen under <b>Vad eleverna ser</b>.", hash: `${MINA}?flik=ser`, knapp: "Vad eleverna ser" },
    ],
  },
  {
    key: "prov", titel: "Gör ett prov och rätta det",
    kort: "Skapa provet, kör det i klassen och rätta svaren.",
    steg: [
      { text: "Klicka <b>Nytt prov</b> under <b>Prov</b>, lägg till frågor och spara. Du kan också skapa frågorna med AI.", hash: "#/larare/prov?vy=ny", knapp: "Nytt prov" },
      { text: "Testa med <b>Förhandsvisa</b> så ser du provet som en elev.", hash: "#/larare/prov", knapp: "Mina prov" },
      { text: "Klicka <b>Kör i klass</b>, välj klass och <b>Öppna nu</b>. Eleverna skriver provet och lämnar in. Följ det under <b>Provtillfällen</b>.", hash: "#/larare/prov/tillfallen", knapp: "Provtillfällen" },
      { text: "Provet som väntar på rättning står under <b>Att rätta</b> överst på Prov (och på Hem). Klicka <b>Rätta</b>, godkänn förslagen och rätta resten.", hash: "#/larare/prov", knapp: "Att rätta" },
      { text: "Klicka <b>Lämna tillbaka</b> när du är klar. Hur klassen klarade sig ser du under <b>Hur går det? → Prov</b>.", hash: `${MINA}?flik=hur&del=prov`, knapp: "Hur går det? → Prov" },
    ],
  },
  {
    key: "live", titel: "Starta Live",
    kort: "Tävla i klassen eller klass mot klass, med projektorvy.",
    steg: [
      { text: "Öppna <b>Live</b> och välj spel under <b>Skapa Live-match</b>.", hash: "#/larare/live", knapp: "Live" },
      { text: "Välj klass (eller klasser) och frågor, och ändra längd och belöning om du vill.", hash: "#/larare/live", knapp: "Skapa Live-match" },
      { text: "Klicka <b>Skapa lobby</b>. Lobbyn öppnas direkt – visa den på projektorn så att eleverna kan gå med.", hash: "#/larare/live", knapp: "Skapa lobby" },
      { text: "Starta matchen när alla är med. Hur det gick ser du sedan under <b>Hur går det? → Live</b>.", hash: `${MINA}?flik=hur&del=live`, knapp: "Hur går det? → Live" },
      { roll: "admin", text: "Admin skapar också veckotävlingar under <b>Live → Mattematchen</b>.", hash: "#/larare/mattematchen", knapp: "Mattematchen" },
    ],
  },
  {
    key: "nivaer", titel: "Ändra elevernas nivåer i Läsresan och Ekvationsresan",
    kort: "Sätt en nivå för en elev eller för hela klassen.",
    steg: [
      { text: "Öppna <b>Mina klasser</b>, välj klassen och fliken <b>Hur går det?</b>.", hash: `${MINA}?flik=hur`, knapp: "Hur går det?" },
      { text: "Välj <b>Läsresan</b>. Klicka <b>Ändra nivå för klassen…</b> eller öppna en elev och använd <b>Ändra nivå</b>.", hash: `${MINA}?flik=hur&del=lasresan`, knapp: "Läsresan" },
      { text: "Välj <b>Ekvationsresan</b> på samma sätt: <b>Ändra nivå för hela klassen</b> eller <b>Spara nivå</b> för en elev.", hash: `${MINA}?flik=hur&del=ekvationsresan`, knapp: "Ekvationsresan" },
      { text: "Vill du se uppgifterna själv? Prova Ekvationsresan som en elev under <b>Material</b>; inget sparas.", hash: "#/larare/material?flik=ekvationsresan", knapp: "Material → Ekvationsresan" },
    ],
  },
];

/** Guiderna rollen ser, med stegen som gäller rollen (admin = true/false). */
export function guiderFor(admin) {
  return GUIDER.filter((g) => g.roll !== "admin" || admin).map((g) => ({
    ...g,
    steg: g.steg.filter((s) => !s.roll || (s.roll === "admin" ? admin : !admin)),
  }));
}
