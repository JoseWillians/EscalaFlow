import { describe, expect, it } from 'vitest';
import { createSeedShifts } from '@/domain/seed';
import { DEFAULT_SCHEDULE_RULES, type AppState, type WeekSchedule } from '@/domain/schemas';
import { hasInterjornadaViolation, validateSwap, validateWeekSchedule } from '../validator';

function makeState(): AppState {
  return {
    version: 1,
    sundayCompMode: 'same_week',
    scheduleRules: { ...DEFAULT_SCHEDULE_RULES },
    teams: [{ id: 'team-1', name: 'Atendimento', active: true }],
    shifts: createSeedShifts(),
    employees: [
      { id: 'vet1', name: 'Camila Ferreira', teamId: 'team-1', isBeginner: false, active: true },
      { id: 'vet2', name: 'Rafael Mendes', teamId: 'team-1', isBeginner: false, active: true },
      { id: 'beg1', name: 'Juliana Costa', teamId: 'team-1', isBeginner: true, active: true },
    ],
    unavailabilities: [
      {
        id: 'u1',
        employeeId: 'vet2',
        startDate: '2026-11-11',
        endDate: '2026-11-11',
        type: 'PRE_OFF',
      },
    ],
    holidays: {
      '2026-11-12': {
        date: '2026-11-12',
        name: 'Feriado Especial',
        mode: 'special',
        shiftIds: ['shift-sun-08-18'],
      },
    },
    weeks: {},
    pinnedNotes: '',
  };
}

describe('validator', () => {
  it('detecta violação de interjornada quando saída às 22:00 precede entrada às 08:00 (< 11h)', () => {
    const shifts = createSeedShifts();
    const night = shifts.find((s) => s.id === 'shift-wk-12-22')!;
    const morning = shifts.find((s) => s.id === 'shift-wk-08-18')!;
    const mid = shifts.find((s) => s.id === 'shift-wk-10-20')!;

    expect(hasInterjornadaViolation(night, morning)).toEqual({
      violated: true,
      restMinutes: 600,
    });
    expect(hasInterjornadaViolation(night, mid)).toEqual({
      violated: false,
      restMinutes: 720,
    });
  });

  it('sinaliza iniciante em turno noturno, domingo e feriado com expediente, além de folga dom. faltante e indisponibilidade', () => {
    const state = makeState();
    const week: WeekSchedule = {
      weekStart: '2026-11-09',
      note: '',
      swaps: [],
      assignments: {
        beg1: {
          '2026-11-09': { kind: 'SHIFT', shiftId: 'shift-wk-12-22', locked: false },
          '2026-11-12': { kind: 'SHIFT', shiftId: 'shift-sun-08-18', locked: false },
          '2026-11-15': { kind: 'SHIFT', shiftId: 'shift-sun-08-18', locked: false },
        },
        vet1: {
          '2026-11-09': { kind: 'SHIFT', shiftId: 'shift-wk-12-22', locked: false },
          '2026-11-10': { kind: 'SHIFT', shiftId: 'shift-wk-08-18', locked: false },
          '2026-11-15': { kind: 'SHIFT', shiftId: 'shift-sun-08-18', locked: false },
        },
        vet2: {
          '2026-11-11': { kind: 'SHIFT', shiftId: 'shift-wk-08-18', locked: false },
        },
      },
    };

    const issues = validateWeekSchedule({ state, weekStart: '2026-11-09', week });
    const codes = issues.map((i) => i.code);

    expect(codes).toContain('BEGINNER_NIGHT_SHIFT');
    expect(codes).toContain('BEGINNER_HOLIDAY');
    expect(codes).toContain('BEGINNER_SUNDAY');
    expect(codes).toContain('INTERJORNADA');
    expect(codes).toContain('MISSING_SUNDAY_COMP_OFF');
    expect(codes).toContain('UNAVAILABLE_CONFLICT');
  });

  it('sinaliza folga no meio da semana para quem não trabalhou no domingo', () => {
    const state = makeState();
    const week: WeekSchedule = {
      weekStart: '2026-11-09',
      note: '',
      swaps: [],
      assignments: {
        vet2: {
          '2026-11-09': { kind: 'OFF', locked: false },
          '2026-11-15': { kind: 'OFF', locked: false },
        },
      },
    };

    const issues = validateWeekSchedule({ state, weekStart: '2026-11-09', week });
    expect(issues.some((i) => i.code === 'MIDWEEK_OFF_WITHOUT_SUNDAY')).toBe(true);
  });

  it('valida troca de turno em tempo real alertando violação de iniciante e interjornada', () => {
    const state = makeState();
    const week: WeekSchedule = {
      weekStart: '2026-11-09',
      note: '',
      swaps: [],
      assignments: {
        vet1: {
          '2026-11-09': { kind: 'SHIFT', shiftId: 'shift-wk-12-22', locked: false },
        },
        beg1: {
          '2026-11-09': { kind: 'SHIFT', shiftId: 'shift-wk-08-18', locked: false },
        },
      },
    };

    const validation = validateSwap({
      state,
      week,
      dateA: '2026-11-09',
      employeeIdA: 'vet1',
      dateB: '2026-11-09',
      employeeIdB: 'beg1',
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((i) => i.code === 'BEGINNER_NIGHT_SHIFT')).toBe(true);
  });
});
