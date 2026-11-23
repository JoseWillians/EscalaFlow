import type { DayCategory } from './schemas';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseIsoDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDate(dt);
}

/**
 * Retorna o dia da semana JS: 0 = Domingo, 1 = Segunda, ..., 6 = Sábado.
 */
export function getDayOfWeek(dateStr: string): number {
  return parseIsoDate(dateStr).getUTCDay();
}

/**
 * Retorna a segunda-feira (YYYY-MM-DD) da semana à qual `dateStr` pertence.
 */
export function getWeekStartMonday(dateStr: string): string {
  const dow = getDayOfWeek(dateStr);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diffToMonday);
}

/**
 * Retorna os 7 dias da semana (Seg a Dom) a partir de `weekStart` (segunda-feira).
 */
export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getDayCategory(dateStr: string, hasHoliday: boolean): DayCategory {
  if (hasHoliday) return 'holiday';
  const dow = getDayOfWeek(dateStr);
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

export function formatShortDateBr(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export function formatFullDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function getWeekdayShortPt(dateStr: string): string {
  return WEEKDAY_SHORT_PT[getDayOfWeek(dateStr)];
}

export function getWeekdayFullPt(dateStr: string): string {
  return WEEKDAY_FULL_PT[getDayOfWeek(dateStr)];
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * Retorna o mês de referência predominante da semana (maioria dos dias na semana, ou quinta-feira).
 */
export function getWeekReferenceMonthKey(weekStart: string): string {
  const thursday = addDays(weekStart, 3);
  return getMonthKey(thursday);
}

export function formatMonthYearPt(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES_PT[month - 1]} de ${year}`;
}

export function formatWeekRangeBr(weekStart: string): string {
  const weekEnd = addDays(weekStart, 6);
  return `${formatShortDateBr(weekStart)} a ${formatShortDateBr(weekEnd)}`;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
