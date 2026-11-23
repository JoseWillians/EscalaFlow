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
  ScheduleRules,
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
  getScheduleRules,
  hasInterjornadaViolation,
} from './validator';

function getWeekSeed(weekStart: string): number {
  const dt = parseIsoDate(weekStart);
  return Math.floor(dt.getTime() / (7 * 24 * 60 * 60 * 1000));
}

function deterministicNoise(seed: number, key: string): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
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
  teamId: string;
  weekdays: string[];
  assignments: Record<string, Record<string, CellAssignment>>;
  state: AppState;
  teamEmployees: Employee[];
  effectiveSeed: number;
}): string | undefined {
  const { employeeId, teamId, weekdays, assignments, state, teamEmployees, effectiveSeed } = params;

  const candidates = weekdays.filter((date) => {
    const cell = assignments[employeeId]?.[date];
    return cell === undefined;
  });
  if (candidates.length === 0) return undefined;

  const surplus = (date: string) => {
    const available = teamEmployees.filter(
      (e) => assignments[e.id]?.[date] === undefined,
    ).length;
    const needed = getApplicableShiftsForDate(state, date, true, teamId).reduce(
      (acc, s) => acc + s.targetHeadcount,
      0,
    );
    return available - needed;
  };

  candidates.sort((a, b) => {
    const aIsSat = getDayOfWeek(a) === 6 ? 1 : 0;
    const bIsSat = getDayOfWeek(b) === 6 ? 1 : 0;
    if (aIsSat !== bIsSat) return aIsSat - bIsSat;

    const aHasSurplus = surplus(a) >= 0 ? 0 : 1;
    const bHasSurplus = surplus(b) >= 0 ? 0 : 1;
    if (aHasSurplus !== bHasSurplus) return aHasSurplus - bHasSurplus;

    const noiseA = deterministicNoise(effectiveSeed, `comp:${employeeId}:${a}`);
    const noiseB = deterministicNoise(effectiveSeed, `comp:${employeeId}:${b}`);
    if (noiseA !== noiseB) return noiseA - noiseB;
    return a.localeCompare(b);
  });

  return candidates[0];
}

