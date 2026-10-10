// QA #561: skapa en Snilleblixt-session med APPENS createLiveSession (som lärarformuläret).
//   QA_UID=rasmus QA_ROLL=larare node --import ./admin/qa-node-app-loader.mjs admin/qa-sb561-skapa.mjs '<input-json>'
const input = JSON.parse(process.argv[2]);
await import("../src/live/modes/index.js"); // registret fylls som när lärarformuläret laddas
const live = await import("../src/live/live-data.js");
console.log(await live.createLiveSession({ createdByName: process.env.QA_UID, ...input }, process.env.QA_UID));
process.exit(0);
