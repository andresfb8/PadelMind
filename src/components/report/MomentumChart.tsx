import { signed } from '../../domain/format';
import type { MarkKind, Momentum } from '../../domain/analytics/momentum';

const W = 520;
const H = 190;
const PAD_X = 10;
const PAD_TOP = 22;
const PAD_BOTTOM = 12;

// Colores de la paleta de gráficos, en su versión para fondo oscuro. Todo el gráfico va sobre
// la tarjeta `bg-slate-900` (SURFACE); el azul y el naranja se validaron sobre ese fondo.
const COLORS = {
  surface: '#0f172a',
  line: '#3987e5', // azul: nosotros
  them: '#d95926', // naranja: rival
  good: '#0ca30c', // color de estado "bien": emoción positiva
  bad: '#d03b3b', // color de estado "mal": emoción negativa
  ink: '#f0efec', // punto de oro: sin color, para no confundirlo con el naranja
  grid: '#2c2c2a',
  axis: '#383835',
  text: '#898781',
};

// Cada tipo de marca se distingue por la forma y no solo por el color:
// círculo relleno = punto de oro · rombo = break · anillo con + o − = emoción.
export function MarkShape({ kind, cx, cy }: { kind: MarkKind; cx: number; cy: number }) {
  const ring = { stroke: COLORS.surface, strokeWidth: 2 }; // separa la marca de la línea que cruza
  switch (kind) {
    case 'gold':
      return <circle cx={cx} cy={cy} r={4.5} fill={COLORS.ink} {...ring} />;
    case 'break_us':
    case 'break_them':
      return (
        <polygon
          points={`${cx},${cy - 6.5} ${cx + 6.5},${cy} ${cx},${cy + 6.5} ${cx - 6.5},${cy}`}
          fill={kind === 'break_us' ? COLORS.line : COLORS.them}
          {...ring}
        />
      );
    case 'emotion_pos':
    case 'emotion_neg': {
      const color = kind === 'emotion_pos' ? COLORS.good : COLORS.bad;
      return (
        <g>
          <circle cx={cx} cy={cy} r={7.5} fill={COLORS.surface} stroke={color} strokeWidth={2} />
          <line x1={cx - 3.2} x2={cx + 3.2} y1={cy} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
          {kind === 'emotion_pos' && (
            <line x1={cx} x2={cx} y1={cy - 3.2} y2={cy + 3.2} stroke={color} strokeWidth={2} strokeLinecap="round" />
          )}
        </g>
      );
    }
  }
}

const LEGEND: { kind: MarkKind; label: string }[] = [
  { kind: 'gold', label: 'punto de oro' },
  { kind: 'break_us', label: 'break nuestro' },
  { kind: 'break_them', label: 'break rival' },
  { kind: 'emotion_pos', label: 'emoción positiva' },
  { kind: 'emotion_neg', label: 'emoción negativa' },
];

export default function MomentumChart({ momentum }: { momentum: Momentum }) {
  const n = momentum.values.length - 1;
  if (n <= 0) return null;

  const maxAbs = Math.max(5, ...momentum.values.map((v) => Math.abs(v)));
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const mid = PAD_TOP + innerH / 2;
  const x = (i: number) => PAD_X + (i / n) * (W - 2 * PAD_X);
  const y = (v: number) => mid - (v / maxAbs) * (innerH / 2);
  const line = momentum.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const sets = [{ x: 0, setIndex: 0 }, ...momentum.boundaries.filter((b) => b.kind === 'set')];
  const present = new Set(momentum.marks.map((m) => m.kind));
  const last = momentum.values[n];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Momentum del partido: saldo final ${signed(last)} tras ${n} puntos`}
      >
        {momentum.boundaries
          .filter((b) => b.kind === 'game')
          .map((b) => (
            <line key={`g${b.x}`} x1={x(b.x)} x2={x(b.x)} y1={PAD_TOP} y2={H - PAD_BOTTOM} stroke={COLORS.grid} />
          ))}
        {sets.map((s) => (
          <g key={`s${s.x}`}>
            {s.x > 0 && <line x1={x(s.x)} x2={x(s.x)} y1={4} y2={H - PAD_BOTTOM} stroke={COLORS.axis} />}
            <text x={x(s.x) + 4} y={14} fill={COLORS.text} fontSize={10}>
              Set {s.setIndex + 1}
            </text>
          </g>
        ))}
        <line x1={PAD_X} x2={W - PAD_X} y1={mid} y2={mid} stroke={COLORS.axis} />
        <text x={W - PAD_X} y={mid - 4} fill={COLORS.text} fontSize={9} textAnchor="end">
          nosotros ▲ · ▼ rival
        </text>
        <polyline fill="none" stroke={COLORS.line} strokeWidth={2} strokeLinejoin="round" points={line} />
        {momentum.marks.map((m, i) => (
          <MarkShape key={i} kind={m.kind} cx={x(m.x)} cy={y(m.y)} />
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {LEGEND.filter((item) => present.has(item.kind)).map((item) => (
          <li key={item.kind} className="flex items-center gap-1">
            <svg width={16} height={16} viewBox="-8 -8 16 16" aria-hidden="true">
              <MarkShape kind={item.kind} cx={0} cy={0} />
            </svg>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