function scheduleTeamWeek(params: {
  state: AppState;
  teamId: string;
  rules: ScheduleRules;
  weekStart: string;
  teamEmployees: Employee[];
  assignments: Record<string, Record<string, CellAssignment>>;
  shiftsById: Map<string, ShiftTemplate>;
  prevSundayWorkers: Set<string>;
  effectiveSeed: number;
}): void {
  const {
    state,
    teamId,
    rules,
    weekStart,
    teamEmployees,
    assignments,
    shiftsById,
    prevSundayWorkers,
    effectiveSeed,
  } = params;

  if (teamEmployees.length === 0) return;

  const days = getWeekDays(weekStart);
  const weekdays = days.slice(0, 6);
  const sundayDate = days[6];

  // Modo semana seguinte: aloca Folga (Dom.) nesta semana para quem trabalhou no domingo anterior
  if (rules.enforceSundayCompOff && state.sundayCompMode === 'next_week') {
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
        teamId,
        weekdays,
        assignments,
        state,
        teamEmployees,
        effectiveSeed,
      });
      if (compDay) {
        assignments[emp.id][compDay] = { kind: 'COMP_OFF', locked: false };
      }
    }
  }

  // Passo A: Escalar o Domingo conforme sundayStaffCount configurado (equipe ou geral)
  const sundayShifts =
    rules.sundayStaffCount === 0 && !state.holidays[sundayDate]
      ? []
      : getApplicableShiftsForDate(state, sundayDate, true, teamId);
  const sundayMonthKey = getMonthKey(sundayDate);
  const sundayMonthMetrics = getSavedMonthMetricsExcludingWeek(state, sundayMonthKey, weekStart);

  const sundayAssignedEmployees = new Set<string>(
    teamEmployees
      .filter((e) => assignments[e.id]?.[sundayDate]?.kind === 'SHIFT')
      .map((e) => e.id),
  );

  if (sundayShifts.length > 0 && rules.sundayStaffCount > 0) {
    let remainingTotal = Math.max(0, rules.sundayStaffCount - sundayAssignedEmployees.size);
    let shiftCursor = 0;

    while (remainingTotal > 0) {
      const shift = sundayShifts[shiftCursor % sundayShifts.length];
      shiftCursor += 1;

      const candidates = teamEmployees.filter((emp) => {
        if (rules.enforceBeginnerRestrictions && emp.isBeginner) return false;
        if (assignments[emp.id]?.[sundayDate] !== undefined) return false;
        return true;
      });
      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        if (rules.avoidConsecutiveSundays) {
          const prevA = prevSundayWorkers.has(a.id) ? 1 : 0;
          const prevB = prevSundayWorkers.has(b.id) ? 1 : 0;
          if (prevA !== prevB) return prevA - prevB;
        }

        const sunA = sundayMonthMetrics.sundayCounts.get(a.id) ?? 0;
        const sunB = sundayMonthMetrics.sundayCounts.get(b.id) ?? 0;
        if (sunA !== sunB) return sunA - sunB;

        const hasFreeA = weekdays.some((d) => assignments[a.id]?.[d] === undefined) ? 0 : 1;
        const hasFreeB = weekdays.some((d) => assignments[b.id]?.[d] === undefined) ? 0 : 1;
        if (hasFreeA !== hasFreeB) return hasFreeA - hasFreeB;

        const noiseA = deterministicNoise(effectiveSeed, `sun:${a.id}:${sundayDate}`);
        const noiseB = deterministicNoise(effectiveSeed, `sun:${b.id}:${sundayDate}`);
        return noiseA - noiseB;
      });

      const chosen = candidates[0];
      assignments[chosen.id][sundayDate] = {
        kind: 'SHIFT',
        shiftId: shift.id,
        locked: false,
      };
      sundayAssignedEmployees.add(chosen.id);
      remainingTotal -= 1;
    }
  }

  // Se Folga (Dom.) for na mesma semana e regra ativa, garante 1 dia de COMP_OFF em Seg-Sáb
  if (rules.enforceSundayCompOff && state.sundayCompMode === 'same_week') {
    for (const empId of sundayAssignedEmployees) {
      const alreadyHasCompOff = weekdays.some((d) => assignments[empId]?.[d]?.kind === 'COMP_OFF');
      if (alreadyHasCompOff) continue;

      const compDay = pickBestCompOffDay({
        employeeId: empId,
        teamId,
        weekdays,
        assignments,
        state,
        teamEmployees,
        effectiveSeed,
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
    const dow = getDayOfWeek(date);
    const holiday = state.holidays[date];
    const isHolidaySpecial = holiday?.mode === 'special';

    if (isHolidaySpecial && rules.enforceBeginnerRestrictions) {
      for (const emp of teamEmployees) {
        if (emp.isBeginner && assignments[emp.id]?.[date] === undefined) {
          assignments[emp.id][date] = { kind: 'HOLIDAY_OFF', locked: false };
        }
      }
    }

    const dayExplicitCap =
      isHolidaySpecial && rules.holidayStaffCount !== null
        ? rules.holidayStaffCount
        : dow === 6 && !holiday && rules.saturdayStaffCount !== null
          ? rules.saturdayStaffCount
          : null;

    if (dayExplicitCap === 0) {
      if (isHolidaySpecial) {
        for (const emp of teamEmployees) {
          if (assignments[emp.id]?.[date] === undefined) {
            assignments[emp.id][date] = { kind: 'HOLIDAY_OFF', locked: false };
          }
        }
      }
      continue;
    }

    const applicable = getApplicableShiftsForDate(state, date, true, teamId);
    if (applicable.length === 0) continue;

    const monthKey = getMonthKey(date);
    const savedNightCounts = getSavedNightCounts(monthKey);

    let assignedCountToday = teamEmployees.filter(
      (e) => assignments[e.id]?.[date]?.kind === 'SHIFT',
    ).length;

    const hasRemainingDayCap = () =>
      dayExplicitCap === null || assignedCountToday < dayExplicitCap;

    const remainingNeed = new Map<string, number>();
    for (const shift of applicable) {
      const already = teamEmployees.filter(
        (e) =>
          assignments[e.id]?.[date]?.kind === 'SHIFT' &&
          assignments[e.id]?.[date]?.shiftId === shift.id,
      ).length;
      remainingNeed.set(shift.id, Math.max(0, shift.targetHeadcount - already));
    }

    // Subpasso B1: Turnos noturnos (isNightShift) primeiro
    const nightShifts = applicable.filter((s) => s.isNightShift);
    for (const shift of nightShifts) {
      let need = remainingNeed.get(shift.id) ?? 0;
      while (need > 0 && hasRemainingDayCap()) {
        const candidates = teamEmployees.filter((emp) => {
          if (rules.enforceBeginnerRestrictions && emp.isBeginner) return false;
          if (assignments[emp.id]?.[date] !== undefined) return false;
          return true;
        });
        if (candidates.length === 0) break;

        candidates.sort((a, b) => {
          if (rules.enforceNightShiftMonthlyRotation) {
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
          }

          if (rules.warnInterjornadaUnder11h) {
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
          }

          const shiftsA = countWeekShifts(assignments, a.id, days);
          const shiftsB = countWeekShifts(assignments, b.id, days);
          if (shiftsA !== shiftsB) return shiftsA - shiftsB;

          const noiseA = deterministicNoise(effectiveSeed, `night:${a.id}:${date}:${shift.id}`);
          const noiseB = deterministicNoise(effectiveSeed, `night:${b.id}:${date}:${shift.id}`);
          return noiseA - noiseB;
        });

        const chosen = candidates[0];
        assignments[chosen.id][date] = {
          kind: 'SHIFT',
          shiftId: shift.id,
          locked: false,
        };
        assignedCountToday += 1;
        need -= 1;
      }
      remainingNeed.set(shift.id, need);
    }

    // Subpasso B2: Demais turnos (mais cedo primeiro para preservar folga de interjornada de quem saiu tarde na véspera)
    const regularShifts = applicable
      .filter((s) => !s.isNightShift)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    let assignedInRound = true;
    while (assignedInRound && hasRemainingDayCap()) {
      assignedInRound = false;
      for (const shift of regularShifts) {
        if (!hasRemainingDayCap()) break;
        const initialNeed = remainingNeed.get(shift.id) ?? 0;
        if (initialNeed <= 0 && dayExplicitCap === null) continue;

        const slotsThisPass = dayExplicitCap === null ? initialNeed : 1;
        for (let slot = 0; slot < slotsThisPass && hasRemainingDayCap(); slot += 1) {
          const need = remainingNeed.get(shift.id) ?? 0;
          if (need <= 0 && dayExplicitCap === null) break;

          const candidates = teamEmployees.filter((emp) => {
            if (rules.enforceBeginnerRestrictions && isHolidaySpecial && emp.isBeginner) return false;
            if (assignments[emp.id]?.[date] !== undefined) return false;
            return true;
          });
          if (candidates.length === 0) break;

          candidates.sort((a, b) => {
            if (rules.warnInterjornadaUnder11h) {
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
            }

            const shiftsA = countWeekShifts(assignments, a.id, days);
            const shiftsB = countWeekShifts(assignments, b.id, days);
            if (shiftsA !== shiftsB) return shiftsA - shiftsB;

            if (rules.enforceNightShiftMonthlyRotation) {
              const reserveScore = (emp: Employee) => {
                if (rules.enforceBeginnerRestrictions && emp.isBeginner) return 0;
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
            }

            const noiseA = deterministicNoise(effectiveSeed, `reg:${a.id}:${date}:${shift.id}`);
            const noiseB = deterministicNoise(effectiveSeed, `reg:${b.id}:${date}:${shift.id}`);
            return noiseA - noiseB;
          });

          const chosen = candidates[0];
          assignments[chosen.id][date] = {
            kind: 'SHIFT',
            shiftId: shift.id,
            locked: false,
          };
          assignedCountToday += 1;
          if (need > 0) {
            remainingNeed.set(shift.id, need - 1);
          }
          assignedInRound = true;
        }
      }
    }

    if (isHolidaySpecial && dayExplicitCap !== null) {
      for (const emp of teamEmployees) {
        if (assignments[emp.id]?.[date] === undefined) {
          assignments[emp.id][date] = { kind: 'HOLIDAY_OFF', locked: false };
        }
      }
    }

    // Subpasso B3: Só folga no meio da semana quem trabalhou no domingo (se a regra estiver ativa e não houver teto explícito para sábado/feriado)
    if (rules.noMidweekOffWithoutSunday && dayExplicitCap === null) {
      const remainingEmployees = teamEmployees.filter(
        (emp) => assignments[emp.id]?.[date] === undefined,
      );
      for (const emp of remainingEmployees) {
        const eligibleShifts = applicable.filter((shift) => {
          if (rules.enforceBeginnerRestrictions && emp.isBeginner && (shift.isNightShift || isHolidaySpecial)) {
            return false;
          }
          return true;
        });
        if (eligibleShifts.length === 0) continue;

        eligibleShifts.sort((a, b) => {
          if (rules.warnInterjornadaUnder11h) {
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
          }

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

          const noiseA = deterministicNoise(effectiveSeed, `surplus:${emp.id}:${date}:${a.id}`);
          const noiseB = deterministicNoise(effectiveSeed, `surplus:${emp.id}:${date}:${b.id}`);
          return noiseA - noiseB;
        });

        assignments[emp.id][date] = {
          kind: 'SHIFT',
          shiftId: eligibleShifts[0].id,
          locked: false,
        };
      }
    }
  }

  // Passo C: Células restantes recebem Folga ('OFF')
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
  seed?: number;
}): WeekSchedule {
  const { state, weekStart, existingWeek, seed = 0 } = params;
  const days = getWeekDays(weekStart);
  const weekSeed = getWeekSeed(weekStart);
  const effectiveSeed = (weekSeed ^ Math.imul(seed, 2654435761)) >>> 0;

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

  for (const [teamId, teamEmployees] of employeesByTeam.entries()) {
    const teamRules = getScheduleRules(state, teamId);
    scheduleTeamWeek({
      state,
      teamId,
      rules: teamRules,
      weekStart,
      teamEmployees,
      assignments,
      shiftsById,
      prevSundayWorkers,
      effectiveSeed,
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
