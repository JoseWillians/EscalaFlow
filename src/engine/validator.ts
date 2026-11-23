import {
  addDays,
  formatShortDateBr,
  getDayCategory,
  getDayOfWeek,
  getWeekDays,
  timeToMinutes,
} from '@/domain/dates';
import {
  DEFAULT_SCHEDULE_RULES,
  UNAVAILABILITY_LABELS,
  type AppState,
  type CellAssignment,
  type Employee,
  type ScheduleRules,
  type ShiftTemplate,
  type Unavailability,
  type WeekSchedule,
} from '@/domain/schemas';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'BEGINNER_NIGHT_SHIFT'
  | 'BEGINNER_SUNDAY'
  | 'BEGINNER_HOLIDAY'
  | 'UNAVAILABLE_CONFLICT'
  | 'INTERJORNADA'
  | 'MISSING_SUNDAY_COMP_OFF'
  | 'MIDWEEK_OFF_WITHOUT_SUNDAY'
  | 'UNDERSTAFFED'
  | 'LOCKED_CELL'
  | 'DAY_SHIFT_MISMATCH';

export interface ScheduleIssue {
  code: IssueCode;
  severity: IssueSeverity;
  employeeId?: string;
  teamId?: string;
  date?: string;
  shiftId?: string;
  message: string;
}

export interface SwapValidationResult {
  valid: boolean;
  issues: ScheduleIssue[];
  simulatedWeek: WeekSchedule;
}

export function getScheduleRules(state: AppState, teamId?: string): ScheduleRules {
  const general = state.scheduleRules ?? DEFAULT_SCHEDULE_RULES;
  if (!teamId) return general;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team?.rulesOverride) return general;
  return {
    ...general,
    ...team.rulesOverride,
  };
}

export function getEmployeeUnavailabilityOnDate(
  state: AppState,
  employeeId: string,
  date: string,
): Unavailability | undefined {
  return state.unavailabilities.find(
    (u) => u.employeeId === employeeId && u.startDate <= date && date <= u.endDate,
  );
}

export function getApplicableShiftsForDate(
  state: AppState,
  date: string,
  respectSelectedForGeneration = false,
  teamId?: string,
): ShiftTemplate[] {
  const rules = getScheduleRules(state, teamId);
  let activeShifts = state.shifts.filter((s) => s.active);
  if (respectSelectedForGeneration && rules.selectedShiftIdsForGeneration.length > 0) {
    const selectedSet = new Set(rules.selectedShiftIdsForGeneration);
    activeShifts = activeShifts.filter((s) => selectedSet.has(s.id));
  }

  const holiday = state.holidays[date];

  if (holiday) {
    if (holiday.mode === 'off_all') return [];
    if (holiday.shiftIds.length > 0) {
      return activeShifts.filter((s) => holiday.shiftIds.includes(s.id));
    }
    const sundayShifts = activeShifts.filter((s) => s.applicableDays.includes('sunday'));
    if (sundayShifts.length > 0) return sundayShifts;
    return activeShifts.filter((s) => s.applicableDays.includes('holiday'));
  }

  const category = getDayCategory(date, false);
  return activeShifts.filter((s) => s.applicableDays.includes(category));
}

export function hasInterjornadaViolation(
  prevShift: ShiftTemplate,
  nextShift: ShiftTemplate,
): { violated: boolean; restMinutes: number } {
  const prevEnd = timeToMinutes(prevShift.endTime);
  const nextStart = timeToMinutes(nextShift.startTime);
  const restMinutes = 24 * 60 - prevEnd + nextStart;
  return {
    violated: restMinutes < 11 * 60,
    restMinutes,
  };
}

