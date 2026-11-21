import { getTodayIsoDate, getWeekStartMonday } from './dates';
import type { AppState, Employee, ShiftTemplate, Team } from './schemas';

export function createSeedShifts(): ShiftTemplate[] {
  return [
    {
      id: 'shift-wk-08-18',
      name: '08:00 às 18:00',
      color: '#DBEAFE',
      applicableDays: ['weekday'],
      startTime: '08:00',
      breakDurationMinutes: 120,
      breakWindow: '12:00–14:00',
      endTime: '18:00',
      isNightShift: false,
      targetHeadcount: 2,
      active: true,
    },
    {
      id: 'shift-wk-10-20',
      name: '10:00 às 20:00',
      color: '#E0E7FF',
      applicableDays: ['weekday'],
      startTime: '10:00',
      breakDurationMinutes: 120,
      breakWindow: '13:00–15:00',
      endTime: '20:00',
      isNightShift: false,
      targetHeadcount: 1,
      active: true,
    },
    {
      id: 'shift-wk-12-22',
      name: '12:00 às 22:00',
      color: '#FEF3C7',
      applicableDays: ['weekday'],
      startTime: '12:00',
      breakDurationMinutes: 120,
      breakWindow: '15:00–17:00',
      endTime: '22:00',
      isNightShift: true,
      targetHeadcount: 1,
      active: true,
    },
    {
      id: 'shift-sat-08-12',
      name: '08:00 às 12:00',
      color: '#D1FAE5',
      applicableDays: ['saturday'],
      startTime: '08:00',
      breakDurationMinutes: 0,
      endTime: '12:00',
      isNightShift: false,
      targetHeadcount: 1,
      active: true,
    },
    {
      id: 'shift-sat-10-14',
      name: '10:00 às 14:00',
      color: '#CCFBF1',
      applicableDays: ['saturday'],
      startTime: '10:00',
      breakDurationMinutes: 0,
      endTime: '14:00',
      isNightShift: false,
      targetHeadcount: 1,
      active: true,
    },
    {
      id: 'shift-sat-14-18',
      name: '14:00 às 18:00',
      color: '#E0F2FE',
      applicableDays: ['saturday'],
      startTime: '14:00',
      breakDurationMinutes: 0,
      endTime: '18:00',
      isNightShift: false,
      targetHeadcount: 1,
      active: true,
    },
    {
      id: 'shift-sat-16-20',
      name: '16:00 às 20:00',
      color: '#FCE7F3',
      applicableDays: ['saturday'],
      startTime: '16:00',
      breakDurationMinutes: 0,
      endTime: '20:00',
      isNightShift: false,
      targetHeadcount: 1,
      active: true,
    },
    {
      id: 'shift-sun-08-18',
      name: '08:00 às 18:00 (Dom)',
      color: '#FFEDD5',
      applicableDays: ['sunday'],
      startTime: '08:00',
      breakDurationMinutes: 0,
      endTime: '18:00',
      isNightShift: false,
      targetHeadcount: 2,
      active: true,
    },
  ];
}

export function createSampleTeams(): Team[] {
  return [
    {
      id: 'team-atendimento',
      name: 'Equipe Atendimento',
      description: 'Atendimento presencial e canais digitais',
      active: true,
    },
    {
      id: 'team-suporte',
      name: 'Equipe Suporte',
      description: 'Suporte técnico e operações',
      active: true,
    },
  ];
}

export function createSampleEmployees(): Employee[] {
  return [
    {
      id: 'emp-camila',
      name: 'Camila Ferreira',
      teamId: 'team-atendimento',
      role: 'Atendimento Pleno',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-bruno',
      name: 'Bruno Almeida',
      teamId: 'team-atendimento',
      role: 'Atendimento Sênior',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-patricia',
      name: 'Patrícia Lima',
      teamId: 'team-atendimento',
      role: 'Líder de Turno',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-diego',
      name: 'Diego Carvalho',
      teamId: 'team-atendimento',
      role: 'Atendimento Pleno',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-juliana',
      name: 'Juliana Costa',
      teamId: 'team-atendimento',
      role: 'Atendimento Júnior',
      isBeginner: true,
      active: true,
    },
    {
      id: 'emp-rafael',
      name: 'Rafael Mendes',
      teamId: 'team-suporte',
      role: 'Suporte N1',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-larissa',
      name: 'Larissa Souza',
      teamId: 'team-suporte',
      role: 'Operações',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-thiago',
      name: 'Thiago Ribeiro',
      teamId: 'team-suporte',
      role: 'Suporte N2',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-fernanda',
      name: 'Fernanda Rocha',
      teamId: 'team-suporte',
      role: 'Suporte N1',
      isBeginner: false,
      active: true,
    },
    {
      id: 'emp-lucas',
      name: 'Lucas Barbosa',
      teamId: 'team-suporte',
      role: 'Suporte Júnior',
      isBeginner: true,
      active: true,
    },
  ];
}

export function createInitialEmptyState(): AppState {
  return {
    version: 1,
    sundayCompMode: 'same_week',
    teams: [],
    shifts: createSeedShifts(),
    employees: [],
    unavailabilities: [],
    holidays: {},
    weeks: {},
    pinnedNotes: '',
  };
}

export function createSampleState(referenceDate: string = getTodayIsoDate()): AppState {
  const weekStart = getWeekStartMonday(referenceDate);
  return {
    version: 1,
    sundayCompMode: 'same_week',
    teams: createSampleTeams(),
    shifts: createSeedShifts(),
    employees: createSampleEmployees(),
    unavailabilities: [],
    holidays: {},
    weeks: {
      [weekStart]: {
        weekStart,
        assignments: {},
        note: 'Equipes exemplo carregadas. Aos domingos escalam 2 colaboradores por equipe (08h às 18h) com folga compensatória na semana.',
        swaps: [],
      },
    },
    pinnedNotes:
      'Regra operacional: iniciantes não atuam em fechamento (12:00–22:00), domingos ou feriados com expediente. Apenas quem trabalha no domingo folga no meio da semana.',
  };
}
