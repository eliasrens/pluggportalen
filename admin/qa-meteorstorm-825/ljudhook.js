(() => {
  const L = window.__ljud = [];
  const t0 = Date.now();
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { L.push({ s: (Date.now() - t0) / 1000, typ: "start", loop: this.loop, dur: this.buffer && +this.buffer.duration.toFixed(3) }); return st.apply(this, a); };
  const sp = AudioScheduledSourceNode.prototype.stop;
  AudioScheduledSourceNode.prototype.stop = function (...a) { if (this.loop) L.push({ s: (Date.now() - t0) / 1000, typ: "stop-loop" }); return sp.apply(this, a); };
  const r = AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime = function (v, t) { if (L.length < 3000) L.push({ s: (Date.now() - t0) / 1000, typ: "ramp", v: +v.toFixed(3) }); return r.call(this, v, t); };
})();
