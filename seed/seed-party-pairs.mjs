// ============================================================================
// Lägg till partibilds-par i DEMOKRATI-området (live-Firestore).
// ----------------------------------------------------------------------------
//   node seed/seed-party-pairs.mjs          (torrkörning – hämtar, validerar, visar)
//   node seed/seed-party-pairs.mjs --write  (skriver tillbaka till Firestore)
//
// Detta verktyg är ADDITIVT och idempotent: det HÄMTAR arbetsområdet
// subjects/so/areas/valet-och-demokrati-stort, lägger till bildpar för riksdagens
// 8 partier (partisymbol ↔ partinamn) UTAN att röra befintliga texter/quiz/pairs,
// kör HELA området genom validate.js och skriver tillbaka via samma REST-väg som
// seed/seed.mjs (öppna säkerhetsregler, webb-API-nyckel). Kör man det igen läggs
// inga dubbletter till (par-id:na är stabila).
// ============================================================================

import { validateArea } from "../src/validate.js";
import { listPairImageKeys } from "../src/pair-images.js";

const PROJECT = "pluggportalen-so-2026";
const KEY = "AIzaSyB34GPjLkIuJNbgTGOrm6sRMIAisx9aJ3w";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const SUBJECT = "so";
const AREA = "valet-och-demokrati-stort";
const WRITE = process.argv.includes("--write");

// Riksdagens 8 partier som bildpar: partisymbol (term-bild) ↔ partinamn (definition).
// Nyckel + namn hämtas ur bildpaketet så listan alltid matchar pair-images.js.
const PARTY_PAIRS = listPairImageKeys().map(({ key, name }) => ({
  id: `partisymbol-${key.split("/").pop()}`,
  term: "",
  termImage: key,
  definition: name,
}));

// --- Firestore REST <-> JS -------------------------------------------------
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  throw new Error("Kan inte koda värde: " + v);
}
function toFields(obj) {
  const fields = {};
  for (const [k, val] of Object.entries(obj)) fields[k] = toValue(val);
  return fields;
}
function fromValue(v) {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(f) {
  const o = {};
  for (const [k, val] of Object.entries(f)) o[k] = fromValue(val);
  return o;
}

async function getArea() {
  const url = `${BASE}/subjects/${SUBJECT}/areas/${AREA}?key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} kunde inte hämta området: ${await res.text()}`);
  const doc = await res.json();
  return fromFields(doc.fields || {});
}

async function setArea(value) {
  const url = `${BASE}/subjects/${SUBJECT}/areas/${AREA}?key=${KEY}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFields(value) }),
  });
  if (!res.ok) throw new Error(`${res.status} kunde inte spara: ${await res.text()}`);
}

async function main() {
  const area = await getArea();
  area.id = AREA;
  const before = (area.pairs || []).length;

  // Additivt: lägg bara till partibilds-par som inte redan finns (per id).
  const existingIds = new Set((area.pairs || []).map((p) => p.id));
  const toAdd = PARTY_PAIRS.filter((p) => !existingIds.has(p.id));
  area.pairs = [...(area.pairs || []), ...toAdd];

  // Kör HELA området genom valideringen innan sparning.
  const res = validateArea(area);
  if (!res.ok) {
    console.error("✗ Validering misslyckades – sparar INTE:");
    res.errors.forEach((e) => console.error("   - " + e));
    process.exit(1);
  }

  const imgPairs = res.value.pairs.filter((p) => p.termImage || p.defImage);
  console.log(`Område: ${res.value.name} (${AREA})`);
  console.log(`Par: ${before} → ${res.value.pairs.length} (+${toAdd.length} nya bildpar)`);
  console.log(`Bildpar totalt: ${imgPairs.length}`);
  imgPairs.forEach((p) => console.log(`   ${p.termImage || p.defImage} ↔ "${p.definition || p.term}"`));

  if (!WRITE) {
    console.log("\nTorrkörning (validerat, inte sparat). Kör med --write för att spara.");
    return;
  }
  await setArea(res.value);
  console.log("\n✓ Sparat till Firestore. 🎉");
}

main().catch((e) => {
  console.error("Fel:", e.message);
  process.exit(1);
});
