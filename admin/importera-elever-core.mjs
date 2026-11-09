// ============================================================================
// Kärnan i elevimporten (admin/importera-elever-core.mjs, #831)
// ----------------------------------------------------------------------------
// Skapar klasser och elevkonton ur en CSV (klass,namn,anvandarnamn,losenord)
// PRECIS som lärarsidans "Skapa klass" + "Lägg till elev": dokumentens form
// kommer ur src/klass-membership.js, samma modul som klienten använder. Det enda
// som skiljer är fältet importBatch på students/{uid} och classes/{id}, så att
// importen kan ångras exakt.
//
// Kärnan har inga egna Firebase-importer: deps = { auth, db, FieldValue }
// injiceras (samma mönster som functions/login-core.js), så testerna kan köra
// den direkt mot emulatorn – även med en felande db för att bevisa att inget
// halvt skapat konto blir kvar. CLI:t är admin/importera-elever.mjs.
//
// Flödet: lasCsv → planera (filens egna fel) → kontrollera (krockar mot
// Firestore/Auth, inget skrivs) → importera (skriver) | planeraAngra → angra.
// Lösenord finns bara i raderna och skrivs aldrig ut av något här.
// ============================================================================

import {
  USERNAME_RE,
  MIN_PASSWORD_LEN,
  normalizeUsername,
  defaultStudentData,
  newStudentDoc,
  studentCredentialsDoc,
  newClassDoc,
  nextClassOrder,
} from "../src/klass-membership.js";
import { slugify } from "../src/validate.js";
import { taBortElev } from "../functions/hitta-ratt-core.js";

export const KOLUMNER = ["klass", "namn", "anvandarnamn", "losenord"];
// MÅSTE matcha src/auth.js ELEV_EMAIL_DOMAIN och admin/_shared.mjs.
export const ELEV_EMAIL_DOMAIN = "elev.pluggportalen.local";
export const MAX_PASSWORD_LEN = 64; // samma tak som updateStudentLogin (functions/login-core.js)

export const elevEmail = (username) => `${normalizeUsername(username)}@${ELEV_EMAIL_DOMAIN}`;
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

/** Klassens dokument-id – samma som Skapa klass (slugify(namn), "3A" → "3a"). */
export const klassId = (namn) => slugify(namn);

// --- 1. Filen ------------------------------------------------------------------

/** Dela en CSV-rad på komma. Citattecken ("a,b" och "") stöds, allt läses som text. */
function delaRad(rad) {
  const falt = [];
  let cur = "";
  let iCitat = false;
  for (let i = 0; i < rad.length; i++) {
    const c = rad[i];
    if (iCitat) {
      if (c === '"' && rad[i + 1] === '"') cur += '"', i++;
      else if (c === '"') iCitat = false;
      else cur += c;
    } else if (c === '"') iCitat = true;
    else if (c === ",") falt.push(cur), (cur = "");
    else cur += c;
  }
  falt.push(cur);
  return falt;
}

/**
 * Läs CSV-texten. Alla fält är TEXT (inledande nollor behålls). Tomma rader hoppas över.
 * @returns {{ rader: Array<{rad:number, klass:string, namn:string, anvandarnamn:string, losenord:string}>, fel: string[] }}
 */
export function lasCsv(text) {
  const linjer = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const fel = [];
  const rubrik = delaRad(linjer[0] || "").map((s) => s.trim().toLowerCase());
  if (rubrik.length !== KOLUMNER.length || rubrik.some((k, i) => k !== KOLUMNER[i])) {
    fel.push(`Rubrikraden ska vara exakt "${KOLUMNER.join(",")}" (var "${(linjer[0] || "").trim()}").`);
    return { rader: [], fel };
  }
  const rader = [];
  for (let i = 1; i < linjer.length; i++) {
    if (!linjer[i].trim()) continue;
    const f = delaRad(linjer[i]).map((s) => s.trim());
    const rad = i + 1;
    if (f.length !== KOLUMNER.length) {
      fel.push(`Rad ${rad}: ${f.length} fält, ska vara ${KOLUMNER.length}.`);
      continue;
    }
    const [klass, namn, anvandarnamn, losenord] = f;
    const tomma = KOLUMNER.filter((_, j) => !f[j]);
    if (tomma.length) fel.push(`Rad ${rad}: tomt fält (${tomma.join(", ")}).`);
    rader.push({ rad, klass, namn, anvandarnamn, losenord });
  }
  if (!rader.length && !fel.length) fel.push("Filen har inga elevrader.");
  return { rader, fel };
}

