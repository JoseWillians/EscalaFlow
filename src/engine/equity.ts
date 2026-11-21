import { addDays, getDayOfWeek, getMonthKey } from '@/domain/dates';
import type { AppState, ShiftTemplate, WeekSchedule } from '@/domain/schemas';

export type NightShiftEquityStatus = 'ok' | 'pending' | 'exempt';

export interface EmployeeEquitySummary {
  employeeId: string;
  teamId: string;
  name: string;
  isBeginner: boolean;
  nightShiftCount: number;
  nightShiftStatus: NightShiftEquityStatus;
  sundayCount: number;
  compOffCount: number;
  totalShiftsInMonth: number;
}

export function buildWeeksSnapshot(
  state: AppState,
  currentWeekOverride?: WeekSchedule,
): Record<string, WeekSchedule> {
  if (!currentWeekOverride) {
    return state.weeks;
  }
  return {
    ...state.weeks,
    [currentWeekOverride.weekStart]: currentWeekOverride,
  };
}

export function computeMonthlyEquity(params: {
  state: AppState;
  monthKey: string;
  currentWeekOverride?: WeekSchedule;
}): EmployeeEquitySummary[] {
  const { state, monthKey, currentWeekOverride } = params;
  const shiftsById = new Map<string, ShiftTemplate>(
    state.shifts.map((shift) => [shift.id, shift]),
  );
  const weeks = buildWeeksSnapshot(state, currentWeekOverride);

  const counters = new Map<
    string,
    { nightShiftCount: number; sundayCount: number; compOffCount: number; totalShiftsInMonth: number }
  >();

  for (const emp of state.employees) {
    counters.set(emp.id, {
      nightShiftCount: 0,
      sundayCount: 0,
      compOffCount: 0,
      totalShiftsInMonth: 0,
    });
  }

  for (const week of Object.values(weeks)) {
    for (const [employeeId, dayMap] of Object.entries(week.assignments)) {
      const target = counters.get(employeeId);
      if (!target) continue;

      for (const [date, cell] of Object.entries(dayMap)) {
        if (getMonthKey(date) !== monthKey) continue;

        if (cell.kind === 'SHIFT') {
          target.totalShiftsInMonth += 1;
          if (cell.shiftId) {
            const shift = shiftsById.get(cell.shiftId);
            if (shift?.isNightShift) {
              target.nightShiftCount += 1;
            }
          }
          if (getDayOfWeek(date) === 0) {
            target.sundayCount += 1;
          }
        } else if (cell.kind === 'COMP_OFF') {
          target.compOffCount += 1;
        }
      }
    }
  }

  return state.employees
    .filter((emp) => emp.active)
    .map((emp) => {
      const counts = counters.get(emp.id) ?? {
        nightShiftCount: 0,
        sundayCount: 0,
        compOffCount: 0,
        totalShiftsInMonth: 0,
      };
      const nightShiftStatus: NightShiftEquityStatus = emp.isBeginner
        ? 'exempt'
        : counts.nightShiftCount >= 1
          ? 'ok'
          : 'pending';

      return {
        employeeId: emp.id,
        teamId: emp.teamId,
        name: emp.name,
        isBeginner: emp.isBeginner,
        nightShiftCount: counts.nightShiftCount,
        nightShiftStatus,
        sundayCount: counts.sundayCount,
        compOffCount: counts.compOffCount,
        totalShiftsInMonth: counts.totalShiftsInMonth,
      };
    });
}

export function getPreviousSundayWorkers(state: AppState, weekStart: string): Set<string> {
  const prevWeekStart = addDays(weekStart, -7);
  const prevSundayDate = addDays(weekStart, -1);
  const prevWeek = state.weeks[prevWeekStart];
  const workers = new Set<string>();
  if (!prevWeek) return workers;

  for (const [employeeId, dayMap] of Object.entries(prevWeek.assignments)) {
    if (dayMap[prevSundayDate]?.kind === 'SHIFT') {
      workers.add(employeeId);
    }
  }
  return workers;
}

export function getSavedMonthMetricsExcludingWeek(
  state: AppState,
  monthKey: string,
  excludeWeekStart: string,
): { nightCounts: Map<string, number>; sundayCounts: Map<string, number> } {
  const nightCounts = new Map<string, number>();
  const sundayCounts = new Map<string, number>();
  const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));

  for (const [wkStart, week] of Object.entries(state.weeks)) {
    if (wkStart === excludeWeekStart) continue;
    for (const [employeeId, dayMap] of Object.entries(week.assignments)) {
      for (const [date, cell] of Object.entries(dayMap)) {
        if (getMonthKey(date) !== monthKey || cell.kind !== 'SHIFT') continue;
        if (cell.shiftId && shiftsById.get(cell.shiftId)?.isNightShift) {
          nightCounts.set(employeeId, (nightCounts.get(employeeId) ?? 0) + 1);
        }
        if (getDayOfWeek(date) === 0) {
          sundayCounts.set(employeeId, (sundayCounts.get(employeeId) ?? 0) + 1);
        }
      }
    }
  }

  return { nightCounts, sundayCounts };
}
