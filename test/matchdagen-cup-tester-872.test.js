// ============================================================================
// Matchdagen 2c (#872) – Testerns egna motorprov: rekorden och cupen mot ett
// OBEROENDE orakel. Många slumpade karriärer (liga + cup + kval, flera säsonger)
// spelas med motorn; rekorden räknas sedan om ur den spelade historiken och
// jämförs med K.rekord. Dessutom: cupen flyttar aldrig laget, pokalen och
// prispengarna kommer exakt en gång, lottningen är stabil.
// Ren node: node --test test/matchdagen-cup-tester-872.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/matchdagen/delat/md-config.js";
import { cupKlar, cupLage, cupLottning, cupMatch, cupSchema } from "../src/matchdagen/delat/md-cup.js";
import { kvalKlar, kvalMatch } from "../src/matchdagen/delat/md-kval.js";
import { matchKlar, nastaMatch, nyKarriar, nySasong, pengarFor } from "../src/matchdagen/delat/md-sasong.js";
import { lasRekord, REKORD_MONSTER } from "../src/matchdagen/delat/md-rekord.js";
import { konsPengar } from "../src/matchdagen/md-spara.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const NU = Date.UTC(2026, 10, 20, 10);
const UID = "tester872";
const RE = new RegExp(`^${REKORD_MONSTER}$`);

function slumpRes(r, typ) {
  const oss = Math.floor(r() * (r() < 0.1 ? 9 : 4));
  const dem = Math.floor(r() * 4);
  const fragor = 10 + Math.floor(r() * 30);
  const ratt = Math.floor(r() * (fragor + 1));
  const mal = [];
  for (let i = 0; i < oss; i++) mal.push({ min: 1 + Math.floor(r() * 90), lag: "oss" });
  for (let i = 0; i < dem; i++) mal.push({ min: 1 + Math.floor(r() * 90), lag: "dem" });
  mal.sort((a, b) => a.min - b.min);
  const res = { oss, dem, mal, stat: { fragor, ratt, perKalla: {}, sekunder: 400 } };
  if ((typ === "cup" || typ === "kval") && oss === dem) {
    const vann = r() < 0.5;
    res.vann = vann;
    res.straffar = vann ? [4, 3] : [3, 4];
  }
  return res;
}

/** Spelar en hel karriär och loggar varje match { typ, sasong, res, plac?, forlustLiga? }. */
function karriar(fro, sasonger) {
  const r = skapaPrng(fro).tal;
  let K = nyKarriar({ namn: "Orakel IF", farg: "#2f6fe8", rng: r });
  const logg = [];
  const nyaRekord = [];
  for (let s = 0; s < sasonger; s++) {
    const cupOmg = [];
    for (let i = 0; i < 60; i++) {
      const id = `${fro}-${s}-${i}`;
      const divFore = K.div;
      if (cupMatch(K, UID)) {
        cupOmg.push(K.liga.omg);
        const res = slumpRes(r, "cup");
        const kassa = K.kassa;
        const u = cupKlar(K, { res, nu: NU, matchId: id, uid: UID, rng: r });
        assert.ok(u.K.div === divFore, "cupen flyttar aldrig laget");
        const vann = typeof res.vann === "boolean" ? res.vann : res.oss > res.dem;
        const pris = u.vannCupen ? Math.round(C.CUP.seger * (1 + divFore * C.KASSA.perDiv)) : 0;
        assert.equal(u.K.kassa - kassa, pengarFor(res, res.stat.ratt, divFore) + pris, "kassan: matchpengar + pris en gång");
        assert.equal(konsPengar([{ match: u.match }]), u.K.kassa - kassa, "kön räknar samma pengar som motorn");
        assert.equal(u.vann, vann);
        nyaRekord.push(...u.rekord);
        logg.push({ typ: "cup", sasong: K.sasong, res });
        K = u.K;
      } else if (nastaMatch(K)) {
        const res = slumpRes(r, "liga");
        const u = matchKlar(K, { res, rng: r, nu: NU, matchId: id });
        nyaRekord.push(...u.rekord);
        logg.push({ typ: "liga", sasong: K.sasong, res });
        K = u.K;
        assert.equal(K.div, divFore);
        if (u.sasongKlar) logg.push({ typ: "slut", sasong: K.sasong, plac: u.plac, forlust: K.liga.tabell.oss.f });
      } else if (kvalMatch(K)) {
        const res = slumpRes(r, "kval");
        const u = kvalKlar(K, { res, nu: NU, matchId: id, rng: r });
        assert.ok(u.K.div >= divFore, "kvalet flyttar aldrig ner");
        nyaRekord.push(...u.rekord);
        logg.push({ typ: "kval", sasong: K.sasong, res });
        K = u.K;
      } else break;
      assert.match(K.rekord, RE);
    }
    assert.deepEqual(cupOmg.slice(0, cupOmg.length), cupSchema(K.liga.schema.length).slice(0, cupOmg.length), "cupmatcherna kommer efter schemats omgångar");
    const L = cupLage(K);
    assert.ok(L.ute || L.vann, `säsong ${K.sasong}: cupen avgjord före ligans slut (${K.cup})`);
    assert.equal((K.pokaler || []).filter((p) => p.typ === "cup" && p.sasong === K.sasong).length, L.vann ? 1 : 0);
    K = nySasong(K, r);
  }
  return { K, logg, nyaRekord };
}

