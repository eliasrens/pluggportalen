// ============================================================================
// Meteorstormen – projektorns BESÄTTNING (#822, spec §4.1.1): små tecknade
// astronauter med klassens färg på dräkten. Känslor åt stationen utan att visa
// vem som gjort fel. Ritas i fönstren av msp-station.js.
//   astronaut(g, farg, pose, t, k, rorelse, drakt?)
//     pose: "lugn" (gungar lätt) | "jubel" (armarna upp – lasern sprängde en
//     meteor) | "ducka" (skrovträff) | "svett" (torkar svetten – skölden höll
//     mot jättemeteoren) | "vinka" (slutet, och i rymddräkt vid 0 i skrov)
//     rorelse = false (prefers-reduced-motion): stilla poser.
// ============================================================================

export const KONTUR = "#1f1b3a";
const TAU = Math.PI * 2;

export function astronaut(g, farg, pose, t, k, rorelse, drakt = false) {
  const bob = rorelse ? Math.sin(t / 650 + k * 1.7) * 1.6 : 0;
  const y = pose === "ducka" ? 10 : pose === "jubel" ? -4 : -1 + bob;
  g.fillStyle = drakt ? "#f2f4fa" : farg;
  g.strokeStyle = KONTUR;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, y + 14, 11, 8, 0, 0, TAU);
  g.fill();
  g.stroke();
  if (pose === "jubel" || pose === "vinka") {
    const vift = pose === "vinka" && rorelse ? Math.sin(t / 260 + k) * 0.5 : 0.2;
    g.strokeStyle = drakt ? "#f2f4fa" : farg;
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    if (pose === "jubel") { g.moveTo(-7, y + 10); g.lineTo(-11, y - 4); }
    g.moveTo(7, y + 10);
    g.lineTo(7 + Math.sin(0.5 + vift) * 9, y + 10 - Math.cos(0.5 + vift) * 13);
    g.stroke();
  }
  g.fillStyle = "#ffffff";
  g.strokeStyle = KONTUR;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, y, 8.5, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = "#1d2f6f";
  g.beginPath();
  g.ellipse(1, y + 0.5, 5.5, 4.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.7)";
  g.beginPath();
  g.arc(-1, y - 1.2, 1.4, 0, TAU);
  g.fill();
  if (pose === "svett") {
    g.strokeStyle = farg;
    g.lineWidth = 3.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-6, y + 9);
    g.lineTo(5, y - 6);
    g.stroke();
  }
}
