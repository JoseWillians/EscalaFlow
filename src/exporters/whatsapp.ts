import {
  formatFullDateBr,
  formatShortDateBr,
  getDayOfWeek,
  getWeekDays,
  getWeekdayFullPt,
  getWeekdayShortPt,
} from '@/domain/dates';
import {
  UNAVAILABILITY_LABELS,
  type AppState,
  type CellAssignment,
  type Employee,
  type ShiftTemplate,
} from '@/domain/schemas';

export type WhatsAppGroupBy = 'day' | 'employee';

const WEEKDAY_UPPER_PT = [
  'DOMINGO',
  'SEGUNDA',
  'TERÇA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SÁBADO',
];

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

function formatShiftInterval(shift: ShiftTemplate): string {
  if (shift.breakWindow && shift.breakWindow.trim().length > 0) {
    return shift.breakWindow.trim();
  }
  if (shift.breakDurationMinutes > 0) {
    return `${shift.breakDurationMinutes}min`;
  }
  return '-';
}

function formatAgentNameWithNote(emp: Employee, cell: CellAssignment): string {
  const note = cell.note?.trim();
  if (!note) return emp.name;
  return note.startsWith('↪') ? `${emp.name} ${note}` : `${emp.name} ↪️ ${note}`;
}

export function generateWhatsAppText(params: {
  state: AppState;
  weekStart: string;
  groupBy: WhatsAppGroupBy;
  includeNotes?: boolean;
  teamIdFilter?: string;
}): string {
  const { state, weekStart, groupBy, includeNotes = false, teamIdFilter } = params;
  const days = getWeekDays(weekStart);
  const weekEnd = days[6];
  const week = state.weeks[weekStart];
  const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));

  const targetTeams = state.teams.filter(
    (t) => t.active && (!teamIdFilter || t.id === teamIdFilter),
  );
  const teamsToRender =
    targetTeams.length > 0
      ? targetTeams
      : [{ id: 'all', name: 'Equipe', active: true }];

  const sections: string[] = [];

  for (const team of teamsToRender) {
    const teamEmployees = state.employees.filter(
      (e) => e.active && (team.id === 'all' || e.teamId === team.id),
    );
    if (teamEmployees.length === 0) continue;

    const headerTitle =
      team.id === 'all' ? 'ESCALA DA EQUIPE' : `ESCALA ${team.name.toUpperCase()}`;

    const lines: string[] = [
      `📡 *${headerTitle}*`,
      `📆 *${formatFullDateBr(weekStart)} a ${formatFullDateBr(weekEnd)}*`,
      '',
    ];

    if (groupBy === 'day') {
      for (const date of days) {
        const dow = getDayOfWeek(date);
        const holiday = state.holidays[date];
        const holidayTag = holiday
          ? ` — ${(holiday.name || 'FERIADO').toUpperCase()}`
          : '';
        const dateBr = formatFullDateBr(date);

        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (dow === 6) {
          lines.push(`📋 *SÁBADO — ${dateBr}*${holidayTag}`);
        } else if (dow === 0) {
          lines.push(`🌙 *DOMINGO — PLANTÃO — ${dateBr}*${holidayTag}`);
        } else {
          lines.push(`📅 *${WEEKDAY_UPPER_PT[dow]} — ${dateBr}*${holidayTag}`);
        }
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (holiday?.mode === 'off_all') {
          lines.push(`🏖️ *Folga Geral* (${holiday.name || 'Feriado'})`);
          lines.push('');
          continue;
        }

        const workingEntries: Array<{
          emp: Employee;
          cell: CellAssignment;
          shift: ShiftTemplate;
        }> = [];
        const offNames: string[] = [];
        const unavailableNames: string[] = [];

        for (const emp of teamEmployees) {
          const cell = week?.assignments[emp.id]?.[date];
          if (cell?.kind === 'SHIFT' && cell.shiftId) {
            const shift = shiftsById.get(cell.shiftId);
            if (shift) {
              workingEntries.push({ emp, cell, shift });
            }
          } else if (cell?.kind === 'UNAVAILABLE') {
            const reason = cell.unavailabilityType
              ? UNAVAILABILITY_LABELS[cell.unavailabilityType]
              : 'Indisponível';
            unavailableNames.push(`${emp.name} (${reason})`);
          } else if (cell?.kind === 'COMP_OFF' || (dow !== 0 && (!cell || cell.kind === 'OFF'))) {
            offNames.push(emp.name);
          }
        }

        workingEntries.sort((a, b) => {
          const startCmp = a.shift.startTime.localeCompare(b.shift.startTime);
          if (startCmp !== 0) return startCmp;
          const endCmp = a.shift.endTime.localeCompare(b.shift.endTime);
          if (endCmp !== 0) return endCmp;
          return a.emp.name.localeCompare(b.emp.name);
        });

        if (dow >= 1 && dow <= 5) {
          lines.push('```');
          lines.push('HORÁRIO         INTERVALO   AGENTE');
          lines.push('──────────────────────────────────────────');
          if (workingEntries.length === 0) {
            lines.push('Sem turnos alocados neste dia');
          } else {
            for (const { emp, cell, shift } of workingEntries) {
              const hourCol = `${shift.startTime}–${shift.endTime}`.padEnd(16, ' ');
              const breakCol = formatShiftInterval(shift).padEnd(12, ' ');
              lines.push(`${hourCol}${breakCol}${formatAgentNameWithNote(emp, cell)}`);
            }
          }
          lines.push('```');
        } else if (dow === 6) {
          lines.push('```');
          lines.push('HORÁRIO         AGENTE');
          lines.push('──────────────────────────────');
          if (workingEntries.length === 0) {
            lines.push('Sem turnos alocados neste dia');
          } else {
            const byShift = new Map<string, { label: string; agents: string[] }>();
            for (const { emp, cell, shift } of workingEntries) {
              const label = `${shift.startTime}–${shift.endTime}`;
              const current = byShift.get(shift.id) ?? { label, agents: [] };
              current.agents.push(formatAgentNameWithNote(emp, cell));
              byShift.set(shift.id, current);
            }
            for (const group of byShift.values()) {
              lines.push(`${group.label.padEnd(16, ' ')}${group.agents.join(', ')}`);
            }
          }
          lines.push('```');
        } else {
          lines.push('```');
          lines.push('HORÁRIO         AGENTE');
          lines.push('──────────────────────────────');
          if (workingEntries.length === 0) {
            lines.push('Sem plantão programado');
          } else {
            for (const { emp, cell, shift } of workingEntries) {
              const hourCol = `${shift.startTime}–${shift.endTime}`.padEnd(16, ' ');
              lines.push(`${hourCol}${formatAgentNameWithNote(emp, cell)}`);
            }
          }
          lines.push('```');
        }

        if (offNames.length > 0) {
          lines.push(`🌙 *Folga:* ${offNames.join(', ')}`);
        }
        if (unavailableNames.length > 0) {
          lines.push(`📌 *Ausência:* ${unavailableNames.join(', ')}`);
        }
        lines.push('');
      }
    } else {
      for (const emp of teamEmployees) {
        const rolePart = emp.role ? ` (${emp.role})` : '';
        lines.push(`👤 *${emp.name}*${rolePart}`);
        lines.push('```');
        for (const date of days) {
          const holiday = state.holidays[date];
          const cell = week?.assignments[emp.id]?.[date];
          const label = describeCellForText(cell, shiftsById, holiday?.name, holiday?.mode);
          const noteSuffix = cell?.note?.trim() ? ` ↪️ ${cell.note.trim()}` : '';
          const dayCol = `${getWeekdayShortPt(date)} ${formatShortDateBr(date)}`.padEnd(11, ' ');
          lines.push(`${dayCol}${label}${noteSuffix}`);
        }
        lines.push('```');
        lines.push('');
      }
    }

    sections.push(lines.join('\n').trim());
  }

  if (includeNotes) {
    const weekNote = week?.note?.trim();
    const pinned = state.pinnedNotes.trim();
    const noteLines: string[] = [];
    if (weekNote) {
      noteLines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
      noteLines.push(`📝 *Observações:* ${weekNote}`);
    }
    if (pinned) {
      noteLines.push(`📌 *Notas gerais:* ${pinned}`);
    }
    if (noteLines.length > 0) {
      sections.push(noteLines.join('\n'));
    }
  }

  // Fallback para modo por dia mantendo referência completa quando texto estiver vazio
  if (sections.length === 0) {
    return `📡 *ESCALA*\n📆 *${formatFullDateBr(weekStart)} a ${formatFullDateBr(weekEnd)}*\n\nNenhum colaborador ativo encontrado.\n(${getWeekdayFullPt(weekStart)})`;
  }

  return sections.join('\n\n').trim();
}
