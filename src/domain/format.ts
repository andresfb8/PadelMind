import type { Ratio } from './analytics/types';
import type { MatchFormat } from './types';

export const ratioText = (r: Ratio) => `${r.won}/${r.total}`;

export const percentText = (r: Ratio) => (r.total === 0 ? 'sin datos' : `${Math.round((r.won / r.total) * 100)} %`);

// Proporción entre 0 y 1, o null si no hay casos.
export const ratioValue = (r: Ratio): number | null => (r.total === 0 ? null : r.won / r.total);

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function formatLabel(f: MatchFormat): string {
  const deuce = f.deuce === 'punto_de_oro' ? 'Punto de oro' : 'Ventajas';
  return f.finalSet === 'super_tiebreak' ? `${deuce} · súper tie-break` : deuce;
}

// "informe-ana-luis-2026-11-15.png": sin tildes ni símbolos, en minúsculas.
export function reportFileName(label: string, date: number): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const d = new Date(date);
  const day = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  return `informe-${slug || 'partido'}-${day}.png`;
}
