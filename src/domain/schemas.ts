import { z } from 'zod';

export const DayCategorySchema = z.enum(['weekday', 'saturday', 'sunday', 'holiday']);
export type DayCategory = z.infer<typeof DayCategorySchema>;

export const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de horário inválido (use HH:mm)');

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (use YYYY-MM-DD)');

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Informe o nome da equipe'),
  description: z.string().optional(),
  active: z.boolean().default(true),
});
export type Team = z.infer<typeof TeamSchema>;

export const ShiftTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Informe o nome do turno'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor hexadecimal inválida'),
  applicableDays: z.array(DayCategorySchema).min(1, 'Selecione ao menos um dia aplicável'),
  startTime: TimeStringSchema,
  breakDurationMinutes: z.number().int().min(0).max(360),
  breakWindow: z.string().optional(),
  endTime: TimeStringSchema,
  isNightShift: z.boolean().default(false),
  targetHeadcount: z.number().int().min(1).max(50).default(1),
  active: z.boolean().default(true),
});
export type ShiftTemplate = z.infer<typeof ShiftTemplateSchema>;

export const UnavailabilityTypeSchema = z.enum(['VACATION', 'SICK_LEAVE', 'PRE_OFF']);
export type UnavailabilityType = z.infer<typeof UnavailabilityTypeSchema>;

export const UnavailabilitySchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  type: UnavailabilityTypeSchema,
  note: z.string().optional(),
});
export type Unavailability = z.infer<typeof UnavailabilitySchema>;

export const EmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Informe o nome do colaborador'),
  teamId: z.string().min(1).default('team-default'),
  role: z.string().optional(),
  isBeginner: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type Employee = z.infer<typeof EmployeeSchema>;

export const HolidayModeSchema = z.enum(['off_all', 'special']);
export type HolidayMode = z.infer<typeof HolidayModeSchema>;

export const HolidaySchema = z.object({
  date: IsoDateSchema,
  name: z.string().default('Feriado'),
  mode: HolidayModeSchema.default('off_all'),
  shiftIds: z.array(z.string()).default([]),
});
export type Holiday = z.infer<typeof HolidaySchema>;

export const CellKindSchema = z.enum([
  'SHIFT',
  'OFF',
  'COMP_OFF',
  'HOLIDAY_OFF',
  'UNAVAILABLE',
]);
export type CellKind = z.infer<typeof CellKindSchema>;

export const CellAssignmentSchema = z.object({
  kind: CellKindSchema,
  shiftId: z.string().optional(),
  locked: z.boolean().default(false),
  unavailabilityType: UnavailabilityTypeSchema.optional(),
  note: z.string().optional(),
});
export type CellAssignment = z.infer<typeof CellAssignmentSchema>;

export const SwapRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  dateA: IsoDateSchema,
  employeeIdA: z.string().min(1),
  dateB: IsoDateSchema,
  employeeIdB: z.string().min(1),
  summary: z.string().min(1),
  reason: z.string().default(''),
  hadWarnings: z.boolean().default(false),
  approvedException: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
});
export type SwapRecord = z.infer<typeof SwapRecordSchema>;

export const WeekScheduleSchema = z.object({
  weekStart: IsoDateSchema,
  assignments: z.record(z.string(), z.record(z.string(), CellAssignmentSchema)),
  note: z.string().default(''),
  swaps: z.array(SwapRecordSchema).default([]),
});
export type WeekSchedule = z.infer<typeof WeekScheduleSchema>;

export const SundayCompModeSchema = z.enum(['same_week', 'next_week']);
export type SundayCompMode = z.infer<typeof SundayCompModeSchema>;

export const ScheduleRulesSchema = z.object({
  enforceBeginnerRestrictions: z.boolean().default(true),
  enforceSundayCompOff: z.boolean().default(true),
  noMidweekOffWithoutSunday: z.boolean().default(true),
  enforceNightShiftMonthlyRotation: z.boolean().default(true),
  avoidConsecutiveSundays: z.boolean().default(true),
  warnInterjornadaUnder11h: z.boolean().default(true),
  sundayStaffCount: z.number().int().min(0).max(50).default(2),
  selectedShiftIdsForGeneration: z.array(z.string()).default([]),
});
export type ScheduleRules = z.infer<typeof ScheduleRulesSchema>;

export const DEFAULT_SCHEDULE_RULES: ScheduleRules = {
  enforceBeginnerRestrictions: true,
  enforceSundayCompOff: true,
  noMidweekOffWithoutSunday: true,
  enforceNightShiftMonthlyRotation: true,
  avoidConsecutiveSundays: true,
  warnInterjornadaUnder11h: true,
  sundayStaffCount: 2,
  selectedShiftIdsForGeneration: [],
};

export const AppStateSchema = z.object({
  version: z.literal(1),
  sundayCompMode: SundayCompModeSchema.default('same_week'),
  scheduleRules: ScheduleRulesSchema.default(DEFAULT_SCHEDULE_RULES),
  teams: z.array(TeamSchema).default([]),
  shifts: z.array(ShiftTemplateSchema),
  employees: z.array(EmployeeSchema),
  unavailabilities: z.array(UnavailabilitySchema).default([]),
  holidays: z.record(z.string(), HolidaySchema).default({}),
  weeks: z.record(z.string(), WeekScheduleSchema).default({}),
  pinnedNotes: z.string().default(''),
});
export type AppState = z.infer<typeof AppStateSchema>;

export const UNAVAILABILITY_LABELS: Record<UnavailabilityType, string> = {
  VACATION: 'Férias',
  SICK_LEAVE: 'Atestado',
  PRE_OFF: 'Folga combinada',
};
