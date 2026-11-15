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

// Fecha en el formato de un campo <input type="date"> ("2026-11-15"), en hora local.
export function dateInputValue(ms: number): string {
  const d = new Date(ms);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

// De "2026-11-15" al mediodía local de ese día (el mediodía evita saltos de día por la zona horaria).
// Devuelve null si no es una fecha válida.
export function dateFromInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day, 12);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date.getTime() : null;
}

// "informe-ana-luis-2026-11-15.png": sin tildes ni símbolos, en minúsculas.
export function reportFileName(label: string, date: number): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `informe-${slug || 'partido'}-${dateInputValue(date)}.png`;
}
