// Slut-QA #825: EN hel Meteorstorm-match i riktig Chromium mot emulatorerna
// (functions+auth+firestore, admin/qa-meteorstorm-e2e-preview.sh).
// Läraren skapar matchen i UI:t, två projektorer (B med nätfördröjning), riktiga
// elevsidor (elevbot.js) + botelever (botar.mjs, riktiga callables), STARTA,
// mätning under matchen, slutrutor, resultat, pluggmynt, status-skrivningar.
//   node scen.mjs --env <env> --ut <dir> --lage klass-mot-klass --attacker vilda --min 5
//     --klasser 4b,5e --riktiga b01,b02,e01,e02 --botar b03-b08,e03-e08 --latensB 0 --svar free|choice
//     [--fela-avsluta]  första msAvsluta från projektor A och första eleven felas (CDP Fetch) – felvägen
//     [--stang 150]     projektorerna stängs efter 150 s (elevskärmarna ska fortsätta, eleverna avslutar)
// Kör från repo-roten efter `ENKEL_ARBETARE=1 JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-meteorstorm-e2e-preview.sh`.
// Botarna (botar.mjs) svarar bara "skriv själv" (multiplikation). Under tiden: `node admin/qa-meteorstorm-825/do.mjs
// <sida> '<js>'` kör JS i en sida (larare, projB, elev-b01 …); sak.mjs = säkerhetsprov; fela.mjs = fela elevens msAvsluta.
import { startChrome, connect, sleep } from "./cdp.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
const HERE = new URL(".", import.meta.url).pathname; // rigg + sidor.json/dbgport här
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const envFil = opt("--env");
const env = Object.fromEntries(readFileSync(envFil, "utf8").trim().split("\n").map((r) => r.split("=")));
const UT = opt("--ut"); mkdirSync(UT, { recursive: true });
const LAGE = opt("--lage", "klass-mot-klass"), ATT = opt("--attacker", "milda"), MIN = opt("--min", "5");
const KLASSER = opt("--klasser", "4b,5e").split(",");
const RIKTIGA = opt("--riktiga", "b01,e01").split(",").filter(Boolean);
const BOTAR = opt("--botar", "").split(",").filter(Boolean);
const LATENS_B = Number(opt("--latensB", "0"));
const MODE = opt("--mode", "multiplication_0_10"), SVAR = opt("--svar", "free");
const P = opt("--p", "0.7,0.6").split(",").map(Number);
const BAS = `http://127.0.0.1:${env.PROXY}`;
const FSB = `http://127.0.0.1:${env.FS}/v1/projects/pluggportalen-so-2026/databases/(default)/documents`;
const logg = [];
const L = (...a) => { const s = `${new Date().toISOString().slice(11, 19)} ${a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")}`; console.log(s); logg.push(s); };
const fsGet = async (p) => (await fetch(`${FSB}/${p}`, { headers: { authorization: "Bearer owner" } })).json();
const fsList = async (p) => { let out = [], tok = ""; do { const j = await (await fetch(`${FSB}/${p}?pageSize=300${tok ? `&pageToken=${tok}` : ""}`, { headers: { authorization: "Bearer owner" } })).json(); out = out.concat(j.documents || []); tok = j.nextPageToken || ""; } while (tok); return out; };
const plain = (v) => v == null ? v : "stringValue" in v ? v.stringValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue : "booleanValue" in v ? v.booleanValue
  : "timestampValue" in v ? v.timestampValue : "nullValue" in v ? null : "arrayValue" in v ? (v.arrayValue.values || []).map(plain) : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)])) : v;
const doc = (d) => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, plain(v)]));
const range = (s) => { const m = s.match(/^([a-z])(\d+)-[a-z](\d+)$/); if (!m) return [s]; const out = []; for (let i = +m[2]; i <= +m[3]; i++) out.push(m[1] + String(i).padStart(2, "0")); return out; };
const klassAv = (u) => ({ b: "4b", e: "5e", a: "4a", c: "3a" })[u[0]];