function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function validateWeekSchedule(params: {
  state: AppState;
  weekStart: string;
  week: WeekSchedule;
}): ScheduleIssue[] {
  const { state, weekStart, week } = params;
  const issues: ScheduleIssue[] = [];
  const days = getWeekDays(weekStart);
  const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));
  const employeesById = new Map<string, Employee>(state.employees.map((e) => [e.id, e]));
  const teamsById = new Map(state.teams.map((t) => [t.id, t]));
  const prevWeek = state.weeks[addDays(weekStart, -7)];

  const trackedEmployees = state.employees.filter(
    (emp) => emp.active || Boolean(week.assignments[emp.id]),
  );

  for (const emp of trackedEmployees) {
    const empRules = getScheduleRules(state, emp.teamId);
    const empDays = week.assignments[emp.id] ?? {};

    for (const date of days) {
      const cell = empDays[date];
      if (!cell) continue;

      const dateBr = formatShortDateBr(date);
      const dow = getDayOfWeek(date);
      const isSunday = dow === 0;
      const isSaturday = dow === 6;
      const holiday = state.holidays[date];
      const isHolidaySpecial = holiday?.mode === 'special';
      const allowOffOnDay =
        isSunday ||
        (isSaturday && !holiday && empRules.saturdayStaffCount !== null) ||
        (isHolidaySpecial && empRules.holidayStaffCount !== null);

      if (empRules.noMidweekOffWithoutSunday && emp.active && !allowOffOnDay && cell.kind === 'OFF') {
        issues.push({
          code: 'MIDWEEK_OFF_WITHOUT_SUNDAY',
          severity: 'warning',
          employeeId: emp.id,
          teamId: emp.teamId,
          date,
          message: `${emp.name} está com Folga em ${dateBr} (meio de semana). Apenas quem trabalha no Domingo recebe folga compensatória na semana.`,
        });
      }

      if (cell.kind !== 'SHIFT') continue;

      const shift = cell.shiftId ? shiftsById.get(cell.shiftId) : undefined;

      if (empRules.enforceBeginnerRestrictions && emp.isBeginner) {
        if (shift?.isNightShift) {
          issues.push({
            code: 'BEGINNER_NIGHT_SHIFT',
            severity: 'error',
            employeeId: emp.id,
            teamId: emp.teamId,
            date,
            shiftId: shift.id,
            message: `${emp.name} é Iniciante e não pode atuar no turno noturno (${shift.name}) em ${dateBr}.`,
          });
        }
        if (isSunday) {
          issues.push({
            code: 'BEGINNER_SUNDAY',
            severity: 'error',
            employeeId: emp.id,
            teamId: emp.teamId,
            date,
            shiftId: shift?.id,
            message: `${emp.name} é Iniciante e não pode ser escalado no Domingo (${dateBr}).`,
          });
        }
        if (isHolidaySpecial) {
          issues.push({
            code: 'BEGINNER_HOLIDAY',
            severity: 'error',
            employeeId: emp.id,
            teamId: emp.teamId,
            date,
            shiftId: shift?.id,
            message: `${emp.name} é Iniciante e não pode trabalhar em feriado com expediente (${dateBr}).`,
          });
        }
      }

      const unavailability = getEmployeeUnavailabilityOnDate(state, emp.id, date);
      if (unavailability) {
        issues.push({
          code: 'UNAVAILABLE_CONFLICT',
          severity: 'error',
          employeeId: emp.id,
          teamId: emp.teamId,
          date,
          shiftId: shift?.id,
          message: `${emp.name} possui ${UNAVAILABILITY_LABELS[unavailability.type]} registrado em ${dateBr}.`,
        });
      }

      if (empRules.warnInterjornadaUnder11h) {
        const prevDate = addDays(date, -1);
        const prevCell =
          prevDate >= weekStart ? empDays[prevDate] : prevWeek?.assignments[emp.id]?.[prevDate];
        if (prevCell?.kind === 'SHIFT' && prevCell.shiftId && shift) {
          const prevShift = shiftsById.get(prevCell.shiftId);
          if (prevShift) {
            const { violated, restMinutes } = hasInterjornadaViolation(prevShift, shift);
            if (violated) {
              issues.push({
                code: 'INTERJORNADA',
                severity: 'warning',
                employeeId: emp.id,
                teamId: emp.teamId,
                date,
                shiftId: shift.id,
                message: `Alerta de interjornada para ${emp.name} em ${dateBr}: saída às ${prevShift.endTime} e entrada às ${shift.startTime} (${formatMinutesAsHours(restMinutes)} de descanso, mínimo 11h).`,
              });
            }
          }
        }
      }
    }

    if (empRules.enforceSundayCompOff) {
      if (state.sundayCompMode === 'same_week') {
        const workedSunday = empDays[days[6]]?.kind === 'SHIFT';
        if (workedSunday) {
          const hasCompOff = days.slice(0, 6).some((d) => empDays[d]?.kind === 'COMP_OFF');
          if (!hasCompOff) {
            issues.push({
              code: 'MISSING_SUNDAY_COMP_OFF',
              severity: 'warning',
              employeeId: emp.id,
              teamId: emp.teamId,
              date: days[6],
              message: `${emp.name} trabalha no Domingo (${formatShortDateBr(days[6])}) e está sem Folga (Dom.) na semana.`,
            });
          }
        }
      } else if (prevWeek) {
        const prevSunday = addDays(weekStart, -1);
        const workedPrevSunday = prevWeek.assignments[emp.id]?.[prevSunday]?.kind === 'SHIFT';
        if (workedPrevSunday) {
          const prevDays = getWeekDays(prevWeek.weekStart);
          const alreadyHadInPrev = prevDays
            .slice(0, 6)
            .some((d) => prevWeek.assignments[emp.id]?.[d]?.kind === 'COMP_OFF');
          const hasCompOffNow = days.slice(0, 6).some((d) => empDays[d]?.kind === 'COMP_OFF');
          if (!alreadyHadInPrev && !hasCompOffNow) {
            issues.push({
              code: 'MISSING_SUNDAY_COMP_OFF',
              severity: 'warning',
              employeeId: emp.id,
              teamId: emp.teamId,
              date: weekStart,
              message: `${emp.name} trabalhou no Domingo anterior (${formatShortDateBr(prevSunday)}) e está sem Folga (Dom.) nesta semana.`,
            });
          }
        }
      }
    }
  }

  // Checa cobertura alvo por equipe ativa e turno em cada dia (respeitando regra da equipe)
  const activeEmployeesByTeam = new Map<string, Employee[]>();
  for (const emp of trackedEmployees) {
    if (!employeesById.get(emp.id)?.active) continue;
    const list = activeEmployeesByTeam.get(emp.teamId) ?? [];
    list.push(emp);
    activeEmployeesByTeam.set(emp.teamId, list);
  }

  for (const [teamId, teamEmps] of activeEmployeesByTeam.entries()) {
    const teamRules = getScheduleRules(state, teamId);
    const teamName = teamsById.get(teamId)?.name;
    const prefix = activeEmployeesByTeam.size > 1 && teamName ? `[${teamName}] ` : '';

    for (const date of days) {
      const dow = getDayOfWeek(date);
      const isSunday = dow === 0;
      const isSaturday = dow === 6;
      const holiday = state.holidays[date];
      const isHolidaySpecial = holiday?.mode === 'special';
      const applicable = getApplicableShiftsForDate(state, date, true, teamId);
      if (isSunday && !holiday && teamRules.sundayStaffCount === 0) continue;
      if (isSaturday && !holiday && teamRules.saturdayStaffCount === 0) continue;
      if (isHolidaySpecial && teamRules.holidayStaffCount === 0) continue;

      const totalAssignedOnDay = teamEmps.filter(
        (emp) => week.assignments[emp.id]?.[date]?.kind === 'SHIFT',
      ).length;

      const dayExplicitCap =
        isHolidaySpecial && teamRules.holidayStaffCount !== null
          ? teamRules.holidayStaffCount
          : isSaturday && !holiday && teamRules.saturdayStaffCount !== null
            ? teamRules.saturdayStaffCount
            : isSunday && !holiday
              ? teamRules.sundayStaffCount
              : null;

      if (dayExplicitCap !== null && totalAssignedOnDay >= dayExplicitCap) {
        continue;
      }

      for (const shift of applicable) {
        let count = 0;
        for (const emp of teamEmps) {
          const cell = week.assignments[emp.id]?.[date];
          if (cell?.kind === 'SHIFT' && cell.shiftId === shift.id) {
            count += 1;
          }
        }
        const target =
          dayExplicitCap !== null
            ? Math.ceil(dayExplicitCap / Math.max(1, applicable.length))
            : shift.targetHeadcount;

        if (count < target) {
          issues.push({
            code: 'UNDERSTAFFED',
            severity: 'info',
            teamId,
            date,
            shiftId: shift.id,
            message: `${prefix}${shift.name} em ${formatShortDateBr(date)}: ${count}/${target} colaborador(es).`,
          });
        }
      }
    }
  }

  return issues;
}

