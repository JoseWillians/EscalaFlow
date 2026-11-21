import {
  addDays,
  getDayOfWeek,
  getMonthKey,
  getWeekDays,
  parseIsoDate,
} from '@/domain/dates';
import type {
  AppState,
  CellAssignment,
  Employee,
  ShiftTemplate,
  WeekSchedule,
} from '@/domain/schemas';
import {
  getPreviousSundayWorkers,
  getSavedMonthMetricsExcludingWeek,
} from './equity';
import {
  getApplicableShiftsForDate,
  getEmployeeUnavailabilityOnDate,
  hasInterjornadaViolation,
} from './validator';

function getWeekSeed(weekStart: string): number {
  const dt = parseIsoDate(weekStart);
  return Math.floor(dt.getTime() / (7 * 24 * 60 * 60 * 1000));
}

function countWeekShifts(
  assignments: Record<string, Record<string, CellAssignment>>,
  employeeId: string,
  days: string[],
): number {
  let count = 0;
  for (const d of days) {
    if (assignments[employeeId]?.[d]?.kind === 'SHIFT') {
      count += 1;
    }
  }
  return count;
}

function countWeekNightShifts(
  assignments: Record<string, Record<string, CellAssignment>>,
  employeeId: string,
  days: string[],
  shiftsById: Map<string, ShiftTemplate>,
): number {
  let count = 0;
  for (const d of days) {
    const cell = assignments[employeeId]?.[d];
    if (cell?.kind === 'SHIFT' && cell.shiftId && shiftsById.get(cell.shiftId)?.isNightShift) {
      count += 1;
    }
  }
  return count;
}

function getCurrentMonthNightCount(params: {
  employeeId: string;
  monthKey: string;
  savedNightCounts: Map<string, number>;
  assignments: Record<string, Record<string, CellAssignment>>;
  days: string[];
  shiftsById: Map<string, ShiftTemplate>;
}): number {
  const { employeeId, monthKey, savedNightCounts, assignments, days, shiftsById } = params;
  let total = savedNightCounts.get(employeeId) ?? 0;
  for (const d of days) {
    if (getMonthKey(d) !== monthKey) continue;
    const cell = assignments[employeeId]?.[d];
    if (cell?.kind === 'SHIFT' && cell.shiftId && shiftsById.get(cell.shiftId)?.isNightShift) {
      total += 1;
    }
  }
  return total;
}

function wouldViolateInterjornada(params: {
  employeeId: string;
  date: string;
  candidateShift: ShiftTemplate;
  weekStart: string;
  assignments: Record<string, Record<string, CellAssignment>>;
  state: AppState;
  shiftsById: Map<string, ShiftTemplate>;
}): boolean {
  const { employeeId, date, candidateShift, weekStart, assignments, state, shiftsById } = params;
  const prevDate = addDays(date, -1);
  const prevWeek = state.weeks[addDays(weekStart, -7)];
  const prevCell =
    prevDate >= weekStart
      ? assignments[employeeId]?.[prevDate]
      : prevWeek?.assignments[employeeId]?.[prevDate];

  if (prevCell?.kind === 'SHIFT' && prevCell.shiftId) {
    const prevShift = shiftsById.get(prevCell.shiftId);
    if (prevShift && hasInterjornadaViolation(prevShift, candidateShift).violated) {
      return true;
    }
  }

  const nextDate = addDays(date, 1);
  const nextCell = assignments[employeeId]?.[nextDate];
  if (nextCell?.kind === 'SHIFT' && nextCell.shiftId) {
    const nextShift = shiftsById.get(nextCell.shiftId);
    if (nextShift && hasInterjornadaViolation(candidateShift, nextShift).violated) {
      return true;
    }
  }

  return false;
}

function pickBestCompOffDay(params: {
  employeeId: string;
  weekdays: string[];
  assignments: Record<string, Record<string, CellAssignment>>;
  state: AppState;
  teamEmployees: Employee[];
}): string | undefined {
  const { employeeId, weekdays, assignments, state, teamEmployees } = params;

  const candidates = weekdays.filter((date) => {
    const cell = assignments[employeeId]?.[date];
    return cell === undefined;
  });
  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const aIsSat = getDayOfWeek(a) === 6 ? 1 : 0;
    const bIsSat = getDayOfWeek(b) === 6 ? 1 : 0;
    if (aIsSat !== bIsSat) return aIsSat - bIsSat;

    const surplus = (date: string) => {
      const available = teamEmployees.filter(
        (e) => assignments[e.id]?.[date] === undefined,
      ).length;
      const needed = getApplicableShiftsForDate(state, date).reduce(
        (acc, s) => acc + s.targetHeadcount,
        0,
      );
      return available - needed;
    };

    const diff = surplus(b) - surplus(a);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  return candidates[0];
}

