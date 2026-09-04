// ============================================================================
// Kommandorads-seeder (Node, Admin SDK) för Pluggportalen.
//
//   node seed/seed.mjs
//
// Skriver exempeldatan i seed-data.js till Firestore. Sedan härdningen är
// säkerhetsreglerna STÄNGDA (ingen "allow write: if true"), så den gamla vägen
// (REST + publik webb-nyckel) funkar inte längre. Seedern går därför via
// Admin SDK med ett service-account (admin/_shared.mjs), vilket kringgår
// reglerna legitimt. Mot emulatorn: sätt FIRESTORE_EMULATOR_HOST/
// FIREBASE_AUTH_EMULATOR_HOST (se docs/ADMIN.md).
//
// För exempeleleven skapas även ett Firebase Auth-konto (uid = doc-id), så att
// man kan logga in direkt efter seedning. `password`-fältet skrivs INTE till
// students-dokumentet (lösenordet bor i Auth). Idempotent: kör flera gånger.
// ============================================================================

import { auth, db, usernameToEmail, isEmulator, admin } from "../admin/_shared.mjs";
import { subjects, areas, students } from "./seed-data.js";

async function ensureAuth(uid, username, password) {
  const email = usernameToEmail(username);
  try {
    await auth.getUser(uid);
    // Finns redan – uppdatera e-post (och lösenord om >= 6) så det är i synk.
    const patch = { email };
    if (typeof password === "string" && password.length >= 6) patch.password = password;
    await auth.updateUser(uid, patch);
    return "uppdaterat";
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    if (!(typeof password === "string" && password.length >= 6)) {
      throw new Error(
        `Kan inte skapa Auth-konto för ${username}: lösenordet måste vara minst 6 tecken.`
      );
    }
    await auth.createUser({ uid, email, password });
    return "skapat";
  }
}

async function main() {
  console.log(`Seedar → ${isEmulator ? "EMULATOR" : "LIVE"}\n`);

  for (const s of subjects) {
    const { id, ...rest } = s;
    await db.doc(`subjects/${id}`).set(rest, { merge: true });
    console.log(`✓ Ämne: ${s.name}`);
    for (const area of areas[s.id] || []) {
      const { id: aid, ...arest } = area;
      await db.doc(`subjects/${s.id}/areas/${aid}`).set(arest, { merge: true });
      console.log(
        `  ✓ Arbetsområde: ${area.name} (${area.texts.length} texter, ` +
          `${area.quiz.length} frågor, ${area.pairs.length} par)`
      );
    }
  }

  for (const st of students) {
    const { id, password, coins, ...rest } = st;
    const how = await ensureAuth(id, st.username, password);
    // students-dokumentet: INGET password-fält (bor i Auth).
    await db.doc(`students/${id}`).set(
      { namn: rest.namn, username: String(st.username).trim().toLowerCase(), avatarId: rest.avatarId },
      { merge: true }
    );
    await db.doc(`studentData/${id}`).set(
      {
        coins: coins ?? 0,
        progress: {},
        ownedItems: [],
        avatarItems: [],
        room: { placements: {} },
        avatarId: rest.avatarId,
      },
      { merge: true }
    );
    console.log(`✓ Elev: ${st.namn} (login: ${st.username} — Auth-konto ${how})`);
  }

  console.log("\nKlart! Databasen är seedad. 🎉");
}

main().catch((e) => {
  console.error("Fel vid seedning:", e.message);
  process.exit(1);
});
