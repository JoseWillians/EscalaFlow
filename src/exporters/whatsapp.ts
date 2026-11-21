import {
  formatMonthYearPt,
  formatShortDateBr,
  formatWeekRangeBr,
  getWeekDays,
  getWeekReferenceMonthKey,
  getWeekdayFullPt,
  getWeekdayShortPt,
} from '@/domain/dates';
import {
  UNAVAILABILITY_LABELS,
  type AppState,
  type CellAssignment,
  type ShiftTemplate,
} from '@/domain/schemas';

export type WhatsAppGroupBy = 'day' | 'employee';

export function describeCellForText(
  cell: CellAssignment | undefined,
  shiftsById: Map<string, ShiftTemplate>,
  holidayName?: string,
  holidayMode?: 'off_all' | 'special',
): string {
  if (!cell || cell.kind === 'OFF') {
    return 'Folga';
  }
  if (cell.kind === 'COMP_OFF') {
    return 'Folga (Dom.)';
  }
  if (cell.kind === 'HOLIDAY_OFF') {
    return holidayName ? `Feriado (${holidayName})` : 'Feriado (Folga Geral)';
  }
  if (cell.kind === 'UNAVAILABLE') {
    return cell.unavailabilityType
      ? UNAVAILABILITY_LABELS[cell.unavailabilityType]
      : 'Indisponível';
  }
  const shift = cell.shiftId ? shiftsById.get(cell.shiftId) : undefined;
  if (!shift) return 'Turno indefinido';
  const suffix = holidayMode === 'special' && holidayName ? ` [Feriado: ${holidayName}]` : '';
  return `${shift.name}${suffix}`;
}

export function generateWhatsAppText(params: {
  state: AppState;
  weekStart: string;
  groupBy: WhatsAppGroupBy;
  includeNotes?: boolean;
  teamIdFilter?: string;
}): string {
  const { state, weekStart, groupBy, includeNotes = true, teamIdFilter } = params;
  const days = getWeekDays(weekStart);
  const week = state.weeks[weekStart];
  const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));
  const monthLabel = formatMonthYearPt(getWeekReferenceMonthKey(weekStart));

  const targetTeams = state.teams.filter(
    (t) => t.active && (!teamIdFilter || t.id === teamIdFilter),
  );
  const teamsToRender =
    targetTeams.length > 0
      ? targetTeams
      : [{ id: 'all', name: 'Equipe', active: true }];

  const lines: string[] = [
    `*Escala Semanal | ${formatWeekRangeBr(weekStart)}*`,
    `Referência: ${monthLabel}`,
    '────────────────────────',
  ];

  const weekHolidays = days
    .map((date) => ({ date, holiday: state.holidays[date] }))
    .filter((entry): entry is { date: string; holiday: NonNullable<typeof entry.holiday> } =>
      Boolean(entry.holiday),
    );

  if (weekHolidays.length > 0) {
    lines.push('*Feriados da semana:*');
    for (const { date, holiday } of weekHolidays) {
      const modeLabel = holiday.mode === 'off_all' ? 'Folga Geral' : 'Expediente Especial';
      lines.push(
        `- ${getWeekdayShortPt(date)} (${formatShortDateBr(date)}): ${holiday.name || 'Feriado'} (${modeLabel})`,
      );
    }
    lines.push('');
  }

  for (const team of teamsToRender) {
    const teamEmployees = state.employees.filter(
      (e) => e.active && (team.id === 'all' || e.teamId === team.id),
    );
    if (teamEmployees.length === 0) continue;

    if (teamsToRender.length > 1 || team.id !== 'all') {
      lines.push(`*[${team.name}]*`);
    }

    if (groupBy === 'day') {
      for (const date of days) {
        const holiday = state.holidays[date];
        const headerHoliday = holiday ? ` - ${holiday.name || 'Feriado'}` : '';
        lines.push(`*${getWeekdayFullPt(date)} (${formatShortDateBr(date)})*${headerHoliday}`);

        if (holiday?.mode === 'off_all') {
          lines.push('  Folga Geral para toda a equipe.');
        } else {
          for (const emp of teamEmployees) {
            const cell = week?.assignments[emp.id]?.[date];
            const label = describeCellForText(cell, shiftsById, holiday?.name, holiday?.mode);
            lines.push(`  - ${emp.name}: *${label}*`);
          }
        }
        lines.push('');
      }
    } else {
      for (const emp of teamEmployees) {
        const rolePart = emp.role ? ` - ${emp.role}` : '';
        const tag = emp.isBeginner ? ' (Iniciante)' : '';
        lines.push(`*${emp.name}*${rolePart}${tag}`);
        for (const date of days) {
          const holiday = state.holidays[date];
          const cell = week?.assignments[emp.id]?.[date];
          const label = describeCellForText(cell, shiftsById, holiday?.name, holiday?.mode);
          lines.push(`  - ${getWeekdayShortPt(date)} ${formatShortDateBr(date)}: ${label}`);
        }
        lines.push('');
      }
    }
  }

  if (includeNotes) {
    const weekNote = week?.note?.trim();
    const pinned = state.pinnedNotes.trim();
    if (weekNote) {
      lines.push('────────────────────────');
      lines.push('*Observações da semana:*');
      lines.push(weekNote);
    }
    if (pinned) {
      lines.push('');
      lines.push('*Notas gerais:*');
      lines.push(pinned);
    }
  }

  return lines.join('\n').trim();
}