const DBG = 30000 + Math.floor(Math.random() * 20000);
const ch = await startChrome({ port: DBG, dir: `/tmp/qa825-${DBG}` });
writeFileSync(`${HERE}/dbgport`, String(DBG)); writeFileSync(`${HERE}/sidor.json`, "{}");
const b = await connect(DBG);
const karta = {};
const LJUD = readFileSync(`${HERE}/ljudhook.js`, "utf8");
const sida = async (namn, url, o = {}) => { const p = await b.newPage("about:blank", o); if (o.ljud) await p.send("Page.addScriptToEvaluateOnNewDocument", { source: LJUD }); karta[namn] = p.targetId; writeFileSync(`${HERE}/sidor.json`, JSON.stringify(karta)); if (url) await p.goto(url); return p; };
async function larareLogin(p) {
  await p.goto(`${BAS}/#/larare`);
  await p.waitFor(`!!document.querySelector("#username")`, 30000);
  await p.eval(`document.querySelector("#username").value="elias"; document.querySelector("#p").value="lilla123"; document.querySelector("#form").requestSubmit(); 1`);
  await p.waitFor(`!document.querySelector("#username")`, 30000);
}
async function elevLogin(p, uid) {
  await p.goto(`${BAS}/#/`);
  await p.waitFor(`!!document.querySelector("#u")`, 40000);
  await p.eval(`document.querySelector("#u").value=${JSON.stringify(uid)}; document.querySelector("#p").value="lilla123"; document.querySelector("#form").requestSubmit(); 1`);
  await p.waitFor(`!document.querySelector("#u")`, 40000);
}
// Felväg (#825 F1): första msAvsluta från sidan misslyckas (nätfel) – sidan ska försöka igen.
async function felaForstaAvsluta(p, namn) {
  const st = { namn, avsluta: 0, felade: 0 };
  await p.send("Fetch.enable", { patterns: [{ urlPattern: "*msAvsluta*", requestStage: "Request" }] });
  p.on(async (d) => {
    if (d.method !== "Fetch.requestPaused") return;
    if (d.params.request.method === "OPTIONS") return p.send("Fetch.continueRequest", { requestId: d.params.requestId });
    st.avsluta++;
    if (st.avsluta === 1) { st.felade++; await p.send("Fetch.failRequest", { requestId: d.params.requestId, errorReason: "ConnectionFailed" }); }
    else await p.send("Fetch.continueRequest", { requestId: d.params.requestId });
  });
  return st;
}
const FELA = args.includes("--fela-avsluta");
const STANG = Number(opt("--stang", "0"));
let stangd = false;
const resultat = { scenario: { LAGE, ATT, MIN, KLASSER, RIKTIGA: RIKTIGA.length, BOTAR: BOTAR.flatMap(range).length, LATENS_B, MODE, SVAR } };
let sid;
try {
  // --- Läraren skapar matchen i UI:t ---------------------------------------
  const T = await sida("larare", null, { ljud: true });
  await larareLogin(T);
  await T.goto(`${BAS}/#/larare/live`);
  await T.waitFor(`!!document.querySelector('input[name="format"][value="meteorstorm"]')`, 30000);
  await T.eval(`(()=>{const r=document.querySelector('input[name="format"][value="meteorstorm"]'); r.checked=true; r.dispatchEvent(new Event("change",{bubbles:true})); return 1})()`);
  await sleep(1500);
  const sat = await T.eval(`(async()=>{const S=(n,v)=>{const r=document.querySelector('input[name="'+n+'"][value="'+v+'"]'); if(!r) return n+"="+v+" saknas"; r.checked=true; r.dispatchEvent(new Event("change",{bubbles:true})); return "ok";};
    const out=[S("mode",${JSON.stringify(MODE)})]; await new Promise(r=>setTimeout(r,500));
    out.push(S("answerKind",${JSON.stringify(SVAR)}), S("sf-lage",${JSON.stringify(LAGE)}), S("sf-attacker",${JSON.stringify(ATT)}), S("sf-durationMin",${JSON.stringify(MIN)}));
    for (const k of ${JSON.stringify(KLASSER)}) { const c=document.querySelector('input[name="klass"][value="'+k+'"]'); c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true})); }
    await new Promise(r=>setTimeout(r,500));
    const tid = [...document.querySelectorAll('input[name="sf-durationMin"]')].map(x=>x.value);
    return {out, tid, fel: document.querySelector(".live-form-msg")?.textContent};})()`);
  L("formulär", sat);
  await T.shot(`${UT}/larare-formular.jpg`);
  await T.eval(`document.querySelector("form.live-form").requestSubmit(); 1`);
  await T.waitFor(`document.querySelector(".live-form-msg")?.textContent || /[?&]id=/.test(location.hash)`, 30000);
  const msg = await T.eval(`document.querySelector(".live-form-msg")?.textContent || ""`);
  if (msg) L("formulärsvar", msg);
  sid = await T.waitFor(`(location.hash.match(/[?&]id=([^&]+)/) || [])[1]`, 30000);
  L("sid", sid);
  resultat.sid = sid;
  const sess0 = doc(await fsGet(`liveSessions/${sid}`));
  L("session", { format: sess0.format, ms: sess0.msInstallningar, dur: sess0.durationSeconds, mode: sess0.gameMode, ak: sess0.answerKind, klasser: sess0.participatingClassIds });

  // --- Projektorerna ----------------------------------------------------------
  const PB = await sida("projB", null, { ljud: true });
  await larareLogin(PB);
  await PB.goto(`${BAS}/#/larare/live?id=${sid}`);
  await T.waitFor(`!!document.querySelector("[data-start]")`, 40000);
  // --- Eleverna -------------------------------------------------------------------
  const elever = [];
  for (const [i, u] of RIKTIGA.entries()) {
    const mobil = i === 0;
    const p = await sida(`elev-${u}`, null, mobil ? { w: 375, h: 812, mobile: true } : { w: 1280, h: 800 });
    await elevLogin(p, u);
    await p.goto(`${BAS}/#/elev/live?id=${sid}`);
    const pk = P[KLASSER.indexOf(klassAv(u))] ?? 0.7;
    await p.eval(`window.__qaOpt=${JSON.stringify({ p: pk, takt: 7000, drag: 0.2 })}; 1`);
    await p.eval(readFileSync(`${HERE}/elevbot.js`, "utf8"));
    elever.push({ u, p, mobil });
  }
  await sleep(4000);
  await elever[0].p.shot(`${UT}/elev-lobby.jpg`);
  // Botarna går med (lobbyn) och spelar när matchen startat.
  const botProc = [];
  for (const k of KLASSER) {
    const uids = BOTAR.flatMap(range).filter((u) => klassAv(u) === k);
    if (!uids.length) continue;
    const pk = P[KLASSER.indexOf(k)] ?? 0.7;
    const pr = spawn("node", [`${HERE}/botar.mjs`, envFil, sid, uids.join(","), "--klass", k, "--ratt", String(pk), "--takt", "8", "--drag", "0.15", "--logg", `${UT}/botar-${k}.log`], { env: { ...process.env, REPO: process.cwd() } });
    let out = ""; pr.stdout.on("data", (d) => (out += d)); pr.stderr.on("data", (d) => (out += d));
    botProc.push(new Promise((r) => pr.on("exit", () => r(out))));
  }
  const vantat = RIKTIGA.length + BOTAR.flatMap(range).length;
  let spelare = [];
  for (let k = 0; k < 40; k++) { await sleep(2000); spelare = await fsList(`liveSessions/${sid}/players`); if (spelare.length >= vantat) break; }
  L("i lobbyn", spelare.length);
  await T.shot(`${UT}/projektor-lobby.jpg`);
  // Projektor B: nätfördröjning från och med nu (sidan har laddat).
  if (LATENS_B) await PB.send("Network.enable").then(() => PB.send("Network.emulateNetworkConditions", { offline: false, latency: LATENS_B, downloadThroughput: -1, uploadThroughput: -1 }));
  // Musiken i lobbyn: ska vara tyst.
  resultat.ljudLobby = await T.eval("JSON.stringify(window.__ljud||null)");
  resultat.musikLobby = await T.eval(`JSON.stringify([...document.querySelectorAll("button")].filter(b=>/Musik|🎵/.test(b.textContent)).map(b=>b.textContent.trim()))`);
  await T.eval(`document.querySelector("[data-start]").click(); 1`);
  const startTid = Date.now();
  resultat.felvag = FELA ? [await felaForstaAvsluta(T, "projektor A"), await felaForstaAvsluta(elever[0].p, elever[0].u)] : null;
  L("STARTA");
  // --- Under matchen ------------------------------------------------------------
  const sess = doc(await fsGet(`liveSessions/${sid}`));
  const slutMs = sess.durationSeconds * 1000 + (sess.countdownSeconds || 3) * 1000 + 3000;
  const prov = [];
  let i = 0;
  const statusSkriv = [];
  let senaStatus = null;
  while (Date.now() - startTid < slutMs + 8000) {
    await sleep(5000); i++;
    if (STANG && !stangd && Date.now() - startTid > STANG * 1000) { stangd = true; await T.goto("about:blank"); await PB.goto("about:blank"); L("projektorerna STÄNGDA"); }
    const st = await fsGet(`liveSessions/${sid}/msPublic/status`);
    if (st.updateTime && st.updateTime !== senaStatus) { statusSkriv.push(st.updateTime); senaStatus = st.updateTime; }
    const a = await T.eval(`(()=>{const p=window.__mspProjektor; if(!p) return null; return {t:p.t(), stat:p.stat()};})()`).catch((e) => ({ err: e.message }));
    const bb = await PB.eval(`(()=>{const p=window.__mspProjektor; if(!p) return null; return {t:p.t(), stat:p.stat()};})()`).catch((e) => ({ err: e.message }));
    let jamfor = null;
    if (a?.t && bb?.t && i % 3 === 0) {
      const tt = Math.min(a.t, bb.t) - 500;
      const [x, y] = await Promise.all([T.eval(`JSON.stringify(window.__mspProjektor.avtryckVid(${tt}))`), PB.eval(`JSON.stringify(window.__mspProjektor.avtryckVid(${tt}))`)]);
      const X = JSON.parse(x), Y = JSON.parse(y);
      jamfor = { tt, lika: X.hash === Y.hash, tillstandLika: X.tillstand === Y.tillstand, hA: X.handlingar, hB: Y.handlingar };
    }
    const qa = await Promise.all(elever.map((e) => e.p.eval(`JSON.stringify({r:__qa.ratt,f:__qa.fel,val:__qa.val,felrader:__qa.felrader.slice(-3),vantaMax:__qa.vantaMax})`).then(JSON.parse).catch((e) => ({ err: e.message }))));
    prov.push({ s: Math.round((Date.now() - startTid) / 1000), A: a && { t: a.t, h: a.stat?.handlingar, bakat: a.stat?.bakat, sena: a.stat?.sena }, B: bb && { t: bb.t, h: bb.stat?.handlingar, bakat: bb.stat?.bakat, sena: bb.stat?.sena }, jamfor });
    if (i % 6 === 0) L("prov", prov.at(-1), "elever", qa.map((q) => `${q.r}/${q.f}`).join(" "));
    if (i === 4) { await T.send("Runtime.evaluate", { expression: "window.__mspProjektor?.nollstall()" }); }
    if (i === 16) {
      resultat.fpsA = await T.eval(`window.__mspProjektor?.fps()`).catch(() => null);
      resultat.fpsB = await PB.eval(`window.__mspProjektor?.fps()`).catch(() => null);
      L("fps", resultat.fpsA, resultat.fpsB);
      await T.shot(`${UT}/projektor-storm.jpg`); await PB.shot(`${UT}/projektorB-storm.jpg`);
      for (const e of elever) await e.p.shot(`${UT}/elev-${e.u}-storm.jpg`);
      resultat.sidoLiveUnderMatch = await Promise.all(elever.map((e) => e.p.eval(`JSON.stringify([...document.querySelectorAll(".sido-live")].map(x=>({t:x.textContent.trim().slice(0,40), syns: x.offsetParent!==null})))`)));
      resultat.musikUnderMatch = await T.eval(`JSON.stringify([...document.querySelectorAll("button")].filter(b=>/Musik|🎵/.test(b.textContent)).map(b=>b.textContent.trim()))`).catch(() => null);
    }
    if (i === 20 || i === 22) { const v = await T.eval(`(()=>{const b=document.querySelector("[data-music]"); b.click(); return b.textContent})()`).catch((e) => e.message); L("musikknapp", v, "ljud", await T.eval("JSON.stringify((window.__ljud||[]).slice(-4))")); }
    if (i === 30) { await T.shot(`${UT}/projektor-mitt.jpg`); await elever[0].p.shot(`${UT}/elev-mobil-mitt.jpg`); }
  }
  L("matchen slut");
  resultat.prov = prov;
  resultat.statusSkrivningar = statusSkriv;
  await sleep(12000);
  await T.shot(`${UT}/projektor-slut.jpg`); await PB.shot(`${UT}/projektorB-slut.jpg`);
  for (const e of elever) await e.p.shot(`${UT}/elev-${e.u}-slut.jpg`);
  resultat.slutA = await T.eval(`document.querySelector(".msp-slut, [class*=slut]")?.innerText?.slice(0,600) || document.body.innerText.slice(0,600)`);
  resultat.slutB = await PB.eval(`document.querySelector(".msp-slut, [class*=slut]")?.innerText?.slice(0,600) || document.body.innerText.slice(0,600)`);
  resultat.elevSlut = [];
  for (const e of elever) {
    resultat.elevSlut.push({ u: e.u, text: await e.p.eval(`document.querySelector(".live-elev-end")?.innerText?.slice(0,500)`),
      qa: JSON.parse(await e.p.eval(`JSON.stringify({...__qa, banderoller:[...__qa.banderoller], kvitton: __qa.kvitton.slice(-8)})`)),
      sidoLive: await e.p.eval(`JSON.stringify([...document.querySelectorAll("a,button")].filter(x=>/Live pågår/.test(x.textContent)).map(x=>({t:x.textContent.trim(), syns: x.offsetParent!==null})))`),
      konsol: e.p.konsol.slice(-10) });
  }
  resultat.ljudA = await T.eval("JSON.stringify(window.__ljud||null)");
  resultat.synlighet = { A: await T.eval("document.visibilityState"), B: await PB.eval("document.visibilityState") };
  resultat.konsolA = T.konsol.slice(-15); resultat.konsolB = PB.konsol.slice(-15);
  resultat.botar = await Promise.all(botProc);
  const sl = doc(await fsGet(`liveSessions/${sid}`));
  resultat.session = { status: sl.status, result: sl.result, msStationer: sl.msStationer, rewardsPaid: sl.rewardsPaid, rewards: sl.rewards };
  resultat.status = doc(await fsGet(`liveSessions/${sid}/msPublic/status`));
  resultat.antal = {};
  for (const c of ["msEvents", "msPlayers", "players", "msPublic", "msPrivate", "msLas"]) resultat.antal[c] = (await fsList(`liveSessions/${sid}/${c}`)).length;
  resultat.mynt = {};
  for (const u of [...RIKTIGA, ...BOTAR.flatMap(range)].slice(0, 60)) resultat.mynt[u] = doc(await fsGet(`studentData/${u}`)).coins;
} catch (e) {
  L("FEL", e.stack || e.message);
  resultat.fel = e.message;
} finally {
  writeFileSync(`${UT}/resultat.json`, JSON.stringify(resultat, null, 1));
  writeFileSync(`${UT}/logg.txt`, logg.join("\n"));
  if (!args.includes("--behall")) { try { process.kill(-ch.pid); } catch {} }
  process.exit(0);
}