export function validateSwap(params: {
  state: AppState;
  week: WeekSchedule;
  dateA: string;
  employeeIdA: string;
  dateB: string;
  employeeIdB: string;
}): SwapValidationResult {
  const { state, week, dateA, employeeIdA, dateB, employeeIdB } = params;
  const assignmentsCopy: Record<string, Record<string, CellAssignment>> = {};
  for (const [empId, daysMap] of Object.entries(week.assignments)) {
    assignmentsCopy[empId] = { ...daysMap };
  }

  const cellA: CellAssignment = assignmentsCopy[employeeIdA]?.[dateA] ?? {
    kind: 'OFF',
    locked: false,
  };
  const cellB: CellAssignment = assignmentsCopy[employeeIdB]?.[dateB] ?? {
    kind: 'OFF',
    locked: false,
  };

  if (!assignmentsCopy[employeeIdA]) assignmentsCopy[employeeIdA] = {};
  if (!assignmentsCopy[employeeIdB]) assignmentsCopy[employeeIdB] = {};

  assignmentsCopy[employeeIdA][dateA] = { ...cellB };
  assignmentsCopy[employeeIdB][dateB] = { ...cellA };

  const simulatedWeek: WeekSchedule = {
    ...week,
    assignments: assignmentsCopy,
  };

  const extraIssues: ScheduleIssue[] = [];
  if (cellA.locked || cellB.locked) {
    extraIssues.push({
      code: 'LOCKED_CELL',
      severity: 'warning',
      message: 'Uma ou ambas as células estão travadas com cadeado. A troca substituirá a trava manual.',
    });
  }

  const empA = state.employees.find((e) => e.id === employeeIdA);
  const empB = state.employees.find((e) => e.id === employeeIdB);
  if (empA && empB && empA.teamId !== empB.teamId) {
    extraIssues.push({
      code: 'DAY_SHIFT_MISMATCH',
      severity: 'warning',
      message: `${empA.name} e ${empB.name} pertencem a equipes diferentes.`,
    });
  }

  if (dateA !== dateB) {
    const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));
    const checkCompatibility = (
      receivingEmpId: string,
      targetDate: string,
      receivedCell: CellAssignment,
    ) => {
      if (receivedCell.kind !== 'SHIFT' || !receivedCell.shiftId) return;
      const shift = shiftsById.get(receivedCell.shiftId);
      if (!shift) return;
      const empTeamId = state.employees.find((e) => e.id === receivingEmpId)?.teamId;
      const applicable = getApplicableShiftsForDate(state, targetDate, false, empTeamId);
      if (!applicable.some((s) => s.id === shift.id)) {
        const empName = state.employees.find((e) => e.id === receivingEmpId)?.name ?? receivingEmpId;
        extraIssues.push({
          code: 'DAY_SHIFT_MISMATCH',
          severity: 'warning',
          employeeId: receivingEmpId,
          date: targetDate,
          shiftId: shift.id,
          message: `Turno "${shift.name}" normalmente não se aplica ao dia ${formatShortDateBr(targetDate)} (${empName}).`,
        });
      }
    };
    checkCompatibility(employeeIdA, dateA, cellB);
    checkCompatibility(employeeIdB, dateB, cellA);
  }

  const weekIssues = validateWeekSchedule({
    state,
    weekStart: week.weekStart,
    week: simulatedWeek,
  }).filter(
    (issue) =>
      issue.severity !== 'info' &&
      (issue.employeeId === employeeIdA || issue.employeeId === employeeIdB),
  );

  const issues = [...extraIssues, ...weekIssues];

  return {
    valid: issues.length === 0,
    issues,
    simulatedWeek,
  };
}
