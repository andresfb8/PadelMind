import { describe, expect, it } from 'vitest';
import { dateFromInput, dateInputValue, formatLabel, percentText, ratioText, ratioValue, reportFileName, signed } from './format';

describe('percentText y ratioText', () => {
  it('redondea el porcentaje', () => {
    expect(percentText({ won: 5, total: 13 })).toBe('38 %');
    expect(percentText({ won: 1, total: 1 })).toBe('100 %');
  });
  it('sin casos no inventa un porcentaje', () => {
    expect(percentText({ won: 0, total: 0 })).toBe('sin datos');
    expect(ratioValue({ won: 0, total: 0 })).toBeNull();
  });
  it('muestra ganados sobre jugados', () => {
    expect(ratioText({ won: 3, total: 8 })).toBe('3/8');
    expect(ratioValue({ won: 3, total: 8 })).toBe(0.375);
  });
});

describe('signed', () => {
  it('pone el signo', () => {
    expect([signed(3), signed(-5), signed(0)]).toEqual(['+3', '−5', '0']);
  });
});

describe('formatLabel', () => {
  it('describe el formato del partido', () => {
    expect(formatLabel({ deuce: 'punto_de_oro', finalSet: 'set_completo' })).toBe('Punto de oro');
    expect(formatLabel({ deuce: 'ventajas', finalSet: 'super_tiebreak' })).toBe('Ventajas · súper tie-break');
  });
});

describe('reportFileName', () => {
  const day = new Date(2026, 10, 15).getTime(); // 15 nov 2026, hora local
  it('quita tildes y símbolos y añade la fecha', () => {
    expect(reportFileName('Andrés / Pedro vs Los Cuñados', day)).toBe('informe-andres-pedro-vs-los-cunados-2026-11-15.png');
  });
  it('con un nombre vacío usa "partido"', () => {
    expect(reportFileName('???', day)).toBe('informe-partido-2026-11-15.png');
  });
});

describe('fechas del campo de fecha', () => {
  it('dateInputValue da año-mes-día en hora local', () => {
    expect(dateInputValue(new Date(2026, 10, 5, 23, 59).getTime())).toBe('2026-11-05');
  });

  it('dateFromInput devuelve el mediodía local de ese día', () => {
    expect(dateFromInput('2026-11-05')).toBe(new Date(2026, 10, 5, 12).getTime());
  });

  it('ida y vuelta sin saltos de día', () => {
    expect(dateInputValue(dateFromInput('2026-03-29') as number)).toBe('2026-03-29');
  });

  it('rechaza lo que no es una fecha', () => {
    for (const value of ['', 'abc', '2026-13-01', '2026-02-30', '26-11-05']) expect(dateFromInput(value)).toBeNull();
  });
});