/**
 * Kontrollera filen mot Pluggportens regler (utan databas) och räkna fram
 * visningsnamn. Två elever med samma namn i SAMMA klass får namn + siffrorna
 * i användarnamnet ("Kim 412"); samma namn i olika klasser behålls.
 * @returns {{ elever: Array, klasser: Array<{id, namn}>, fel: string[], omdopta: Array }}
 */
export function planera(rader) {
  const fel = [];
  const sedda = new Map();
  const klasser = new Map();
  const elever = [];
  for (const r of rader) {
    if (!r.klass || !r.namn || !r.anvandarnamn || !r.losenord) continue; // redan rapporterat
    const username = normalizeUsername(r.anvandarnamn);
    if (!USERNAME_RE.test(username)) {
      fel.push(`Rad ${r.rad}: användarnamnet "${r.anvandarnamn}" är ogiltigt (3–40 tecken, bara a–z, 0–9, . _ -).`);
    }
    if (sedda.has(username)) {
      fel.push(`Rad ${r.rad}: användarnamnet "${r.anvandarnamn}" finns redan på rad ${sedda.get(username)}.`);
    } else sedda.set(username, r.rad);
    if (r.losenord.length < MIN_PASSWORD_LEN || r.losenord.length > MAX_PASSWORD_LEN) {
      // Lösenordet självt skrivs aldrig ut – bara vems det är.
      fel.push(`Rad ${r.rad}: lösenordet för "${r.anvandarnamn}" måste vara ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} tecken.`);
    }
    const id = klassId(r.klass);
    if (!id) fel.push(`Rad ${r.rad}: klassnamnet "${r.klass}" går inte att använda.`);
    else if (klasser.has(id) && klasser.get(id).namn !== r.klass) {
      fel.push(`Rad ${r.rad}: klassen "${r.klass}" krockar med "${klasser.get(id).namn}" (samma klass-id "${id}").`);
    } else if (!klasser.has(id)) klasser.set(id, { id, namn: r.klass });
    elever.push({ ...r, username, klassId: id, visningsnamn: r.namn });
  }
  // Samma namn i samma klass → namn + siffror.
  const omdopta = [];
  const perNamn = new Map();
  for (const e of elever) {
    const k = `${e.klassId}\u0000${e.namn.toLocaleLowerCase("sv")}`;
    perNamn.set(k, [...(perNamn.get(k) || []), e]);
  }
  for (const grupp of perNamn.values()) {
    if (grupp.length < 2) continue;
    for (const e of grupp) {
      const siffror = e.anvandarnamn.replace(/\D/g, "");
      e.visningsnamn = `${e.namn} ${siffror || e.anvandarnamn}`;
      omdopta.push({ klass: e.klass, anvandarnamn: e.anvandarnamn, fran: e.namn, till: e.visningsnamn });
    }
  }
  return { elever, klasser: [...klasser.values()], fel, omdopta };
}

// --- 2. Kontroll mot databasen (skriver ingenting) -----------------------------

/**
 * Jämför planen med det som redan finns. Varje elev får status "skapas" eller
 * "fanns" (samma användarnamn, samma visningsnamn, redan i samma klass). Allt
 * annat med samma användarnamn är en KROCK och stoppar hela importen.
 * @returns {Promise<{ elever, klasser: Array<{id, namn, finns:boolean, order?:number}>, krockar: string[], befintligaKlasser: Array }>}
 */
