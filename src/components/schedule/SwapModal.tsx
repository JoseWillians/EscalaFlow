import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { formatShortDateBr, getWeekDays, getWeekdayShortPt } from '@/domain/dates';
import type { AppState, SwapRecord, WeekSchedule } from '@/domain/schemas';
import { validateSwap } from '@/engine/validator';
import { describeCellForText } from '@/exporters/whatsapp';
import { Button } from '@/components/ui/button';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/form-controls';
import { Modal } from '@/components/ui/modal';

export interface SwapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: AppState;
  week: WeekSchedule;
  initialSelection?: {
    employeeIdA: string;
    dateA: string;
    employeeIdB?: string;
    dateB?: string;
  } | null;
  onConfirmSwap: (nextWeek: WeekSchedule, record: SwapRecord) => void;
}

export function SwapModal({
  open,
  onOpenChange,
  state,
  week,
  initialSelection,
  onConfirmSwap,
}: SwapModalProps) {
  const days = useMemo(() => getWeekDays(week.weekStart), [week.weekStart]);
  const activeEmployees = useMemo(
    () => state.employees.filter((e) => e.active),
    [state.employees],
  );
  const shiftsById = useMemo(
    () => new Map(state.shifts.map((s) => [s.id, s])),
    [state.shifts],
  );
  const groupedEmployees = useMemo(() => {
    const activeTeams = state.teams.filter((t) => t.active);
    if (activeTeams.length === 0) {
      return [{ id: 'default', name: 'Equipe', employees: activeEmployees }];
    }
    return activeTeams
      .map((team) => ({
        id: team.id,
        name: team.name,
        employees: activeEmployees.filter((e) => e.teamId === team.id),
      }))
      .filter((g) => g.employees.length > 0);
  }, [state.teams, activeEmployees]);

  const [employeeIdA, setEmployeeIdA] = useState('');
  const [dateA, setDateA] = useState(days[0] ?? '');
  const [employeeIdB, setEmployeeIdB] = useState('');
  const [dateB, setDateB] = useState(days[0] ?? '');
  const [reason, setReason] = useState('');
  const [approveException, setApproveException] = useState(false);

  useEffect(() => {
    if (!open) return;
    const defaultA = initialSelection?.employeeIdA || activeEmployees[0]?.id || '';
    const empATeam = activeEmployees.find((e) => e.id === defaultA)?.teamId;
    const defaultB =
      initialSelection?.employeeIdB ||
      activeEmployees.find((e) => e.id !== defaultA && e.teamId === empATeam)?.id ||
      activeEmployees.find((e) => e.id !== defaultA)?.id ||
      defaultA;
    const defaultDateA = initialSelection?.dateA || days[0] || '';
    const defaultDateB = initialSelection?.dateB || defaultDateA;

    setEmployeeIdA(defaultA);
    setDateA(defaultDateA);
    setEmployeeIdB(defaultB);
    setDateB(defaultDateB);
    setReason('');
    setApproveException(false);
  }, [open, initialSelection, activeEmployees, days]);

  useEffect(() => {
    setApproveException(false);
  }, [employeeIdA, dateA, employeeIdB, dateB]);

  const sameSlot = employeeIdA === employeeIdB && dateA === dateB;

  const validation = useMemo(() => {
    if (!employeeIdA || !employeeIdB || !dateA || !dateB || sameSlot) {
      return null;
    }
    return validateSwap({
      state,
      week,
      dateA,
      employeeIdA,
      dateB,
      employeeIdB,
    });
  }, [state, week, dateA, employeeIdA, dateB, employeeIdB, sameSlot]);

  const empAName = activeEmployees.find((e) => e.id === employeeIdA)?.name ?? '';
  const empBName = activeEmployees.find((e) => e.id === employeeIdB)?.name ?? '';

  const cellALabel = describeCellForText(
    week.assignments[employeeIdA]?.[dateA],
    shiftsById,
    state.holidays[dateA]?.name,
    state.holidays[dateA]?.mode,
  );
  const cellBLabel = describeCellForText(
    week.assignments[employeeIdB]?.[dateB],
    shiftsById,
    state.holidays[dateB]?.name,
    state.holidays[dateB]?.mode,
  );

  const canConfirm =
    Boolean(validation) &&
    !sameSlot &&
    (validation!.valid || approveException);

  const handleConfirm = () => {
    if (!validation || !canConfirm) return;
    const summary =
      dateA === dateB
        ? `${empAName} (${cellALabel}) <-> ${empBName} (${cellBLabel}) em ${formatShortDateBr(dateA)}`
        : `${empAName} [${formatShortDateBr(dateA)}: ${cellALabel}] <-> ${empBName} [${formatShortDateBr(dateB)}: ${cellBLabel}]`;

    const record: SwapRecord = {
      id: `swap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      dateA,
      employeeIdA,
      dateB,
      employeeIdB,
      summary,
      reason: reason.trim(),
      hadWarnings: !validation.valid,
      approvedException: !validation.valid && approveException,
      warnings: validation.issues.map((i) => i.message),
    };

    onConfirmSwap(
      {
        ...validation.simulatedWeek,
        swaps: [record, ...(validation.simulatedWeek.swaps ?? [])],
      },
      record,
    );
    onOpenChange(false);
  };

  const renderEmployeeOptions = () =>
    groupedEmployees.map((group) => (
      <optgroup key={group.id} label={group.name}>
        {group.employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.name}
            {emp.isBeginner ? ' (Iniciante)' : ''}
          </option>
        ))}
      </optgroup>
    ));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Trocar Turno"
      description="Selecione os dois colaboradores e dias para permutar com validação automática das regras."
      maxWidthClass="max-w-xl"
    >
      {activeEmployees.length < 2 ? (
        <p className="text-sm text-slate-600">
          Cadastre pelo menos 2 colaboradores ativos para realizar trocas.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="swap-emp-a">Colaborador A</FieldLabel>
              <SelectInput
                id="swap-emp-a"
                value={employeeIdA}
                onChange={(e) => setEmployeeIdA(e.target.value)}
              >
                {renderEmployeeOptions()}
              </SelectInput>
              <FieldLabel htmlFor="swap-date-a">Dia A</FieldLabel>
              <SelectInput
                id="swap-date-a"
                value={dateA}
                onChange={(e) => setDateA(e.target.value)}
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {getWeekdayShortPt(d)} {formatShortDateBr(d)}
                  </option>
                ))}
              </SelectInput>
              <p className="text-xs text-slate-600">
                Atual: <strong className="text-slate-900">{cellALabel}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="swap-emp-b">Colaborador B</FieldLabel>
              <SelectInput
                id="swap-emp-b"
                value={employeeIdB}
                onChange={(e) => setEmployeeIdB(e.target.value)}
              >
                {renderEmployeeOptions()}
              </SelectInput>
              <FieldLabel htmlFor="swap-date-b">Dia B</FieldLabel>
              <SelectInput
                id="swap-date-b"
                value={dateB}
                onChange={(e) => setDateB(e.target.value)}
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {getWeekdayShortPt(d)} {formatShortDateBr(d)}
                  </option>
                ))}
              </SelectInput>
              <p className="text-xs text-slate-600">
                Atual: <strong className="text-slate-900">{cellBLabel}</strong>
              </p>
            </div>
          </div>

          {sameSlot && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Escolha dois colaboradores ou dias diferentes para simular a permuta.
            </p>
          )}

          {validation && validation.valid && (
            <div
              className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"
              data-testid="swap-valid-banner"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold">Troca compatível com todas as regras</p>
                <p className="mt-0.5">
                  {empAName} assumirá <strong>{cellBLabel}</strong> e {empBName} assumirá{' '}
                  <strong>{cellALabel}</strong>.
                </p>
              </div>
            </div>
          )}

          {validation && !validation.valid && (
            <div
              className="space-y-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"
              data-testid="swap-warning-banner"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">Alertas detectados nesta troca</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {validation.issues.map((issue, idx) => (
                      <li key={`${issue.code}-${idx}`}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded border border-amber-300/80 bg-white/80 px-2.5 py-2 font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={approveException}
                  onChange={(e) => setApproveException(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  data-testid="approve-exception-checkbox"
                />
                <span>Confirmar exceção autorizada pelo líder</span>
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <FieldLabel htmlFor="swap-reason">Observação (opcional)</FieldLabel>
            <TextInput
              id="swap-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Solicitação do colaborador, consulta médica..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <Button tone="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              tone={validation && !validation.valid ? 'danger' : 'primary'}
              disabled={!canConfirm}
              onClick={handleConfirm}
              data-testid="confirm-swap-btn"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>
                {validation && !validation.valid
                  ? 'Registrar troca com exceção'
                  : 'Confirmar troca'}
              </span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
