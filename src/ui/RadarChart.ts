import { AXIS_META } from '../catalog';
import { SkillAxis } from '../types';

const ORDER: SkillAxis[] = ['aim', 'rhythm', 'logic', 'reflex', 'agility'];

export function renderRadarSvg(
  ratings: Record<SkillAxis, number>,
  size = 260
): string {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.29;
  const rings = [0.25, 0.5, 0.75, 1.0];

  const pointAt = (idx: number, ratio: number): [number, number] => {
    const angle = -Math.PI / 2 + (idx * Math.PI * 2) / ORDER.length;
    return [cx + Math.cos(angle) * maxR * ratio, cy + Math.sin(angle) * maxR * ratio];
  };

  let ringPaths = '';
  for (const r of rings) {
    const pts = ORDER.map((_, i) => pointAt(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
    ringPaths += `<polygon points="${pts}" fill="none" stroke="#243044" stroke-width="1" />`;
  }

  let spokeLines = '';
  let labelNodes = '';
  const valuePts: string[] = [];
  let vertexDots = '';

  ORDER.forEach((axis, i) => {
    const [ex, ey] = pointAt(i, 1);
    spokeLines += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#243044" stroke-width="1" />`;

    const val = Math.max(80, Math.min(1000, ratings[axis] ?? 300));
    const ratio = val / 1000;
    const [vx, vy] = pointAt(i, ratio);
    valuePts.push(`${vx.toFixed(1)},${vy.toFixed(1)}`);

    const meta = AXIS_META[axis];
    vertexDots += `<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="4" fill="${meta.accent}" stroke="#0B0E14" stroke-width="1.5" />`;

    const [lx, ly] = pointAt(i, 1.22);
    const anchor = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end';
    labelNodes += `
      <text x="${lx.toFixed(1)}" y="${(ly - 5).toFixed(1)}" text-anchor="${anchor}" fill="#DCE5F2" font-family="Chakra Petch, sans-serif" font-size="11" font-weight="700">${meta.short}</text>
      <text x="${lx.toFixed(1)}" y="${(ly + 9).toFixed(1)}" text-anchor="${anchor}" fill="${meta.accent}" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">${val}</text>
    `;
  });

  return `
    <svg class="oa-radar-svg" viewBox="-26 -6 ${size + 52} ${size + 12}" width="${size + 32}" height="${size}" role="img" aria-label="Gráfico radar de 5 habilidades">
      ${ringPaths}
      ${spokeLines}
      <polygon points="${valuePts.join(' ')}" fill="rgba(0, 229, 255, 0.18)" stroke="#00E5FF" stroke-width="2" />
      ${vertexDots}
      ${labelNodes}
    </svg>
  `;
}
