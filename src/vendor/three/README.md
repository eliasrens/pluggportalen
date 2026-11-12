# three.js (r170) – vendorad kopia

Kurragömma (#835/#837) ritar sin 3D-scen med **three.js r170** (`three@0.170.0`,
MIT – se `LICENSE`). Bara `build/three.module.min.js` ur npm-tarballen ligger
här, inga tilläggsmoduler (ingen OrbitControls – kameran och styrningen är egna).

- Inget CDN vid körning (skolnätverk blockerar). Inte i `package.json`.
- Laddas **bara** med `import()` från `src/live/formats/kurragomma/scen/kg-tre.js`.
  Bootgrafstestet (`test/live-formats.test.js`) bevisar att mappen inte nås statiskt.
- Uppgradera: `npm pack three@0.<ver>`, kopiera `build/three.module.min.js` +
  `LICENSE`, och uppdatera versionen här och i `docs/KURRAGOMMA.md`.