function scheduleTeamWeek(params: {
  state: AppState;
  weekStart: string;
  teamEmployees: Employee[];
  assignments: Record<string, Record<string, CellAssignment>>;
  shiftsById: Map<string, ShiftTemplate>;
  prevSundayWorkers: Set<string>;
  weekSeed: number;
}): void {
  const {
    state,
    weekStart,
    teamEmployees,
    assignments,
    shiftsById,
    prevSundayWorkers,
    weekSeed,
  } = params;

  if (teamEmployees.length === 0) return;

  const days = getWeekDays(weekStart);
  const weekdays = days.slice(0, 6);
  const sundayDate = days[6];
  const empIndexMap = new Map(teamEmployees.map((e, idx) => [e.id, idx]));

  // Modo semana seguinte: aloca Folga (Dom.) nesta semana para quem trabalhou no domingo anterior
  if (state.sundayCompMode === 'next_week') {
    const prevWeek = state.weeks[addDays(weekStart, -7)];
    const prevDays = prevWeek ? getWeekDays(prevWeek.weekStart) : [];
    for (const emp of teamEmployees) {
      if (!prevSundayWorkers.has(emp.id)) continue;
      const alreadyHadPrev = prevDays
        .slice(0, 6)
        .some((d) => prevWeek?.assignments[emp.id]?.[d]?.kind === 'COMP_OFF');
      const alreadyLockedNow = weekdays.some((d) => assignments[emp.id]?.[d]?.kind === 'COMP_OFF');
      if (alreadyHadPrev || alreadyLockedNow) continue;

      const compDay = pickBestCompOffDay({
        employeeId: emp.id,
        weekdays,
        assignments,
        state,
        teamEmployees,
      });
      if (compDay) {
        assignments[emp.id][compDay] = { kind: 'COMP_OFF', locked: false };
      }
    }
  }

  // Passo A: Escalar o Domingo (2 pessoas por padrão no turno 08:00 às 18:00)
  const sundayShifts = getApplicableShiftsForDate(state, sundayDate);
  const sundayMonthKey = getMonthKey(sundayDate);
  const sundayMonthMetrics = getSavedMonthMetricsExcludingWeek(state, sundayMonthKey, weekStart);

  const sundayAssignedEmployees = new Set<string>(
    teamEmployees
      .filter((e) => assignments[e.id]?.[sundayDate]?.kind === 'SHIFT')
      .map((e) => e.id),
  );

  for (const shift of sundayShifts) {
    const alreadyInShift = teamEmployees.filter(
      (e) =>
        assignments[e.id]?.[sundayDate]?.kind === 'SHIFT' &&
        assignments[e.id]?.[sundayDate]?.shiftId === shift.id,
    ).length;

    let remaining = Math.max(0, shift.targetHeadcount - alreadyInShift);
    while (remaining > 0) {
      const candidates = teamEmployees.filter((emp) => {
        if (emp.isBeginner) return false;
        if (assignments[emp.id]?.[sundayDate] !== undefined) return false;
        return true;
      });
      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        const prevA = prevSundayWorkers.has(a.id) ? 1 : 0;
        const prevB = prevSundayWorkers.has(b.id) ? 1 : 0;
        if (prevA !== prevB) return prevA - prevB;

        const sunA = sundayMonthMetrics.sundayCounts.get(a.id) ?? 0;
        const sunB = sundayMonthMetrics.sundayCounts.get(b.id) ?? 0;
        if (sunA !== sunB) return sunA - sunB;

        const freeWeekdaysA = weekdays.filter((d) => assignments[a.id]?.[d] === undefined).length;
        const freeWeekdaysB = weekdays.filter((d) => assignments[b.id]?.[d] === undefined).length;
        if (freeWeekdaysA !== freeWeekdaysB) return freeWeekdaysB - freeWeekdaysA;

        const idxA = ((empIndexMap.get(a.id) ?? 0) + weekSeed) % teamEmployees.length;
        const idxB = ((empIndexMap.get(b.id) ?? 0) + weekSeed) % teamEmployees.length;
        return idxA - idxB;
      });

      const chosen = candidates[0];
      assignments[chosen.id][sundayDate] = {
        kind: 'SHIFT',
        shiftId: shift.id,
        locked: false,
      };
      sundayAssignedEmployees.add(chosen.id);
      remaining -= 1;
    }
  }

  // Se Folga (Dom.) for na mesma semana, garante 1 dia de COMP_OFF em Seg-Sáb para quem trabalha no Domingo
  if (state.sundayCompMode === 'same_week') {
    for (const empId of sundayAssignedEmployees) {
      const alreadyHasCompOff = weekdays.some((d) => assignments[empId]?.[d]?.kind === 'COMP_OFF');
      if (alreadyHasCompOff) continue;

      const compDay = pickBestCompOffDay({
        employeeId: empId,
        weekdays,
        assignments,
        state,
        teamEmployees,
      });
      if (compDay) {
        assignments[empId][compDay] = { kind: 'COMP_OFF', locked: false };
      }
    }
  }

  // Passo B: Escalar Segunda a Sábado
  const monthMetricsCache = new Map<
    string,
    { nightCounts: Map<string, number>; sundayCounts: Map<string, number> }
  >();
  const getSavedNightCounts = (monthKey: string) => {
    let cached = monthMetricsCache.get(monthKey);
    if (!cached) {
      cached = getSavedMonthMetricsExcludingWeek(state, monthKey, weekStart);
      monthMetricsCache.set(monthKey, cached);
    }
    return cached.nightCounts;
  };

  for (let dayIdx = 0; dayIdx < weekdays.length; dayIdx += 1) {
    const date = weekdays[dayIdx];
    const holiday = state.holidays[date];
    const isHolidaySpecial = holiday?.mode === 'special';

    // Em feriado especial, iniciantes não trabalham: recebem folga de feriado
    if (isHolidaySpecial) {
      for (const emp of teamEmployees) {
        if (emp.isBeginner && assignments[emp.id]?.[date] === undefined) {
          assignments[emp.id][date] = { kind: 'HOLIDAY_OFF', locked: false };
        }
      }
    }

    const applicable = getApplicableShiftsForDate(state, date);
    if (applicable.length === 0) continue;

    const monthKey = getMonthKey(date);
    const savedNightCounts = getSavedNightCounts(monthKey);

    const remainingNeed = new Map<string, number>();
    for (const shift of applicable) {
      const already = teamEmployees.filter(
        (e) =>
          assignments[e.id]?.[date]?.kind === 'SHIFT' &&
          assignments[e.id]?.[date]?.shiftId === shift.id,
      ).length;
      remainingNeed.set(shift.id, Math.max(0, shift.targetHeadcount - already));
    }

    // Subpasso B1: Turnos noturnos (isNightShift) primeiro para preservar elegíveis com 0 ocorrências no mês
    const nightShifts = applicable.filter((s) => s.isNightShift);
    for (const shift of nightShifts) {
      let need = remainingNeed.get(shift.id) ?? 0;
      while (need > 0) {
        const candidates = teamEmployees.filter((emp) => {
          if (emp.isBeginner) return false;
          if (assignments[emp.id]?.[date] !== undefined) return false;
          return true;
        });
        if (candidates.length === 0) break;

        candidates.sort((a, b) => {
          const mNightA = getCurrentMonthNightCount({
            employeeId: a.id,
            monthKey,
            savedNightCounts,
            assignments,
            days,
            shiftsById,
          });
          const mNightB = getCurrentMonthNightCount({
            employeeId: b.id,
            monthKey,
            savedNightCounts,
            assignments,
            days,
            shiftsById,
          });
          if (mNightA !== mNightB) return mNightA - mNightB;

          const wNightA = countWeekNightShifts(assignments, a.id, days, shiftsById);
          const wNightB = countWeekNightShifts(assignments, b.id, days, shiftsById);
          if (wNightA !== wNightB) return wNightA - wNightB;

          const interA = wouldViolateInterjornada({
            employeeId: a.id,
            date,
            candidateShift: shift,
            weekStart,
            assignments,
            state,
            shiftsById,
          })
            ? 1
            : 0;
          const interB = wouldViolateInterjornada({
            employeeId: b.id,
            date,
            candidateShift: shift,
            weekStart,
            assignments,
            state,
            shiftsById,
          })
            ? 1
            : 0;
          if (interA !== interB) return interA - interB;

          const shiftsA = countWeekShifts(assignments, a.id, days);
          const shiftsB = countWeekShifts(assignments, b.id, days);
          if (shiftsA !== shiftsB) return shiftsA - shiftsB;

          const tieA = ((empIndexMap.get(a.id) ?? 0) + dayIdx + weekSeed) % teamEmployees.length;
          const tieB = ((empIndexMap.get(b.id) ?? 0) + dayIdx + weekSeed) % teamEmployees.length;
          return tieA - tieB;
        });

        const chosen = candidates[0];
        assignments[chosen.id][date] = {
          kind: 'SHIFT',
          shiftId: shift.id,
          locked: false,
        };
        need -= 1;
      }
      remainingNeed.set(shift.id, need);
    }

    // Subpasso B2: Demais turnos (round-robin por rodada para preencher metas mínimas)
    const regularShifts = applicable
      .filter((s) => !s.isNightShift)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    let assignedInRound = true;
    while (assignedInRound) {
      assignedInRound = false;
      for (const shift of regularShifts) {
        const need = remainingNeed.get(shift.id) ?? 0;
        if (need <= 0) continue;

        const candidates = teamEmployees.filter((emp) => {
          if (isHolidaySpecial && emp.isBeginner) return false;
          if (assignments[emp.id]?.[date] !== undefined) return false;
          return true;
        });
        if (candidates.length === 0) continue;

        candidates.sort((a, b) => {
          const interA = wouldViolateInterjornada({
            employeeId: a.id,
            date,
            candidateShift: shift,
            weekStart,
            assignments,
            state,
            shiftsById,
          })
            ? 1
            : 0;
          const interB = wouldViolateInterjornada({
            employeeId: b.id,
            date,
            candidateShift: shift,
            weekStart,
            assignments,
            state,
            shiftsById,
          })
            ? 1
            : 0;
          if (interA !== interB) return interA - interB;

          const shiftsA = countWeekShifts(assignments, a.id, days);
          const shiftsB = countWeekShifts(assignments, b.id, days);
          if (shiftsA !== shiftsB) return shiftsA - shiftsB;

          const reserveScore = (emp: Employee) => {
            if (emp.isBeginner) return 0;
            const mNight = getCurrentMonthNightCount({
              employeeId: emp.id,
              monthKey,
              savedNightCounts,
              assignments,
              days,
              shiftsById,
            });
            return mNight === 0 ? 2 : 1;
          };
          const resDiff = reserveScore(a) - reserveScore(b);
          if (resDiff !== 0) return resDiff;

          const tieA = ((empIndexMap.get(a.id) ?? 0) + dayIdx + weekSeed) % teamEmployees.length;
          const tieB = ((empIndexMap.get(b.id) ?? 0) + dayIdx + weekSeed) % teamEmployees.length;
          return tieA - tieB;
        });

        const chosen = candidates[0];
        assignments[chosen.id][date] = {
          kind: 'SHIFT',
          shiftId: shift.id,
          locked: false,
        };
        remainingNeed.set(shift.id, need - 1);
        assignedInRound = true;
      }
    }

    // Subpasso B3: Regra de jornada Seg-Sáb: quem NÃO está de Folga (Dom.)/Indisponível/Feriado
    // não recebe folga no meio da semana — deve ser alocado em um turno elegível daquele dia
    const remainingEmployees = teamEmployees.filter(
      (emp) => assignments[emp.id]?.[date] === undefined,
    );
    for (const emp of remainingEmployees) {
      const eligibleShifts = applicable.filter((shift) => {
        if (emp.isBeginner && (shift.isNightShift || isHolidaySpecial)) return false;
        return true;
      });
      if (eligibleShifts.length === 0) continue;

      eligibleShifts.sort((a, b) => {
        const interA = wouldViolateInterjornada({
          employeeId: emp.id,
          date,
          candidateShift: a,
          weekStart,
          assignments,
          state,
          shiftsById,
        })
          ? 1
          : 0;
        const interB = wouldViolateInterjornada({
          employeeId: emp.id,
          date,
          candidateShift: b,
          weekStart,
          assignments,
          state,
          shiftsById,
        })
          ? 1
          : 0;
        if (interA !== interB) return interA - interB;

        // Prefere turnos diurnos ao distribuir excedente
        const nightA = a.isNightShift ? 1 : 0;
        const nightB = b.isNightShift ? 1 : 0;
        if (nightA !== nightB) return nightA - nightB;

        const countOnShift = (shiftId: string) =>
          teamEmployees.filter(
            (e) =>
              assignments[e.id]?.[date]?.kind === 'SHIFT' &&
              assignments[e.id]?.[date]?.shiftId === shiftId,
          ).length;

        const ratioA = countOnShift(a.id) / Math.max(1, a.targetHeadcount);
        const ratioB = countOnShift(b.id) / Math.max(1, b.targetHeadcount);
        if (ratioA !== ratioB) return ratioA - ratioB;

        return a.startTime.localeCompare(b.startTime);
      });

      assignments[emp.id][date] = {
        kind: 'SHIFT',
        shiftId: eligibleShifts[0].id,
        locked: false,
      };
    }
  }

  // Passo C: Preenche células restantes (em especial o Domingo para quem não foi escalado) como Folga ('OFF')
  for (const emp of teamEmployees) {
    for (const date of days) {
      if (assignments[emp.id][date] === undefined) {
        assignments[emp.id][date] = { kind: 'OFF', locked: false };
      }
    }
  }
}

