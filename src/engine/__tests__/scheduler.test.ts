import { describe, expect, it } from 'vitest';
import { getWeekDays } from '@/domain/dates';
import { createSampleState, createSeedShifts } from '@/domain/seed';
import type { AppState } from '@/domain/schemas';
import { generateWeekSchedule } from '../scheduler';
import { validateWeekSchedule } from '../validator';

describe('generateWeekSchedule', () => {
  it('escala 2 pessoas aos domingos somente no turno 08h às 18h por equipe', () => {
    const state = createSampleState('2026-11-09');
    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    const days = getWeekDays('2026-11-09');
    const sundayDate = days[6];

    for (const team of state.teams) {
      const teamEmployees = state.employees.filter((e) => e.teamId === team.id && e.active);
      const sundayWorkers = teamEmployees.filter(
        (e) => week.assignments[e.id]?.[sundayDate]?.kind === 'SHIFT',
      );
      expect(sundayWorkers).toHaveLength(2);
      for (const worker of sundayWorkers) {
        expect(week.assignments[worker.id]?.[sundayDate]?.shiftId).toBe('shift-sun-08-18');
      }
    }
  });

  it('garante que apenas quem trabalhou no domingo folga no meio da semana; os demais trabalham seg-sáb e folgam só no domingo', () => {
    const state = createSampleState('2026-11-09');
    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    const days = getWeekDays('2026-11-09');
    const weekdays = days.slice(0, 6);
    const sundayDate = days[6];

    for (const emp of state.employees) {
      const workedSunday = week.assignments[emp.id]?.[sundayDate]?.kind === 'SHIFT';
      const midweekOffs = weekdays.filter((d) => {
        const kind = week.assignments[emp.id]?.[d]?.kind;
        return kind === 'OFF' || kind === 'COMP_OFF';
      });

      if (workedSunday) {
        expect(midweekOffs).toHaveLength(1);
        expect(week.assignments[emp.id]?.[midweekOffs[0]]?.kind).toBe('COMP_OFF');
      } else {
        expect(midweekOffs).toHaveLength(0);
        for (const wd of weekdays) {
          expect(week.assignments[emp.id]?.[wd]?.kind).toBe('SHIFT');
        }
        expect(week.assignments[emp.id]?.[sundayDate]?.kind).toBe('OFF');
      }
    }
  });

  it('respeita restrição de iniciantes (sem 12-22, sem domingo, sem feriado com expediente)', () => {
    const state = createSampleState('2026-11-09');
    state.holidays['2026-11-12'] = {
      date: '2026-11-12',
      name: 'Feriado Teste',
      mode: 'special',
      shiftIds: ['shift-sun-08-18'],
    };

    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    const beginners = state.employees.filter((e) => e.isBeginner);
    const days = getWeekDays('2026-11-09');

    for (const emp of beginners) {
      for (const date of days) {
        const cell = week.assignments[emp.id]?.[date];
        if (!cell || cell.kind !== 'SHIFT') continue;
        const shift = state.shifts.find((s) => s.id === cell.shiftId);
        expect(shift?.isNightShift).toBe(false);
        expect(date).not.toBe(days[6]); // Domingo
        expect(date).not.toBe('2026-11-12'); // Feriado especial
      }
    }

    const issues = validateWeekSchedule({ state, weekStart: '2026-11-09', week });
    const hardErrors = issues.filter((i) => i.severity === 'error');
    expect(hardErrors).toHaveLength(0);
  });

  it('aloca folga compensatória de domingo na mesma semana ou na semana seguinte conforme configuração', () => {
    const stateSame = createSampleState('2026-11-09');
    stateSame.sundayCompMode = 'same_week';
    const weekSame = generateWeekSchedule({ state: stateSame, weekStart: '2026-11-09' });
    const days1 = getWeekDays('2026-11-09');

    const sundayWorkers1 = stateSame.employees.filter(
      (e) => weekSame.assignments[e.id]?.[days1[6]]?.kind === 'SHIFT',
    );
    expect(sundayWorkers1.length).toBeGreaterThan(0);
    for (const worker of sundayWorkers1) {
      const hasCompOff = days1
        .slice(0, 6)
        .some((d) => weekSame.assignments[worker.id]?.[d]?.kind === 'COMP_OFF');
      expect(hasCompOff).toBe(true);
    }

    const stateNext = createSampleState('2026-11-09');
    stateNext.sundayCompMode = 'next_week';
    const week1 = generateWeekSchedule({ state: stateNext, weekStart: '2026-11-09' });
    stateNext.weeks['2026-11-09'] = week1;
    const week2 = generateWeekSchedule({ state: stateNext, weekStart: '2026-11-16' });
    const days2 = getWeekDays('2026-11-16');

    const w1SunWorkers = stateNext.employees.filter(
      (e) => week1.assignments[e.id]?.[days1[6]]?.kind === 'SHIFT',
    );
    for (const worker of w1SunWorkers) {
      const hasCompOffNextWeek = days2
        .slice(0, 6)
        .some((d) => week2.assignments[worker.id]?.[d]?.kind === 'COMP_OFF');
      expect(hasCompOffNextWeek).toBe(true);
    }
  });

  it('prioriza rodízio mensal de 12h-22h garantindo que todos os veteranos elegíveis cumpram no mês', () => {
    const state: AppState = {
      version: 1,
      sundayCompMode: 'same_week',
      teams: [{ id: 'team-1', name: 'Equipe Principal', active: true }],
      shifts: createSeedShifts(),
      employees: [
        { id: 'v1', name: 'Veterano 1', teamId: 'team-1', isBeginner: false, active: true },
        { id: 'v2', name: 'Veterano 2', teamId: 'team-1', isBeginner: false, active: true },
        { id: 'v3', name: 'Veterano 3', teamId: 'team-1', isBeginner: false, active: true },
        { id: 'v4', name: 'Veterano 4', teamId: 'team-1', isBeginner: false, active: true },
        { id: 'v5', name: 'Veterano 5', teamId: 'team-1', isBeginner: false, active: true },
        { id: 'b1', name: 'Iniciante 1', teamId: 'team-1', isBeginner: true, active: true },
      ],
      unavailabilities: [],
      holidays: {},
      weeks: {},
      pinnedNotes: '',
    };

    const week1 = generateWeekSchedule({ state, weekStart: '2026-11-02' });
    state.weeks['2026-11-02'] = week1;
    const week2 = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    state.weeks['2026-11-09'] = week2;

    const nightCounts = new Map<string, number>();
    for (const wk of Object.values(state.weeks)) {
      for (const emp of state.employees) {
        for (const cell of Object.values(wk.assignments[emp.id] ?? {})) {
          if (cell.kind === 'SHIFT' && cell.shiftId === 'shift-wk-12-22') {
            nightCounts.set(emp.id, (nightCounts.get(emp.id) ?? 0) + 1);
          }
        }
      }
    }

    for (const vetId of ['v1', 'v2', 'v3', 'v4', 'v5']) {
      expect(nightCounts.get(vetId) ?? 0).toBeGreaterThanOrEqual(1);
    }
    expect(nightCounts.get('b1') ?? 0).toBe(0);
  });

  it('evita escalar o mesmo colaborador em dois domingos consecutivos quando há outro veterano elegível na equipe', () => {
    const state = createSampleState('2026-11-02');
    const firstTeamId = state.teams[0].id;
    const week1 = generateWeekSchedule({ state, weekStart: '2026-11-02' });
    state.weeks['2026-11-02'] = week1;
    const week2 = generateWeekSchedule({ state, weekStart: '2026-11-09' });

    const teamEmployees = state.employees.filter((e) => e.teamId === firstTeamId);
    const sun1Workers = teamEmployees
      .filter((e) => week1.assignments[e.id]?.['2026-11-08']?.kind === 'SHIFT')
      .map((e) => e.id);
    const sun2Workers = teamEmployees
      .filter((e) => week2.assignments[e.id]?.['2026-11-15']?.kind === 'SHIFT')
      .map((e) => e.id);

    expect(sun1Workers).toHaveLength(2);
    expect(sun2Workers).toHaveLength(2);
    for (const id of sun2Workers) {
      expect(sun1Workers).not.toContain(id);
    }
  });

  it('preserva células travadas manualmente, indisponibilidades e feriado com folga geral', () => {
    const state = createSampleState('2026-11-09');
    const firstEmp = state.employees[0].id;
    const secondEmp = state.employees[1].id;
    state.holidays['2026-11-11'] = {
      date: '2026-11-11',
      name: 'Feriado Folga Geral',
      mode: 'off_all',
      shiftIds: [],
    };
    state.unavailabilities.push({
      id: 'u-vacation',
      employeeId: secondEmp,
      startDate: '2026-11-09',
      endDate: '2026-11-10',
      type: 'VACATION',
    });

    const existingWeek = {
      weekStart: '2026-11-09',
      note: 'Manter nota',
      swaps: [],
      assignments: {
        [firstEmp]: {
          '2026-11-09': { kind: 'SHIFT' as const, shiftId: 'shift-wk-10-20', locked: true },
        },
      },
    };

    const generated = generateWeekSchedule({
      state,
      weekStart: '2026-11-09',
      existingWeek,
    });

    expect(generated.assignments[firstEmp]?.['2026-11-09']).toEqual({
      kind: 'SHIFT',
      shiftId: 'shift-wk-10-20',
      locked: true,
    });
    expect(generated.assignments[secondEmp]?.['2026-11-09']?.kind).toBe('UNAVAILABLE');
    expect(generated.assignments[secondEmp]?.['2026-11-10']?.kind).toBe('UNAVAILABLE');
    expect(generated.assignments[firstEmp]?.['2026-11-11']?.kind).toBe('HOLIDAY_OFF');
    expect(generated.note).toBe('Manter nota');
  });

  it('é determinístico para entradas idênticas e evita interjornada < 11h na geração automática', () => {
    const state = createSampleState('2026-11-09');
    const run1 = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    const run2 = generateWeekSchedule({ state, weekStart: '2026-11-09' });

    expect(run1).toEqual(run2);
    const issues = validateWeekSchedule({ state, weekStart: '2026-11-09', week: run1 });
    expect(issues.filter((i) => i.code === 'INTERJORNADA')).toHaveLength(0);
  });
});
