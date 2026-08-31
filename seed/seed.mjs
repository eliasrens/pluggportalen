// ============================================================================
// Kommandorads-seeder (Node) för Pluggportalen.
//
//   node seed/seed.mjs
//
// Skriver exempeldatan i seed-data.js till Firestore via REST-API:t med
// webb-API-nyckeln. Fungerar tack vare de öppna säkerhetsreglerna
// (allow write: if true) – samma väg som webbklienten använder.
//
// Alternativ utan terminal: öppna seed/seed.html i webbläsaren.
// ============================================================================

// OBS: importerar INTE src/firebase-config.js här – den laddar Firebase-SDK:t
// från en https-URL vilket Node inte kan importera. Config-värdena (publika)
// hålls i synk manuellt.
import { subjects, areas, students } from "./seed-data.js";

const PROJECT = "pluggportalen-so-2026";
const KEY = "AIzaSyB34GPjLkIuJNbgTGOrm6sRMIAisx9aJ3w";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// --- JS-värde -> Firestore REST-typ ---------------------------------------
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
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

// PATCH skapar/ersätter dokumentet på angiven sökväg.
async function setDoc(path, obj) {
  const url = `${BASE}/${path}?key=${KEY}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFields(obj) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
}

async function main() {
  for (const s of subjects) {
    await setDoc(`subjects/${s.id}`, s);
    console.log(`✓ Ämne: ${s.name}`);
    for (const area of areas[s.id] || []) {
      await setDoc(`subjects/${s.id}/areas/${area.id}`, area);
      console.log(
        `  ✓ Arbetsområde: ${area.name} (${area.texts.length} texter, ` +
          `${area.quiz.length} frågor, ${area.pairs.length} par)`
      );
    }
  }
  for (const st of students) {
    const { id, ...rest } = st;
    await setDoc(`students/${id}`, rest);
    await setDoc(`studentData/${id}`, {
      coins: 0,
      progress: {},
      ownedItems: [],
      room: { placements: {} },
      avatarId: st.avatarId,
    });
    console.log(`✓ Elev: ${st.namn} (login: ${st.username} / ${st.password})`);
  }
  console.log("\nKlart! Databasen är seedad. 🎉");
}

main().catch((e) => {
  console.error("Fel vid seedning:", e.message);
  process.exit(1);
});