export function generateWeekSchedule(params: {
  state: AppState;
  weekStart: string;
  existingWeek?: WeekSchedule;
}): WeekSchedule {
  const { state, weekStart, existingWeek } = params;
  const days = getWeekDays(weekStart);
  const weekSeed = getWeekSeed(weekStart);

  const activeTeamIds = new Set(state.teams.filter((t) => t.active).map((t) => t.id));
  const activeEmployees = state.employees.filter(
    (e) => e.active && (state.teams.length === 0 || activeTeamIds.has(e.teamId)),
  );
  const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));

  const assignments: Record<string, Record<string, CellAssignment>> = {};

  if (existingWeek) {
    for (const [empId, dayMap] of Object.entries(existingWeek.assignments)) {
      for (const [date, cell] of Object.entries(dayMap)) {
        if (cell.locked && days.includes(date)) {
          if (!assignments[empId]) assignments[empId] = {};
          assignments[empId][date] = { ...cell };
        }
      }
    }
  }

  for (const emp of activeEmployees) {
    if (!assignments[emp.id]) assignments[emp.id] = {};
    for (const date of days) {
      if (assignments[emp.id][date]?.locked) continue;

      const unavailability = getEmployeeUnavailabilityOnDate(state, emp.id, date);
      if (unavailability) {
        assignments[emp.id][date] = {
          kind: 'UNAVAILABLE',
          unavailabilityType: unavailability.type,
          locked: false,
        };
        continue;
      }

      const holiday = state.holidays[date];
      if (holiday?.mode === 'off_all') {
        assignments[emp.id][date] = {
          kind: 'HOLIDAY_OFF',
          locked: false,
        };
      }
    }
  }

  const prevSundayWorkers = getPreviousSundayWorkers(state, weekStart);

  // Agrupa colaboradores ativos por equipe e executa o motor para cada equipe separadamente
  const employeesByTeam = new Map<string, Employee[]>();
  for (const team of state.teams) {
    if (team.active) {
      employeesByTeam.set(team.id, []);
    }
  }
  for (const emp of activeEmployees) {
    const list = employeesByTeam.get(emp.teamId) ?? [];
    list.push(emp);
    employeesByTeam.set(emp.teamId, list);
  }

  for (const teamEmployees of employeesByTeam.values()) {
    scheduleTeamWeek({
      state,
      weekStart,
      teamEmployees,
      assignments,
      shiftsById,
      prevSundayWorkers,
      weekSeed,
    });
  }

  return {
    weekStart,
    assignments,
    note: existingWeek?.note ?? '',
    swaps: existingWeek?.swaps ?? [],
  };
}

