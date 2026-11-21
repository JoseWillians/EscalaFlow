import { useState, type FormEvent } from 'react';
import { CalendarX2, Clock, Edit3, Plus, Trash2 } from 'lucide-react';
import { formatShortDateBr, getTodayIsoDate } from '@/domain/dates';
import type {
  AppState,
  DayCategory,
  Holiday,
  HolidayMode,
  ShiftTemplate,
} from '@/domain/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/form-controls';
import { SwitchControl } from '@/components/ui/switch-control';

export interface ShiftsAndHolidaysProps {
  state: AppState;
  onUpdateShifts: (shifts: ShiftTemplate[]) => void;
  onUpdateHolidays: (holidays: Record<string, Holiday>) => void;
}

const DAY_LABELS: Record<DayCategory, string> = {
  weekday: 'Seg–Sex',
  saturday: 'Sábado',
  sunday: 'Domingo',
  holiday: 'Feriado',
};

const PASTEL_COLORS = [
  '#DBEAFE',
  '#E0E7FF',
  '#FEF3C7',
  '#D1FAE5',
  '#CCFBF1',
  '#E0F2FE',
  '#FCE7F3',
  '#FFEDD5',
];

export function ShiftsAndHolidays({
  state,
  onUpdateShifts,
  onUpdateHolidays,
}: ShiftsAndHolidaysProps) {
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [shiftColor, setShiftColor] = useState(PASTEL_COLORS[0]);
  const [applicableDays, setApplicableDays] = useState<DayCategory[]>(['weekday']);
  const [startTime, setStartTime] = useState('08:00');
  const [breakDuration, setBreakDuration] = useState(60);
  const [breakWindow, setBreakWindow] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  const [isNightShift, setIsNightShift] = useState(false);
  const [targetHeadcount, setTargetHeadcount] = useState(1);

  const [holidayDate, setHolidayDate] = useState(getTodayIsoDate());
  const [holidayName, setHolidayName] = useState('');
  const [holidayMode, setHolidayMode] = useState<HolidayMode>('off_all');
  const [holidayShiftIds, setHolidayShiftIds] = useState<string[]>([]);

  const resetShiftForm = () => {
    setEditingShiftId(null);
    setShiftName('');
    setShiftColor(PASTEL_COLORS[0]);
    setApplicableDays(['weekday']);
    setStartTime('08:00');
    setBreakDuration(60);
    setBreakWindow('');
    setEndTime('17:00');
    setIsNightShift(false);
    setTargetHeadcount(1);
  };

  const loadShiftForEdit = (shift: ShiftTemplate) => {
    setEditingShiftId(shift.id);
    setShiftName(shift.name);
    setShiftColor(shift.color);
    setApplicableDays(shift.applicableDays);
    setStartTime(shift.startTime);
    setBreakDuration(shift.breakDurationMinutes);
    setBreakWindow(shift.breakWindow ?? '');
    setEndTime(shift.endTime);
    setIsNightShift(shift.isNightShift);
    setTargetHeadcount(shift.targetHeadcount);
  };

  const toggleDayCategory = (cat: DayCategory) => {
    setApplicableDays((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat],
    );
  };

  const handleSaveShift = (e: FormEvent) => {
    e.preventDefault();
    if (applicableDays.length === 0) return;
    const finalName = shiftName.trim() || `${startTime} às ${endTime}`;

    if (editingShiftId) {
      onUpdateShifts(
        state.shifts.map((s) =>
          s.id === editingShiftId
            ? {
                ...s,
                name: finalName,
                color: shiftColor,
                applicableDays,
                startTime,
                breakDurationMinutes: Math.max(0, Number(breakDuration) || 0),
                breakWindow: breakWindow.trim() || undefined,
                endTime,
                isNightShift,
                targetHeadcount: Math.max(1, Number(targetHeadcount) || 1),
              }
            : s,
        ),
      );
    } else {
      const nextShift: ShiftTemplate = {
        id: `shift-${Date.now()}`,
        name: finalName,
        color: shiftColor,
        applicableDays,
        startTime,
        breakDurationMinutes: Math.max(0, Number(breakDuration) || 0),
        breakWindow: breakWindow.trim() || undefined,
        endTime,
        isNightShift,
        targetHeadcount: Math.max(1, Number(targetHeadcount) || 1),
        active: true,
      };
      onUpdateShifts([...state.shifts, nextShift]);
    }
    resetShiftForm();
  };

  const handleSaveHoliday = (e: FormEvent) => {
    e.preventDefault();
    if (!holidayDate) return;
    const entry: Holiday = {
      date: holidayDate,
      name: holidayName.trim() || 'Feriado',
      mode: holidayMode,
      shiftIds: holidayMode === 'special' ? holidayShiftIds : [],
    };
    onUpdateHolidays({
      ...state.holidays,
      [holidayDate]: entry,
    });
    setHolidayName('');
    setHolidayShiftIds([]);
  };

  const holidayList = Object.values(state.holidays).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                {editingShiftId ? 'Editar Turno' : 'Novo Turno'}
              </h2>
            </div>
            {editingShiftId && (
              <Button tone="ghost" size="sm" onClick={resetShiftForm}>
                Cancelar edição
              </Button>
            )}
          </div>

          <form onSubmit={handleSaveShift} className="mt-3 grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <FieldLabel htmlFor="shift-name">Rótulo do turno</FieldLabel>
              <TextInput
                id="shift-name"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="Ex.: 08:00 às 18:00"
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="shift-start">Início</FieldLabel>
              <TextInput
                id="shift-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="mt-1 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel htmlFor="shift-end">Término</FieldLabel>
              <TextInput
                id="shift-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="mt-1 font-mono"
              />
            </div>

            <div className="sm:col-span-3">
              <FieldLabel htmlFor="shift-headcount">Pessoas alvo</FieldLabel>
              <TextInput
                id="shift-headcount"
                type="number"
                min={1}
                max={50}
                value={targetHeadcount}
                onChange={(e) => setTargetHeadcount(Number(e.target.value))}
                required
                className="mt-1 font-mono"
              />
            </div>

            <div className="sm:col-span-3">
              <FieldLabel htmlFor="shift-break">Intervalo (min)</FieldLabel>
              <TextInput
                id="shift-break"
                type="number"
                min={0}
                max={360}
                value={breakDuration}
                onChange={(e) => setBreakDuration(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>

            <div className="sm:col-span-4">
              <FieldLabel htmlFor="shift-break-window">Janela intervalo (opcional)</FieldLabel>
              <TextInput
                id="shift-break-window"
                value={breakWindow}
                onChange={(e) => setBreakWindow(e.target.value)}
                placeholder="Ex.: 12:00–14:00"
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-5">
              <FieldLabel>Cor identificadora</FieldLabel>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {PASTEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Selecionar cor ${c}`}
                    onClick={() => setShiftColor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full border ${
                      shiftColor === c ? 'ring-2 ring-blue-600 ring-offset-1' : 'border-slate-300'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Cor personalizada"
                  value={shiftColor}
                  onChange={(e) => setShiftColor(e.target.value)}
                  className="h-6 w-7 cursor-pointer rounded border border-slate-200"
                />
              </div>
            </div>

            <div className="sm:col-span-12">
              <FieldLabel>Dias aplicáveis</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['weekday', 'saturday', 'sunday', 'holiday'] as DayCategory[]).map((cat) => {
                  const selected = applicableDays.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleDayCategory(cat)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {DAY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-12">
              <div className="flex items-center gap-2">
                <SwitchControl
                  id="shift-night-flag"
                  checked={isNightShift}
                  onCheckedChange={setIsNightShift}
                  ariaLabel="Turno noturno/fechamento"
                />
                <label htmlFor="shift-night-flag" className="text-xs text-slate-700">
                  Turno noturno/fechamento (entra no rodízio mensal e bloqueia Iniciantes)
                </label>
              </div>
              <Button type="submit" tone="primary" disabled={applicableDays.length === 0}>
                <Plus className="h-4 w-4" />
                <span>{editingShiftId ? 'Salvar alterações' : 'Adicionar turno'}</span>
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
            Turnos Configurados ({state.shifts.length})
          </h2>

          <ul className="mt-3 divide-y divide-slate-100 text-xs">
            {state.shifts.map((shift) => (
              <li
                key={shift.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-4 w-4 shrink-0 rounded border border-slate-300"
                    style={{ backgroundColor: shift.color }}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-sm font-medium ${
                          shift.active ? 'text-slate-900' : 'text-slate-400 line-through'
                        }`}
                      >
                        {shift.name}
                      </span>
                      {shift.isNightShift && <Badge tone="warn">Noturno</Badge>}
                      {shift.applicableDays.map((d) => (
                        <Badge key={d} tone="neutral">
                          {DAY_LABELS[d]}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {shift.startTime}–{shift.endTime} ·{' '}
                      {shift.breakDurationMinutes > 0
                        ? `Intervalo ${shift.breakDurationMinutes}min${
                            shift.breakWindow ? ` (${shift.breakWindow})` : ''
                          }`
                        : 'Sem intervalo'}{' '}
                      · Meta: {shift.targetHeadcount}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SwitchControl
                    checked={shift.active}
                    onCheckedChange={(checked) =>
                      onUpdateShifts(
                        state.shifts.map((s) => (s.id === shift.id ? { ...s, active: checked } : s)),
                      )
                    }
                    ariaLabel={`Ativar ou desativar turno ${shift.name}`}
                  />
                  <Button
                    tone="ghost"
                    size="icon"
                    aria-label={`Editar ${shift.name}`}
                    onClick={() => loadShiftForEdit(shift)}
                  >
                    <Edit3 className="h-4 w-4 text-slate-600" />
                  </Button>
                  <Button
                    tone="ghost"
                    size="icon"
                    aria-label={`Excluir ${shift.name}`}
                    onClick={() =>
                      onUpdateShifts(state.shifts.filter((s) => s.id !== shift.id))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <CalendarX2 className="h-4 w-4 text-rose-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Feriados</h2>
            <p className="text-xs text-slate-500">Folga Geral ou Expediente Especial</p>
          </div>
        </div>

        <form onSubmit={handleSaveHoliday} className="mt-3 space-y-3">
          <div>
            <FieldLabel htmlFor="holiday-date">Data</FieldLabel>
            <TextInput
              id="holiday-date"
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <FieldLabel htmlFor="holiday-name">Nome (opcional)</FieldLabel>
            <TextInput
              id="holiday-name"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="Ex.: Consciência Negra"
              className="mt-1"
            />
          </div>

          <div>
            <FieldLabel htmlFor="holiday-mode">Regime</FieldLabel>
            <SelectInput
              id="holiday-mode"
              value={holidayMode}
              onChange={(e) => setHolidayMode(e.target.value as HolidayMode)}
              className="mt-1"
            >
              <option value="off_all">Folga Geral</option>
              <option value="special">Expediente Especial (sem iniciantes)</option>
            </SelectInput>
          </div>

          {holidayMode === 'special' && (
            <div>
              <FieldLabel>Turnos do feriado (vazio = turnos de Domingo)</FieldLabel>
              <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 text-xs">
                {state.shifts
                  .filter((s) => s.active)
                  .map((s) => {
                    const checked = holidayShiftIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setHolidayShiftIds((prev) =>
                              checked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                            )
                          }
                        />
                        <span>{s.name}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          <Button type="submit" tone="outline" className="w-full">
            <Plus className="h-4 w-4" />
            <span>Salvar feriado</span>
          </Button>
        </form>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold text-slate-700">Feriados cadastrados</h3>
          {holidayList.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Nenhum feriado cadastrado.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {holidayList.map((h) => (
                <li
                  key={h.date}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      <span className="font-mono">{formatShortDateBr(h.date)}</span> · {h.name}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {h.mode === 'off_all' ? 'Folga Geral' : 'Expediente Especial'}
                    </p>
                  </div>
                  <Button
                    tone="ghost"
                    size="icon"
                    aria-label={`Remover feriado ${h.name}`}
                    onClick={() => {
                      const next = { ...state.holidays };
                      delete next[h.date];
                      onUpdateHolidays(next);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-red-600" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
