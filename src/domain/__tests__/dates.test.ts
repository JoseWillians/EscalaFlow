import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatWeekRangeBr,
  getDayCategory,
  getWeekDays,
  getWeekReferenceMonthKey,
  getWeekStartMonday,
} from '../dates';

describe('domain/dates', () => {
  it('calcula a segunda-feira correta para qualquer dia da semana', () => {
    expect(getWeekStartMonday('2026-11-18')).toBe('2026-11-16'); // Quarta -> Segunda
    expect(getWeekStartMonday('2026-11-22')).toBe('2026-11-16'); // Domingo -> Segunda
    expect(getWeekStartMonday('2026-11-16')).toBe('2026-11-16'); // Segunda -> Segunda
  });

  it('gera 7 dias consecutivos e classifica weekday, saturday, sunday e holiday', () => {
    const days = getWeekDays('2026-11-16');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-16');
    expect(days[6]).toBe('2026-11-22');
    expect(getDayCategory(days[0], false)).toBe('weekday');
    expect(getDayCategory(days[5], false)).toBe('saturday');
    expect(getDayCategory(days[6], false)).toBe('sunday');
    expect(getDayCategory(days[2], true)).toBe('holiday');
  });

  it('formata intervalo semanal e resolve mês de referência', () => {
    expect(formatWeekRangeBr('2026-11-16')).toBe('16/11 a 22/11');
    expect(getWeekReferenceMonthKey('2026-11-30')).toBe('2026-12');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});