export async function kontrollera({ auth, db }, plan) {
  const klassSnap = await db.collection("classes").get();
  const befintliga = klassSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const byId = new Map(befintliga.map((c) => [c.id, c]));
  const krockar = [];

  const klasser = plan.klasser.map((k) => {
    const c = byId.get(k.id) || befintliga.find((x) => x.name === k.namn) || null;
    if (c && c.name !== k.namn) {
      krockar.push(`Klassen "${k.namn}" har id "${k.id}", men den befintliga klassen där heter "${c.name}".`);
    }
    return { id: c ? c.id : k.id, namn: k.namn, finns: !!c, studentIds: c?.studentIds || [] };
  });
  const klassAv = new Map(klasser.map((k) => [k.namn, k]));

  // Befintliga elever med samma användarnamn (Firestore "in" tar högst 30 värden).
  const anv = plan.elever.map((e) => e.username);
  const befElever = new Map();
  for (let i = 0; i < anv.length; i += 30) {
    const snap = await db.collection("students").where("username", "in", anv.slice(i, i + 30)).get();
    snap.docs.forEach((d) => {
      const u = d.data().username;
      befElever.set(u, [...(befElever.get(u) || []), { id: d.id, ...d.data() }]);
    });
  }
  // Auth-konton med samma e-post (getUsers tar högst 100 åt gången).
  const authAv = new Map();
  for (let i = 0; i < anv.length; i += 100) {
    const res = await auth.getUsers(anv.slice(i, i + 100).map((u) => ({ email: elevEmail(u) })));
    res.users.forEach((u) => authAv.set(u.email, u.uid));
  }

  const elever = plan.elever.map((e) => {
    const klass = klassAv.get(e.klass);
    const fanns = befElever.get(e.username) || [];
    const authUid = authAv.get(elevEmail(e.username)) || null;
    if (!fanns.length && !authUid) return { ...e, klassId: klass.id, status: "skapas" };
    const samma =
      fanns.length === 1 &&
      fanns[0].namn === e.visningsnamn &&
      (klass.studentIds.includes(fanns[0].id) || (fanns[0].classIds || []).includes(klass.id)) &&
      (!authUid || authUid === fanns[0].id);
    if (samma) return { ...e, klassId: klass.id, status: "fanns", uid: fanns[0].id };
    const vem = fanns.length
      ? fanns.map((s) => `"${s.namn}" (${klassNamnFor(s, befintliga)})`).join(", ")
      : "ett inloggningskonto utan elevdokument (radera det med admin/delete-student.mjs)";
    krockar.push(`Användarnamnet "${e.anvandarnamn}" (${e.namn}, ${e.klass}) finns redan för ${vem}.`);
    return { ...e, klassId: klass.id, status: "krock" };
  });
  return { elever, klasser, krockar, befintligaKlasser: befintliga };
}

function klassNamnFor(student, klasser) {
  const namn = klasser.filter((c) => (c.studentIds || []).includes(student.id)).map((c) => c.name);
  return namn.length ? `klass ${namn.join(", ")}` : "ingen klass";
}

// --- 3. Sammanfattning -----------------------------------------------------------

/** Tabellen klass × skapas/fanns/fel (inga lösenord). `skapade`=true → rubriken "Skapad". */
export function sammanfattning(elever, { skapade = false, fel = [] } = {}) {
  const felAv = new Map();
  fel.forEach((f) => felAv.set(f.klass, (felAv.get(f.klass) || 0) + 1));
  const klasser = [...new Set(elever.map((e) => e.klass))];
  const rad = (a, b, c, d) => `${String(a).padEnd(7)}${String(b).padEnd(15)}${String(c).padEnd(13)}${d}`;
  const ut = [rad("Klass", skapade ? "Skapad" : "Skapas", "Fanns redan", "Fel")];
  const tot = [0, 0, 0];
  for (const k of klasser) {
    const i = elever.filter((e) => e.klass === k);
    const n = [
      i.filter((e) => (skapade ? e.status === "skapad" : e.status === "skapas")).length,
      i.filter((e) => e.status === "fanns").length,
      felAv.get(k) || 0,
    ];
    n.forEach((v, j) => (tot[j] += v));
    ut.push(rad(k, ...n));
  }
  ut.push(rad("Totalt", ...tot));
  return ut.join("\n");
}

// --- 4. Import (skriver) ---------------------------------------------------------

/**
 * Skapa klasserna som saknas och elevkontona med status "skapas". En elev i
 * taget med `paus` ms emellan. Auth först (uid:t blir dokumentens id), sedan
 * ALLA Firestore-dokument i en batch; misslyckas batchen raderas Auth-kontot
 * igen, så nästa körning kan skapa kontot från början.
 * @returns {Promise<{ elever, fel: Array<{klass, anvandarnamn, orsak}>, skapadeKlasser: Array }>}
 */
