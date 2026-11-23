// ============================================================================
// QA-seed för #903 (Veckoschema E: Matchdagen under en lektion) – BARA mot emulatorn,
// via QA-proxyns Firestore-REST ("Bearer owner"). Körs efter admin/qa-matchdagen-874-preview.sh.
// Lägger till ämnet NO (qano, ett område med quiz) och Svenska (qasv, bara texter = inget
// underlag), och 4A ser SO + NO + Svenska + additionen. Lektionen sätts med
// admin/qa-veckoschema-902.mjs lektion --amne=qano|qasv --dag=N --start=HH:MM --slut=HH:MM.
//   QA_URL=<preview-origin> node admin/qa-matchdagen-903-seed.mjs
// ============================================================================

const BAS = (process.env.QA_URL || "http://127.0.0.1:8903").replace(/\/$/, "");
const DB = `${BAS}/v1/projects/${process.env.GCLOUD_PROJECT || "pluggportalen-so-2026"}/databases/(default)/documents`;
const H = { "Content-Type": "application/json", Authorization: "Bearer owner" };

function v(x) {
  if (x === null) return { nullValue: null };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(v) } };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
  return { stringValue: String(x) };
}
async function satt(path, data, mask = null) {
  const q = mask ? "?" + mask.map((k) => `updateMask.fieldPaths=${k}`).join("&") : "";
  const r = await fetch(`${DB}/${path}${q}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, y]) => [k, v(y)])) }) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}
async function lista(path) {
  const r = await fetch(`${DB}/${path}?pageSize=100`, { headers: H });
  return ((await r.json()).documents || []).map((d) => d.name.split("/").pop());
}

await satt("subjects/qano", { name: "NO", order: 90 });
await satt("subjects/qano/areas/kroppen", {
  name: "Kroppen", order: 1, coverEmoji: "🫀",
  quiz: [
    { question: "Vilket organ pumpar blodet?", options: ["Hjärtat", "Lungorna", "Magen"], answerIndex: 0 },
    { question: "Hur många ben har en vuxen människa ungefär?", options: ["206", "52", "1000"], answerIndex: 0 },
    { question: "Vad andas vi in?", options: ["Syre", "Koldioxid", "Kväve"], answerIndex: 0 },
  ],
  pairs: [{ term: "hjärta", definition: "pumpar blodet" }, { term: "lungor", definition: "tar upp syre" }],
});
await satt("subjects/qasv", { name: "Svenska", order: 91 });
await satt("subjects/qasv/areas/lasa", { name: "Läsa", order: 1, texts: [{ title: "Text", body: "En kort text." }] });
const so = (await lista("subjects/so/areas"))[0];
await satt("classes/4a", { assignedAreas: [
  { subjectId: "matte", areaId: "md-addition" }, { subjectId: "so", areaId: so },
  { subjectId: "qano", areaId: "kroppen" }, { subjectId: "qasv", areaId: "lasa" },
] }, ["assignedAreas"]);
console.log(`✓ #903: qano/kroppen (quiz), qasv/lasa (bara text); 4A ser matte/md-addition, so/${so}, qano/kroppen, qasv/lasa.`);