/** Rekorden ur historiken – oberoende av md-rekord.js. */
function orakel(logg) {
  const O = { mm: 0, ms: 0, ss: null, sv: 0, lt: 0, os: 0, ar: null, sm: null };
  let svit = 0;
  let lt = 0;
  const per = {};
  for (const x of logg) {
    if (x.typ === "slut") {
      const p = per[x.sasong] || { mal: 0, fragor: 0, ratt: 0, matcher: 0 };
      O.ms = Math.max(O.ms, p.mal);
      if (p.matcher >= 3 && p.fragor > 0) O.ar = Math.max(O.ar ?? 0, Math.round((100 * p.ratt) / p.fragor));
      lt = x.plac === 1 ? lt + 1 : 0;
      O.lt = Math.max(O.lt, lt);
      if (x.forlust === 0) O.os++;
      continue;
    }
    const { oss, dem, mal, stat } = x.res;
    O.mm = Math.max(O.mm, oss);
    if (oss > dem && (!O.ss || oss - dem > O.ss[0] - O.ss[1])) O.ss = [oss, dem];
    for (const m of mal) if (m.lag === "oss") O.sm = Math.min(O.sm ?? 999, m.min);
    svit = oss < dem ? 0 : svit + 1;
    O.sv = Math.max(O.sv, svit);
    if (x.typ !== "kval") {
      const p = (per[x.sasong] ??= { mal: 0, fragor: 0, ratt: 0, matcher: 0 });
      p.mal += oss; p.fragor += stat.fragor; p.ratt += stat.ratt; p.matcher++;
    }
  }
  return O;
}

describe("#872 Tester: rekorden mot ett oberoende orakel (§9.2)", () => {
  for (let k = 0; k < 40; k++) {
    it(`karriär ${k}: alla åtta rekord stämmer med historiken`, () => {
      const { K, logg } = karriar(`orakel-${k}`, 4 + (k % 4));
      const R = lasRekord(K.rekord, K.sasong);
      const O = orakel(logg);
      assert.equal(R.mm?.v ?? 0, O.mm, "flest mål i en match");
      assert.equal(R.ms?.v ?? 0, O.ms, "flest mål på en säsong");
      assert.deepEqual(R.ss ? [R.ss.oss, R.ss.dem] : null, O.ss, "största seger");
      assert.equal(R.sv?.v ?? 0, O.sv, "längsta svit utan förlust");
      assert.equal(R.lt?.v ?? 0, O.lt, "flest ligatitlar i rad");
      assert.equal(R.os?.v ?? 0, O.os, "obesegrade säsonger");
      assert.equal(R.ar?.v ?? null, O.ar, "bästa andel rätt");
      assert.equal(R.sm?.v ?? null, O.sm, "snabbaste mål");
    });
  }
});

describe("#872 Tester: cupen", () => {
  it("cupschemat för 5/7/9/11: fyra olika omgångar, alla före sista ligaomgången", () => {
    for (const n of [5, 7, 9, 11]) {
      const s = cupSchema(n);
      assert.equal(new Set(s).size, 4, `${n}: ${s}`);
      assert.ok(s[3] < n);
    }
  });
  it("en cupmatch som väntar kommer före nästa ligamatch, och ingen cupmatch efter ligans slut", () => {
    let K = nyKarriar({ namn: "Q IF", farg: "#2f6fe8", rng: skapaPrng("q").tal });
    const r = skapaPrng("q2").tal;
    while (nastaMatch(K)) {
      const c = cupMatch(K, UID);
      if (c) {
        assert.equal(c.mot.namn, cupLottning(K, UID)[c.runda].namn);
        K = cupKlar(K, { res: { oss: 1, dem: 0, mal: [], stat: { fragor: 5, ratt: 5, sekunder: 300 } }, nu: NU, matchId: "c", uid: UID }).K;
      } else K = matchKlar(K, { res: { oss: 0, dem: 1, mal: [], stat: { fragor: 5, ratt: 1, sekunder: 300 } }, rng: r, nu: NU, matchId: "m" }).K;
    }
    assert.equal(cupMatch(K, UID), null);
    assert.deepEqual(cupLage(K), { spelade: 4, ute: false, vann: true });
    assert.throws(() => cupKlar(K, { res: { oss: 1, dem: 0, mal: [], stat: { fragor: 1, ratt: 1, sekunder: 1 } }, nu: NU, matchId: "x", uid: UID }), /ingen cupmatch/);
    assert.equal(K.pokaler.filter((p) => p.typ === "cup").length, 1, "pokalen en gång");
  });
  it("utslagen: ingen fler cupmatch den säsongen, ny säsong ger ny cup", () => {
    let K = nyKarriar({ namn: "U IF", farg: "#2f6fe8", rng: skapaPrng("u").tal });
    const r = skapaPrng("u2").tal;
    while (!cupMatch(K, UID)) K = matchKlar(K, { res: { oss: 1, dem: 0, mal: [], stat: { fragor: 5, ratt: 5, sekunder: 300 } }, rng: r, nu: NU, matchId: "m" }).K;
    K = cupKlar(K, { res: { oss: 2, dem: 2, vann: false, straffar: [2, 4], mal: [], stat: { fragor: 5, ratt: 5, sekunder: 300 } }, nu: NU, matchId: "c", uid: UID }).K;
    assert.equal(K.cup, `${K.sasong}-1-u`);
    let n = 0;
    while (nastaMatch(K)) { assert.equal(cupMatch(K, UID), null); K = matchKlar(K, { res: { oss: 1, dem: 0, mal: [], stat: { fragor: 5, ratt: 5, sekunder: 300 } }, rng: r, nu: NU, matchId: "m" }).K; n++; }
    assert.ok(n > 0);
    if (kvalMatch(K)) K = kvalKlar(K, { res: { oss: 0, dem: 1, mal: [], stat: { fragor: 5, ratt: 5, sekunder: 300 } }, nu: NU, matchId: "k" }).K;
    K = nySasong(K, r);
    assert.deepEqual(cupLage(K), { spelade: 0, ute: false, vann: false });
  });
});