export async function importera(deps, kontroll, { batch, paus = 0, logg = () => {} }) {
  const { auth, db, FieldValue } = deps;
  if (kontroll.krockar.length) throw new Error("Importen har krockar – inget skrivs.");
  const skapadeKlasser = [];
  const ordning = [...kontroll.befintligaKlasser];
  for (const k of kontroll.klasser) {
    if (k.finns) continue;
    const order = nextClassOrder(ordning);
    const klassDoc = { ...newClassDoc({ name: k.namn, order }, FieldValue.serverTimestamp()), importBatch: batch };
    await db.collection("classes").doc(k.id).create(klassDoc);
    ordning.push({ id: k.id, order });
    skapadeKlasser.push({ id: k.id, namn: k.namn, order });
    logg(`Klass ${k.namn} skapad (id ${k.id}, order ${order}).`);
  }

  const fel = [];
  const elever = [];
  for (const e of kontroll.elever) {
    if (e.status !== "skapas") {
      elever.push(e);
      continue;
    }
    let uid = null;
    try {
      const user = await auth.createUser({ email: elevEmail(e.username), password: e.losenord });
      uid = user.uid;
      const b = db.batch();
      b.set(db.collection("students").doc(uid), {
        ...newStudentDoc({ namn: e.visningsnamn, username: e.username, avatarId: "fox" }),
        classIds: [e.klassId],
        importBatch: batch,
      });
      b.set(db.collection("studentData").doc(uid), defaultStudentData("fox"));
      b.set(
        db.collection("studentCredentials").doc(uid),
        studentCredentialsDoc({ username: e.username, password: e.losenord }, FieldValue.serverTimestamp())
      );
      b.update(db.collection("classes").doc(e.klassId), { studentIds: FieldValue.arrayUnion(uid) });
      await b.commit();
      elever.push({ ...e, status: "skapad", uid });
      logg(`  ✓ ${e.klass}  ${e.visningsnamn} (${e.anvandarnamn})`);
    } catch (err) {
      let orsak = felText(err);
      if (uid) {
        const borta = await auth.deleteUser(uid).then(() => true, () => false);
        if (!borta) orsak += " – OBS: inloggningskontot kunde inte tas bort igen, radera det med admin/delete-student.mjs";
      }
      fel.push({ klass: e.klass, anvandarnamn: e.anvandarnamn, orsak });
      elever.push({ ...e, status: "fel" });
      logg(`  ✗ ${e.klass}  ${e.anvandarnamn}: ${orsak}`);
    }
    if (paus) await vanta(paus);
  }
  return { elever, fel, skapadeKlasser };
}

/** Felmeddelande utan lösenord (Firebase-fel kan i teorin citera indata). */
function felText(err) {
  const kod = err?.code || err?.errorInfo?.code;
  const text = String(err?.message || err || "okänt fel").split("\n")[0];
  return kod ? `${kod}: ${text}` : text;
}

// --- 5. Ångra ------------------------------------------------------------------

/** Vad en ångring av `batch` tar bort (skriver ingenting). */
export async function planeraAngra({ db }, batch) {
  const [eSnap, kSnap] = await Promise.all([
    db.collection("students").where("importBatch", "==", batch).get(),
    db.collection("classes").where("importBatch", "==", batch).get(),
  ]);
  const elever = eSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const elevIds = new Set(elever.map((e) => e.id));
  const klasser = kSnap.docs.map((d) => {
    const ovriga = (d.data().studentIds || []).filter((id) => !elevIds.has(id));
    return { id: d.id, namn: d.data().name, ovriga: ovriga.length, tasBort: ovriga.length === 0 };
  });
  return { batch, elever, klasser };
}

/**
 * Ta bort exakt det importen skapade: elevernas Auth-konto, students,
 * studentData (med underkollektioner), studentCredentials, platsen i klassernas
 * elevlistor och klassprojektioner, Hitta rätt!-rader (som delete-student.mjs),
 * och klasserna som importen skapade om inga andra elever finns kvar i dem.
 */
export async function angra(deps, plan, { logg = () => {} } = {}) {
  const { auth, db, FieldValue } = deps;
  const fel = [];
  for (const e of plan.elever) {
    try {
      await auth.deleteUser(e.id).catch((err) => {
        if ((err?.code || err?.errorInfo?.code) !== "auth/user-not-found") throw err;
      });
      const klasser = await db.collection("classes").where("studentIds", "array-contains", e.id).get();
      for (const k of klasser.docs) {
        await k.ref.update({ studentIds: FieldValue.arrayRemove(e.id) });
      }
      for (const cid of new Set([...(e.classIds || []), ...klasser.docs.map((k) => k.id)])) {
        const p = db.collection("classProjections").doc(cid);
        if ((await p.get()).data()?.members?.[e.id]) {
          await p.update({ [`members.${e.id}`]: FieldValue.delete() });
        }
      }
      await taBortElev({ db, FieldValue }, e.id);
      await db.recursiveDelete(db.collection("studentData").doc(e.id));
      await db.collection("studentCredentials").doc(e.id).delete();
      await db.collection("students").doc(e.id).delete();
      logg(`  ✓ borttagen: ${e.namn} (${e.username})`);
    } catch (err) {
      fel.push({ anvandarnamn: e.username, orsak: felText(err) });
      logg(`  ✗ ${e.username}: ${felText(err)}`);
    }
  }
  const borttagnaKlasser = [];
  for (const k of plan.klasser) {
    const ref = db.collection("classes").doc(k.id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    if ((snap.data().studentIds || []).length) {
      logg(`  – klass ${k.namn} behålls (har fortfarande ${snap.data().studentIds.length} elever)`);
      continue;
    }
    await ref.delete();
    borttagnaKlasser.push(k.namn);
    logg(`  ✓ klass ${k.namn} borttagen`);
  }
  return { fel, borttagnaKlasser };
}
