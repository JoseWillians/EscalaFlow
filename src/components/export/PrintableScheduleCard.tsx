import { Fragment, forwardRef } from 'react';
import {
  formatMonthYearPt,
  formatShortDateBr,
  formatWeekRangeBr,
  getWeekDays,
  getWeekReferenceMonthKey,
  getWeekdayShortPt,
} from '@/domain/dates';
import {
  UNAVAILABILITY_LABELS,
  type AppState,
  type CellAssignment,
  type ShiftTemplate,
  type WeekSchedule,
} from '@/domain/schemas';

export interface PrintableScheduleCardProps {
  state: AppState;
  weekStart: string;
  week: WeekSchedule;
  teamIdFilter?: string;
}

function getPrintCellStyle(
  cell: CellAssignment | undefined,
  shiftsById: Map<string, ShiftTemplate>,
): { text: string; sub?: string; bg: string; fg: string; border: string } {
  if (!cell || cell.kind === 'OFF') {
    return {
      text: 'Folga',
      bg: '#F8FAFC',
      fg: '#64748B',
      border: '#E2E8F0',
    };
  }
  if (cell.kind === 'COMP_OFF') {
    return {
      text: 'Folga (Dom.)',
      bg: '#CCFBF1',
      fg: '#115E59',
      border: '#99F6E4',
    };
  }
  if (cell.kind === 'HOLIDAY_OFF') {
    return {
      text: 'Feriado',
      sub: 'Folga Geral',
      bg: '#FFE4E6',
      fg: '#9F1239',
      border: '#FECDD3',
    };
  }
  if (cell.kind === 'UNAVAILABLE') {
    return {
      text: cell.unavailabilityType
        ? UNAVAILABILITY_LABELS[cell.unavailabilityType]
        : 'Indisponível',
      bg: '#FEF9C3',
      fg: '#854D0E',
      border: '#FDE047',
    };
  }
  const shift = cell.shiftId ? shiftsById.get(cell.shiftId) : undefined;
  if (!shift) {
    return {
      text: 'Turno',
      bg: '#F1F5F9',
      fg: '#0F172A',
      border: '#CBD5E1',
    };
  }
  return {
    text: `${shift.startTime}–${shift.endTime}`,
    sub: shift.breakDurationMinutes > 0 ? `Int. ${shift.breakDurationMinutes}m` : 'Direto',
    bg: shift.color,
    fg: '#0F172A',
    border: '#CBD5E1',
  };
}

export const PrintableScheduleCard = forwardRef<HTMLDivElement, PrintableScheduleCardProps>(
  ({ state, weekStart, week, teamIdFilter }, ref) => {
    const days = getWeekDays(weekStart);
    const activeShifts = state.shifts.filter((s) => s.active);
    const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));
    const holidays = days
      .map((d) => ({ d, h: state.holidays[d] }))
      .filter((item): item is { d: string; h: NonNullable<typeof item.h> } => Boolean(item.h));

    const activeTeams = state.teams.filter(
      (t) => t.active && (!teamIdFilter || t.id === teamIdFilter),
    );
    const sections =
      activeTeams.length > 0
        ? activeTeams
            .map((t) => ({
              id: t.id,
              name: t.name,
              employees: state.employees.filter((e) => e.active && e.teamId === t.id),
            }))
            .filter((s) => s.employees.length > 0)
        : [
            {
              id: 'default',
              name: 'Equipe',
              employees: state.employees.filter((e) => e.active),
            },
          ];

    return (
      <div
        ref={ref}
        style={{ backgroundColor: '#FFFFFF', color: '#0F172A' }}
        className="w-[960px] rounded-xl border border-slate-200 p-6 font-sans"
        data-testid="printable-schedule-card"
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              EscalaFlow · Escala Semanal
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">
              Semana de {formatWeekRangeBr(weekStart)}
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              {formatMonthYearPt(getWeekReferenceMonthKey(weekStart))}
            </p>
          </div>
          {holidays.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <p className="font-semibold">Feriados na semana</p>
              {holidays.map(({ d, h }) => (
                <p key={d} className="mt-0.5">
                  {formatShortDateBr(d)}: {h.name || 'Feriado'} (
                  {h.mode === 'off_all' ? 'Folga Geral' : 'Expediente Especial'})
                </p>
              ))}
            </div>
          )}
        </div>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-44 border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-800">
                Colaborador
              </th>
              {days.map((date) => {
                const holiday = state.holidays[date];
                return (
                  <th
                    key={date}
                    className="border border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-800"
                  >
                    <div>{getWeekdayShortPt(date)}</div>
                    <div className="font-mono text-[11px] font-normal text-slate-600">
                      {formatShortDateBr(date)}
                    </div>
                    {holiday && (
                      <div className="mt-0.5 text-[10px] font-semibold text-rose-700">
                        {holiday.name || 'Feriado'}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.id}>
                <tr>
                  <td
                    colSpan={8}
                    className="border border-slate-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-bold text-blue-900"
                  >
                    {section.name}
                  </td>
                </tr>
                {section.employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="border border-slate-200 bg-slate-50/70 px-3 py-2.5 font-semibold text-slate-900">
                      <div>{emp.name}</div>
                      {emp.role && (
                        <div className="text-[10px] font-normal text-slate-500">{emp.role}</div>
                      )}
                      {emp.isBeginner && (
                        <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                          Iniciante
                        </span>
                      )}
                    </td>
                    {days.map((date) => {
                      const visual = getPrintCellStyle(week.assignments[emp.id]?.[date], shiftsById);
                      return (
                        <td
                          key={date}
                          style={{
                            backgroundColor: visual.bg,
                            color: visual.fg,
                            borderColor: visual.border,
                          }}
                          className="border px-2 py-2 text-center align-middle"
                        >
                          <div className="font-mono text-[11px] font-semibold">{visual.text}</div>
                          {visual.sub && (
                            <div className="mt-0.5 text-[10px] opacity-80">{visual.sub}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-800">Legenda:</span>
            {activeShifts.map((shift) => (
              <span key={shift.id} className="inline-flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: shift.color }}
                  className="inline-block h-3 w-3 rounded border border-slate-300"
                />
                <span>{shift.name}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-teal-300 bg-teal-100" />
              <span>Folga (Dom.)</span>
            </span>
          </div>
        </div>

        {week.note?.trim() && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <strong>Observações:</strong> {week.note.trim()}
          </div>
        )}
      </div>
    );
  },
);
PrintableScheduleCard.displayName = 'PrintableScheduleCard';
