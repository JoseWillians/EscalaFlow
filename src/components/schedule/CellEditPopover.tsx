import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { formatShortDateBr, getWeekdayShortPt } from '@/domain/dates';
import type { CellAssignment, Employee, ShiftTemplate } from '@/domain/schemas';
import { Button } from '@/components/ui/button';
import { FieldLabel, TextInput } from '@/components/ui/form-controls';
import { PopoverPanel } from '@/components/ui/popover-panel';

export interface CellEditPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  date: string;
  cell: CellAssignment | undefined;
  applicableShifts: ShiftTemplate[];
  allActiveShifts: ShiftTemplate[];
  trigger: React.ReactNode;
  onSelectCell: (nextCell: CellAssignment) => void;
}

export function CellEditPopover({
  open,
  onOpenChange,
  employee,
  date,
  cell,
  applicableShifts,
  allActiveShifts,
  trigger,
  onSelectCell,
}: CellEditPopoverProps) {
  const locked = Boolean(cell?.locked);
  const [noteText, setNoteText] = useState(cell?.note ?? '');

  useEffect(() => {
    if (open) {
      setNoteText(cell?.note ?? '');
    }
  }, [open, cell?.note]);

  const otherShifts = allActiveShifts.filter(
    (s) => !applicableShifts.some((app) => app.id === s.id),
  );

  const assignShift = (shiftId: string) => {
    onSelectCell({
      kind: 'SHIFT',
      shiftId,
      locked,
      note: noteText.trim() || undefined,
    });
    onOpenChange(false);
  };

  const assignKind = (kind: 'OFF' | 'COMP_OFF' | 'HOLIDAY_OFF') => {
    onSelectCell({
      kind,
      locked,
      note: noteText.trim() || undefined,
    });
    onOpenChange(false);
  };

  const toggleLock = () => {
    onSelectCell({
      ...(cell ?? { kind: 'OFF' }),
      locked: !locked,
      note: noteText.trim() || undefined,
    });
  };

  const saveNoteOnly = () => {
    onSelectCell({
      ...(cell ?? { kind: 'OFF', locked: false }),
      note: noteText.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <PopoverPanel open={open} onOpenChange={onOpenChange} trigger={trigger} className="w-72">
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <p className="text-xs font-semibold text-slate-900">{employee.name}</p>
            <p className="text-[11px] text-slate-500">
              {getWeekdayShortPt(date)} · {formatShortDateBr(date)}
            </p>
          </div>
          <Button
            tone={locked ? 'secondary' : 'outline'}
            size="sm"
            onClick={toggleLock}
            title={locked ? 'Destravar célula' : 'Travar célula'}
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            <span>{locked ? 'Travada' : 'Travar'}</span>
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Turnos do dia
          </p>
          {applicableShifts.length === 0 ? (
            <p className="text-xs text-slate-500">Sem turnos padrão neste dia.</p>
          ) : (
            <div className="grid gap-1">
              {applicableShifts.map((shift) => {
                const selected = cell?.kind === 'SHIFT' && cell.shiftId === shift.id;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => assignShift(shift.id)}
                    className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      selected
                        ? 'border-blue-600 bg-blue-50 font-medium text-blue-950'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-slate-300"
                        style={{ backgroundColor: shift.color }}
                      />
                      <span>{shift.name}</span>
                    </span>
                    {shift.isNightShift && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        Noturno
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {otherShifts.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Outros turnos
            </p>
            <div className="grid max-h-24 gap-1 overflow-y-auto pr-1">
              {otherShifts.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => assignShift(shift.id)}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  <span
                    className="h-2 w-2 rounded-full border border-slate-300"
                    style={{ backgroundColor: shift.color }}
                  />
                  <span>{shift.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5 border-t border-slate-100 pt-2">
          <FieldLabel htmlFor={`cell-note-${employee.id}-${date}`}>
            Cobertura / observação (opcional)
          </FieldLabel>
          <div className="flex gap-1.5">
            <TextInput
              id={`cell-note-${employee.id}-${date}`}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ex.: COBRE Allan"
              className="h-8 text-xs"
            />
            <Button tone="outline" size="sm" onClick={saveNoteOnly}>
              Salvar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2">
          <Button tone="outline" size="sm" onClick={() => assignKind('OFF')}>
            Folga
          </Button>
          <Button tone="outline" size="sm" onClick={() => assignKind('COMP_OFF')}>
            Folga (Dom.)
          </Button>
        </div>
      </div>
    </PopoverPanel>
  );
}
