import { describe, expect, it } from 'vitest';
import { createSeedShifts } from '@/domain/seed';
import type { AppState } from '@/domain/schemas';
import { computeMonthlyEquity } from '../equity';

function buildBaseState(): AppState {
  return {
    version: 1,
    sundayCompMode: 'same_week',
    teams: [{ id: 'team-1', name: 'Equipe 1', active: true }],
    shifts: createSeedShifts(),
    employees: [
      { id: 'v1', name: 'Ana Paula', teamId: 'team-1', isBeginner: false, active: true },
      { id: 'v2', name: 'Carlos Eduardo', teamId: 'team-1', isBeginner: false, active: true },
      { id: 'b1', name: 'Marina Silva', teamId: 'team-1', isBeginner: true, active: true },
    ],
    unavailabilities: [],
    holidays: {},
    weeks: {
      '2026-11-02': {
        weekStart: '2026-11-02',
        note: '',
        swaps: [],
        assignments: {
          v1: {
            '2026-11-02': { kind: 'SHIFT', shiftId: 'shift-wk-12-22', locked: false },
            '2026-11-04': { kind: 'COMP_OFF', locked: false },
            '2026-11-08': { kind: 'SHIFT', shiftId: 'shift-sun-08-18', locked: false },
          },
          v2: {
            '2026-11-03': { kind: 'SHIFT', shiftId: 'shift-wk-08-18', locked: false },
          },
          b1: {
            '2026-11-03': { kind: 'SHIFT', shiftId: 'shift-wk-08-18', locked: false },
          },
        },
      },
    },
    pinnedNotes: '',
  };
}

describe('computeMonthlyEquity', () => {
  it('contabiliza turnos noturnos, domingos e folgas compensatórias no mês', () => {
    const state = buildBaseState();
    const result = computeMonthlyEquity({ state, monthKey: '2026-11' });

    const v1 = result.find((r) => r.employeeId === 'v1');
    const v2 = result.find((r) => r.employeeId === 'v2');
    const b1 = result.find((r) => r.employeeId === 'b1');

    expect(v1).toMatchObject({
      nightShiftCount: 1,
      nightShiftStatus: 'ok',
      sundayCount: 1,
      compOffCount: 1,
      totalShiftsInMonth: 2,
    });
    expect(v2).toMatchObject({
      nightShiftCount: 0,
      nightShiftStatus: 'pending',
      sundayCount: 0,
      compOffCount: 0,
      totalShiftsInMonth: 1,
    });
    expect(b1).toMatchObject({
      nightShiftCount: 0,
      nightShiftStatus: 'exempt',
      sundayCount: 0,
      compOffCount: 0,
      totalShiftsInMonth: 1,
    });
  });

  it('filtra apenas dias pertencentes ao mês alvo quando a semana cruza meses', () => {
    const state = buildBaseState();
    state.weeks['2026-11-30'] = {
      weekStart: '2026-11-30',
      note: '',
      swaps: [],
      assignments: {
        v2: {
          '2026-11-30': { kind: 'SHIFT', shiftId: 'shift-wk-12-22', locked: false },
          '2026-12-01': { kind: 'SHIFT', shiftId: 'shift-wk-12-22', locked: false },
        },
      },
    };

    const nov = computeMonthlyEquity({ state, monthKey: '2026-11' });
    const dec = computeMonthlyEquity({ state, monthKey: '2026-12' });

    expect(nov.find((r) => r.employeeId === 'v2')?.nightShiftCount).toBe(1);
    expect(dec.find((r) => r.employeeId === 'v2')?.nightShiftCount).toBe(1);
  });
});
