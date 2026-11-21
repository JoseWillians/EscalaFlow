import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Layers, Lock, Unlock } from 'lucide-react';
import { formatShortDateBr, getWeekDays, getWeekdayShortPt } from '@/domain/dates';
import {
  UNAVAILABILITY_LABELS,
  type AppState,
  type CellAssignment,
  type Employee,
  type ShiftTemplate,
  type WeekSchedule,
} from '@/domain/schemas';
import { getApplicableShiftsForDate, type ScheduleIssue } from '@/engine/validator';
import { Badge } from '@/components/ui/badge';
import { CellEditPopover } from './CellEditPopover';

export interface GridByEmployeeProps {
  state: AppState;
  week: WeekSchedule;
  issues: ScheduleIssue[];
  teamIdFilter?: string;
  onCellChange: (employeeId: string, date: string, nextCell: CellAssignment) => void;
  onDragSwapRequest: (
    employeeIdA: string,
    dateA: string,
    employeeIdB: string,
    dateB: string,
  ) => void;
}

interface CellVisualInfo {
  title: string;
  subtitle?: string;
  bgColor?: string;
  className: string;
}

function resolveCellVisual(
  cell: CellAssignment | undefined,
  shiftsById: Map<string, ShiftTemplate>,
  holidayName?: string,
): CellVisualInfo {
  if (!cell || cell.kind === 'OFF') {
    return {
      title: 'Folga',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }
  if (cell.kind === 'COMP_OFF') {
    return {
      title: 'Folga (Dom.)',
      className: 'border-teal-200 bg-teal-50 text-teal-900 font-medium',
    };
  }
  if (cell.kind === 'HOLIDAY_OFF') {
    return {
      title: 'Feriado',
      subtitle: holidayName || 'Folga Geral',
      className: 'border-rose-200 bg-rose-50 text-rose-900 font-medium',
    };
  }
  if (cell.kind === 'UNAVAILABLE') {
    return {
      title: cell.unavailabilityType
        ? UNAVAILABILITY_LABELS[cell.unavailabilityType]
        : 'Indisponível',
      className: 'border-amber-200 bg-amber-50/70 text-amber-900 font-medium',
    };
  }
  const shift = cell.shiftId ? shiftsById.get(cell.shiftId) : undefined;
  if (!shift) {
    return {
      title: 'Turno',
      className: 'border-slate-200 bg-slate-100 text-slate-800',
    };
  }
  const breakText =
    shift.breakDurationMinutes > 0
      ? shift.breakWindow
        ? `Int. ${shift.breakWindow}`
        : `Int. ${shift.breakDurationMinutes}m`
      : 'Sem intervalo';
  return {
    title: shift.name,
    subtitle: breakText,
    bgColor: shift.color,
    className: 'border-slate-300/80 text-slate-900 font-medium',
  };
}

interface DraggableCellProps {
  id: string;
  employee: Employee;
  date: string;
  cell: CellAssignment | undefined;
  visual: CellVisualInfo;
  hasIssue: boolean;
  issueMessage?: string;
  applicableShifts: ShiftTemplate[];
  allActiveShifts: ShiftTemplate[];
  onCellChange: (nextCell: CellAssignment) => void;
}

function ScheduleCell({
  id,
  employee,
  date,
  cell,
  visual,
  hasIssue,
  issueMessage,
  applicableShifts,
  allActiveShifts,
  onCellChange,
}: DraggableCellProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });

  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: visual.bgColor,
  };

  const locked = Boolean(cell?.locked);

  const toggleLockQuick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCellChange({
      ...(cell ?? { kind: 'OFF' }),
      locked: !locked,
    });
  };

  return (
    <CellEditPopover
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      employee={employee}
      date={date}
      cell={cell}
      applicableShifts={applicableShifts}
      allActiveShifts={allActiveShifts}
      onSelectCell={onCellChange}
      trigger={
        <div
          ref={setRefs}
          style={style}
          {...attributes}
          {...listeners}
          onClick={() => setPopoverOpen(true)}
          role="button"
          tabIndex={0}
          aria-label={`${employee.name} em ${formatShortDateBr(date)}: ${visual.title}`}
          data-testid={`cell-${employee.id}-${date}`}
          className={`group relative flex min-h-[62px] flex-col justify-between rounded-md border p-2 text-left text-xs transition-all select-none ${
            visual.className
          } ${isDragging ? 'opacity-40' : ''} ${
            isOver ? 'ring-2 ring-blue-600 ring-offset-1' : ''
          } ${hasIssue ? 'ring-2 ring-red-500/80' : ''}`}
        >
          <div className="flex items-start justify-between gap-1">
            <span className="leading-tight font-mono text-[11px] tabular-nums">{visual.title}</span>
            <button
              type="button"
              onClick={toggleLockQuick}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={locked ? 'Destravar célula' : 'Travar célula'}
              title={locked ? 'Célula travada (preservada ao gerar)' : 'Travar célula'}
              className={`rounded p-0.5 transition-opacity ${
                locked
                  ? 'bg-slate-900/10 text-slate-800 opacity-100'
                  : 'text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-900/10 hover:text-slate-700'
              }`}
            >
              {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>
          </div>

          <div className="mt-1 flex items-center justify-between gap-1">
            {visual.subtitle ? (
              <span className="truncate text-[10px] text-slate-600">{visual.subtitle}</span>
            ) : (
              <span />
            )}
            {hasIssue && (
              <span title={issueMessage} className="text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      }
    />
  );
}

export function GridByEmployee({
  state,
  week,
  issues,
  teamIdFilter,
  onCellChange,
  onDragSwapRequest,
}: GridByEmployeeProps) {
  const days = useMemo(() => getWeekDays(week.weekStart), [week.weekStart]);
  const shiftsById = useMemo(
    () => new Map(state.shifts.map((s) => [s.id, s])),
    [state.shifts],
  );
  const allActiveShifts = useMemo(
    () => state.shifts.filter((s) => s.active),
    [state.shifts],
  );

  const teamSections = useMemo(() => {
    const activeTeams = state.teams.filter(
      (t) => t.active && (!teamIdFilter || t.id === teamIdFilter),
    );
    if (activeTeams.length === 0) {
      const emps = state.employees.filter((e) => e.active);
      return emps.length > 0 ? [{ id: 'default', name: 'Equipe', employees: emps }] : [];
    }
    return activeTeams
      .map((team) => ({
        id: team.id,
        name: team.name,
        employees: state.employees.filter((e) => e.active && e.teamId === team.id),
      }))
      .filter((sec) => sec.employees.length > 0);
  }, [state.teams, state.employees, teamIdFilter]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const issuesByCell = useMemo(() => {
    const map = new Map<string, ScheduleIssue[]>();
    for (const issue of issues) {
      if (!issue.employeeId || !issue.date || issue.severity === 'info') continue;
      const key = `${issue.employeeId}::${issue.date}`;
      const list = map.get(key) ?? [];
      list.push(issue);
      map.set(key, list);
    }
    return map;
  }, [issues]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const [empA, dateA] = String(active.id).split('::');
    const [empB, dateB] = String(over.id).split('::');
    if (empA && dateA && empB && dateB) {
      onDragSwapRequest(empA, dateA, empB, dateB);
    }
  };

  const dragPreview = useMemo(() => {
    if (!activeDragId) return null;
    const [empId, date] = activeDragId.split('::');
    const emp = state.employees.find((e) => e.id === empId);
    const cell = week.assignments[empId]?.[date];
    const visual = resolveCellVisual(cell, shiftsById, state.holidays[date]?.name);
    return { empName: emp?.name ?? '', visual };
  }, [activeDragId, state.employees, week.assignments, shiftsById, state.holidays]);

  if (teamSections.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-800">Nenhuma equipe com colaboradores ativos</p>
        <p className="mt-1 text-xs text-slate-500">
          Clique em <strong>Carregar Dados de Exemplo</strong> acima ou crie uma equipe e cadastre pessoas na aba{' '}
          <strong>Equipes</strong>.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {teamSections.map((section) => (
          <section
            key={section.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            data-testid={`grid-team-${section.id}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">{section.name}</h3>
              </div>
              <span className="font-mono text-xs text-slate-500">
                {section.employees.length} colaborador(es)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-xs text-slate-700">
                    <th className="sticky left-0 z-10 w-48 border-r border-slate-200 bg-slate-100 px-3 py-2.5 font-semibold">
                      Colaborador
                    </th>
                    {days.map((date) => {
                      const holiday = state.holidays[date];
                      return (
                        <th key={date} className="min-w-[116px] px-2 py-2.5 text-center font-semibold">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>
                              {getWeekdayShortPt(date)} ·{' '}
                              <span className="font-mono tabular-nums">{formatShortDateBr(date)}</span>
                            </span>
                            {holiday && (
                              <Badge tone={holiday.mode === 'off_all' ? 'danger' : 'warn'}>
                                {holiday.name || 'Feriado'}
                              </Badge>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {section.employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/40">
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-900">{emp.name}</span>
                            {emp.isBeginner && <Badge tone="beginner">Iniciante</Badge>}
                          </div>
                          {emp.role && <span className="text-[11px] text-slate-500">{emp.role}</span>}
                        </div>
                      </td>
                      {days.map((date) => {
                        const cellId = `${emp.id}::${date}`;
                        const cell = week.assignments[emp.id]?.[date];
                        const holiday = state.holidays[date];
                        const visual = resolveCellVisual(cell, shiftsById, holiday?.name);
                        const cellIssues = issuesByCell.get(cellId) ?? [];
                        const applicableShifts = getApplicableShiftsForDate(state, date);

                        return (
                          <td key={date} className="p-1.5 align-top">
                            <ScheduleCell
                              id={cellId}
                              employee={emp}
                              date={date}
                              cell={cell}
                              visual={visual}
                              hasIssue={cellIssues.length > 0}
                              issueMessage={cellIssues.map((i) => i.message).join(' | ')}
                              applicableShifts={applicableShifts}
                              allActiveShifts={allActiveShifts}
                              onCellChange={(nextCell) => onCellChange(emp.id, date, nextCell)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <DragOverlay>
        {dragPreview && (
          <div
            style={{ backgroundColor: dragPreview.visual.bgColor ?? '#FFFFFF' }}
            className="w-36 rounded-md border border-blue-500 p-2 text-xs shadow-lg"
          >
            <p className="font-semibold text-slate-900">{dragPreview.empName}</p>
            <p className="font-mono text-[11px] text-slate-700">{dragPreview.visual.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