export function clearUnlockedCells(params: {
  state: AppState;
  weekStart: string;
  existingWeek?: WeekSchedule;
}): WeekSchedule {
  const { state, weekStart, existingWeek } = params;
  const days = getWeekDays(weekStart);
  const assignments: Record<string, Record<string, CellAssignment>> = {};

  if (existingWeek) {
    for (const [empId, dayMap] of Object.entries(existingWeek.assignments)) {
      for (const [date, cell] of Object.entries(dayMap)) {
        if (cell.locked && days.includes(date)) {
          if (!assignments[empId]) assignments[empId] = {};
          assignments[empId][date] = { ...cell };
        }
      }
    }
  }

  for (const emp of state.employees.filter((e) => e.active)) {
    if (!assignments[emp.id]) assignments[emp.id] = {};
    for (const date of days) {
      if (assignments[emp.id][date]?.locked) continue;
      const unavailability = getEmployeeUnavailabilityOnDate(state, emp.id, date);
      if (unavailability) {
        assignments[emp.id][date] = {
          kind: 'UNAVAILABLE',
          unavailabilityType: unavailability.type,
          locked: false,
        };
        continue;
      }
      const holiday = state.holidays[date];
      if (holiday?.mode === 'off_all') {
        assignments[emp.id][date] = { kind: 'HOLIDAY_OFF', locked: false };
      }
    }
  }

  return {
    weekStart,
    assignments,
    note: existingWeek?.note ?? '',
    swaps: existingWeek?.swaps ?? [],
  };
}
