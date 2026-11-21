import { formatShortDateBr, getWeekDays, getWeekdayShortPt } from '@/domain/dates';
import type { AppState, WeekSchedule } from '@/domain/schemas';
import { getApplicableShiftsForDate } from '@/engine/validator';
import { Badge } from '@/components/ui/badge';

export interface GridByShiftProps {
  state: AppState;
  week: WeekSchedule;
  teamIdFilter?: string;
}

export function GridByShift({ state, week, teamIdFilter }: GridByShiftProps) {
  const days = getWeekDays(week.weekStart);
  const activeEmployees = state.employees.filter(
    (e) => e.active && (!teamIdFilter || e.teamId === teamIdFilter),
  );
  const teamsById = new Map(state.teams.map((t) => [t.id, t]));
  const activeShifts = state.shifts.filter((s) => s.active);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white" data-testid="grid-by-shift">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80 text-xs text-slate-700">
            <th className="sticky left-0 z-10 w-52 border-r border-slate-200 bg-slate-100 px-3 py-2.5 font-semibold">
              Turno / Faixa Horária
            </th>
            {days.map((date) => (
              <th key={date} className="min-w-[120px] px-2 py-2.5 text-center font-semibold">
                {getWeekdayShortPt(date)} ·{' '}
                <span className="font-mono tabular-nums">{formatShortDateBr(date)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {activeShifts.map((shift) => (
            <tr key={shift.id}>
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2.5 align-top">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-slate-300"
                    style={{ backgroundColor: shift.color }}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{shift.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Meta: {shift.targetHeadcount} pessoa(s)/equipe
                      {shift.isNightShift ? ' · Noturno' : ''}
                    </p>
                  </div>
                </div>
              </td>
              {days.map((date) => {
                const applicable = getApplicableShiftsForDate(state, date).some(
                  (s) => s.id === shift.id,
                );
                const assigned = activeEmployees.filter((emp) => {
                  const cell = week.assignments[emp.id]?.[date];
                  return cell?.kind === 'SHIFT' && cell.shiftId === shift.id;
                });

                return (
                  <td key={date} className="p-2 align-top">
                    {!applicable && assigned.length === 0 ? (
                      <span className="text-[11px] text-slate-300">-</span>
                    ) : (
                      <div className="space-y-1">
                        {assigned.map((emp) => {
                          const teamName = teamsById.get(emp.teamId)?.name;
                          return (
                            <div
                              key={emp.id}
                              style={{ backgroundColor: shift.color }}
                              className="flex items-center justify-between gap-1 rounded border border-slate-300/70 px-2 py-1 text-slate-900"
                              title={teamName ? `${emp.name} (${teamName})` : emp.name}
                            >
                              <span className="truncate font-medium">
                                {emp.name}
                                {!teamIdFilter && teamName ? (
                                  <span className="ml-1 text-[10px] font-normal text-slate-600">
                                    ({teamName.replace(/^Equipe\s+/i, '')})
                                  </span>
                                ) : null}
                              </span>
                              {emp.isBeginner && <Badge tone="beginner">Ini.</Badge>}
                            </div>
                          );
                        })}
                        {applicable && assigned.length < shift.targetHeadcount && (
                          <p className="text-[10px] font-medium text-amber-700">
                            {assigned.length}/{shift.targetHeadcount} alocado(s)
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          <tr className="bg-slate-50/70">
            <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-700">
              Folgas e Indisponibilidades
            </td>
            {days.map((date) => {
              const offEmployees = activeEmployees.filter((emp) => {
                const cell = week.assignments[emp.id]?.[date];
                return !cell || cell.kind !== 'SHIFT';
              });
              return (
                <td key={date} className="p-2 align-top">
                  <div className="flex flex-wrap gap-1">
                    {offEmployees.map((emp) => {
                      const cell = week.assignments[emp.id]?.[date];
                      const suffix =
                        cell?.kind === 'COMP_OFF'
                          ? ' (Dom.)'
                          : cell?.kind === 'HOLIDAY_OFF'
                            ? ' (Fer.)'
                            : cell?.kind === 'UNAVAILABLE'
                              ? ' (Ind.)'
                              : '';
                      return (
                        <span
                          key={emp.id}
                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
                        >
                          {emp.name.split(' ')[0]}
                          {suffix}
                        </span>
                      );
                    })}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
