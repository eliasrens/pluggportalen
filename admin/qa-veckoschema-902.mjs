// ============================================================================
// QA (#902, veckoschemat på elevsidan) – BARA mot emulatorn, via QA-proxyn
// (admin/qa-emulator-proxy.mjs, Firestore-REST med "Bearer owner"). Sätter
// klassens schema och fokuslås direkt (lärarsidans sektion är Del C, #901).
// Körs mot admin/qa-matchdagen-867-preview.sh (klass 4a, ämnena so/matte).
//   QA_URL=http://127.0.0.1:8902 node admin/qa-veckoschema-902.mjs <kommando> [--flaggor]
//   lektion --amne=so --dag=1 --start=00:00 --slut=01:00 [--id=qa902] [--pa=0]
//   pa | av                 "Aktivera veckoschemat" i/ur (lektionerna står kvar)
//   las --till=<epoch-ms>   fokuslås till första SO-området
//   upplas | rensa          ta bort låset | ta bort schema och lås
//   visa                    skriv ut klassens schema och lås
// Klassen väljs med --klass=4a.
// ============================================================================

const BAS = (process.env.QA_URL || "http://127.0.0.1:8902").replace(/\/$/, "");
const DB = `${BAS}/v1/projects/${process.env.GCLOUD_PROJECT || "pluggportalen-so-2026"}/databases/(default)/documents`;
const H = { "Content-Type": "application/json", Authorization: "Bearer owner" };

const [cmd, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const klass = `classes/${opt.klass || "4a"}`;

/** JS → Firestore-REST-värde. */
function v(x) {
  if (x === null) return { nullValue: null };
  if (x instanceof Date) return { timestampValue: x.toISOString() };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(v) } };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
  return { stringValue: String(x) };
}
/** Firestore-REST-värde → JS. */
function js(x) {
  if (!x) return undefined;
  if ("mapValue" in x) return Object.fromEntries(Object.entries(x.mapValue.fields || {}).map(([k, y]) => [k, js(y)]));
  if ("arrayValue" in x) return (x.arrayValue.values || []).map(js);
  if ("integerValue" in x) return Number(x.integerValue);
  return Object.values(x)[0];
}

async function hamta(path) {
  const r = await fetch(`${DB}/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return Object.fromEntries(Object.entries((await r.json()).fields || {}).map(([k, y]) => [k, js(y)]));
}
/** Skriv (eller ta bort, värde undefined) fälten i `falt` på klassen. */
async function satt(falt) {
  const mask = Object.keys(falt).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const fields = Object.fromEntries(Object.entries(falt).filter(([, y]) => y !== undefined).map(([k, y]) => [k, v(y)]));
  const r = await fetch(`${DB}/${klass}?${mask}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${klass}: ${r.status} ${await r.text()}`);
}

const nu = await hamta(klass);
const schema = { pa: false, lektioner: [], koppling: {}, ...(nu.schema || {}) };
const spara = (s) => satt({ schema: { pa: s.pa, lektioner: s.lektioner, koppling: s.koppling, updatedAt: new Date(), updatedBy: "qa-902" } });

if (cmd === "lektion") {
  const l = { id: opt.id || "qa902", dag: Number(opt.dag || 1), start: opt.start || "00:00", slut: opt.slut || "01:00", amne: opt.amne || "so" };
  await spara({ ...schema, pa: opt.pa !== "0", lektioner: [...schema.lektioner.filter((x) => x.id !== l.id), l] });
  console.log("lektion", l);
} else if (cmd === "pa" || cmd === "av") {
  await spara({ ...schema, pa: cmd === "pa" });
  console.log("pa:", cmd === "pa", "lektioner:", schema.lektioner.length);
} else if (cmd === "las") {
  const r = await fetch(`${DB}/subjects/so/areas?pageSize=50`, { headers: H });
  const areas = (await r.json()).documents.map((d) => ({ id: d.name.split("/").pop(), name: js(d.fields.name), order: js(d.fields.order) ?? 0 }));
  const area = areas.sort((a, b) => a.order - b.order)[0];
  await satt({ lock: { mal: { typ: "omrade", id: `so/${area.id}`, namn: area.name }, till: Number(opt.till), doljOvrigt: false } });
  console.log("lås till", area.id, new Date(Number(opt.till)).toISOString());
} else if (cmd === "upplas") {
  await satt({ lock: undefined });
  console.log("upplåst");
} else if (cmd === "rensa") {
  await satt({ lock: undefined, schema: undefined });
  console.log("rensat");
} else if (cmd === "visa") {
  console.log(JSON.stringify({ schema: nu.schema, lock: nu.lock }, null, 1));
} else {
  console.error("okänt kommando:", cmd);
  process.exit(1);
}
