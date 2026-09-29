// Orb placement patterns. Levels describe orb layouts with these shapes so
// routes are designed, not random.

const DEG = Math.PI / 180;

export function patternPoints(g) {
  const pts = [];
  const n = Math.max(1, g.n || 1);
  switch (g.p) {
    case 'line': {
      const a = (g.angle || 0) * DEG;
      const sp = g.spacing || 60;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * sp;
        pts.push([g.x + Math.cos(a) * o, g.y + Math.sin(a) * o]);
      }
      break;
    }
    case 'arc': {
      const a0 = (g.a0 ?? 0) * DEG;
      const a1 = (g.a1 ?? 180) * DEG;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? a0 : a0 + ((a1 - a0) * i) / (n - 1);
        pts.push([g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r]);
      }
      break;
    }
    case 'circle': {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push([g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r]);
      }
      break;
    }
    case 'zigzag': {
      const a = (g.angle || 0) * DEG;
      const sp = g.spacing || 60;
      const amp = g.amp || 40;
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * sp;
        const side = i % 2 === 0 ? -amp : amp;
        pts.push([g.x + Math.cos(a) * o + nx * side, g.y + Math.sin(a) * o + ny * side]);
      }
      break;
    }
    default:
      pts.push([g.x, g.y]);
  }
  return pts;
}
