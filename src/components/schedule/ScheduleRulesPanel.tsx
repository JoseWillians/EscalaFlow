import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_SCHEDULE_RULES,
  type ScheduleRules,
  type ShiftTemplate,
} from '@/domain/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLabel, TextInput } from '@/components/ui/form-controls';

export interface ScheduleRulesPanelProps {
  rules: ScheduleRules;
  shifts: ShiftTemplate[];
  onChange: (nextRules: ScheduleRules) => void;
}

const RULE_CHECKBOXES: Array<{
  key: keyof Pick<
    ScheduleRules,
    | 'enforceBeginnerRestrictions'
    | 'enforceSundayCompOff'
    | 'noMidweekOffWithoutSunday'
    | 'enforceNightShiftMonthlyRotation'
    | 'avoidConsecutiveSundays'
    | 'warnInterjornadaUnder11h'
  >;
  label: string;
  hint: string;
}> = [
  {
    key: 'enforceBeginnerRestrictions',
    label: 'Restringir Iniciantes',
    hint: 'Bloqueia iniciantes em turno noturno, domingos e feriados com expediente',
  },
  {
    key: 'enforceSundayCompOff',
    label: 'Folga compensatória de domingo',
    hint: 'Quem trabalha no domingo recebe 1 dia de Folga (Dom.)',
  },
  {
    key: 'noMidweekOffWithoutSunday',
    label: 'Só folga no meio da semana quem trabalhou domingo',
    hint: 'Demais colaboradores trabalham Seg–Sáb e folgam somente aos domingos',
  },
  {
    key: 'enforceNightShiftMonthlyRotation',
    label: 'Rodízio mensal no turno noturno',
    hint: 'Prioriza veteranos com 0 ocorrências no turno noturno do mês',
  },
  {
    key: 'avoidConsecutiveSundays',
    label: 'Evitar dois domingos consecutivos',
    hint: 'Alterna colaboradores entre domingos quando há outro elegível',
  },
  {
    key: 'warnInterjornadaUnder11h',
    label: 'Alertar/evitar interjornada < 11h',
    hint: 'Sinaliza e evita saída às 22h seguida de entrada às 08h',
  },
];

export function ScheduleRulesPanel({ rules, shifts, onChange }: ScheduleRulesPanelProps) {
  const activeShifts = shifts.filter((s) => s.active);
  const usingAllShifts = rules.selectedShiftIdsForGeneration.length === 0;

  const toggleRule = (key: (typeof RULE_CHECKBOXES)[number]['key']) => {
    onChange({
      ...rules,
      [key]: !rules[key],
    });
  };

  const toggleShiftSelection = (shiftId: string) => {
    if (usingAllShifts) {
      // Ao desmarcar/clicar partindo de "todos", passa a selecionar apenas os demais ou só este
      const allIds = activeShifts.map((s) => s.id);
      onChange({
        ...rules,
        selectedShiftIdsForGeneration: allIds.filter((id) => id !== shiftId),
      });
      return;
    }

    const exists = rules.selectedShiftIdsForGeneration.includes(shiftId);
    const next = exists
      ? rules.selectedShiftIdsForGeneration.filter((id) => id !== shiftId)
      : [...rules.selectedShiftIdsForGeneration, shiftId];

    onChange({
      ...rules,
      selectedShiftIdsForGeneration: next,
    });
  };

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4"
      data-testid="schedule-rules-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Regras e Turnos da Geração Automática
            </h2>
            <p className="text-xs text-slate-500">
              Marque quais regras aplicar, defina quantas pessoas trabalham no domingo e escolha os turnos desejados.
            </p>
          </div>
        </div>
        <Button
          tone="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_SCHEDULE_RULES })}
          data-testid="reset-rules-btn"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Restaurar padrão</span>
        </Button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-12">
        <div className="space-y-2.5 lg:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Regras ativas (caixas de seleção)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RULE_CHECKBOXES.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-xs hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={rules[item.key]}
                  onChange={() => toggleRule(item.key)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                  data-testid={`rule-checkbox-${item.key}`}
                />
                <span>
                  <span className="block font-medium text-slate-900">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <FieldLabel htmlFor="sunday-staff-count">
              Quantidade de pessoas aos domingos (por equipe)
            </FieldLabel>
            <div className="mt-1.5 flex items-center gap-3">
              <TextInput
                id="sunday-staff-count"
                type="number"
                min={0}
                max={50}
                value={rules.sundayStaffCount}
                onChange={(e) =>
                  onChange({
                    ...rules,
                    sundayStaffCount: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                  })
                }
                className="w-24 font-mono"
                data-testid="sunday-staff-count-input"
              />
              <span className="text-xs text-slate-500">
                Use <code className="font-mono">0</code> se não houver expediente aos domingos.
              </span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">
                Turnos usados na geração
              </p>
              <div className="flex items-center gap-1.5">
                {usingAllShifts ? (
                  <Badge tone="info">Todos os ativos ({activeShifts.length})</Badge>
                ) : (
                  <Button
                    tone="ghost"
                    size="sm"
                    onClick={() => onChange({ ...rules, selectedShiftIdsForGeneration: [] })}
                  >
                    Usar todos os ativos
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2 grid max-h-40 gap-1.5 overflow-y-auto pr-1 text-xs">
              {activeShifts.map((shift) => {
                const checked =
                  usingAllShifts || rules.selectedShiftIdsForGeneration.includes(shift.id);
                return (
                  <label
                    key={shift.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleShiftSelection(shift.id)}
                        data-testid={`gen-shift-checkbox-${shift.id}`}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-slate-300"
                        style={{ backgroundColor: shift.color }}
                      />
                      <span className="font-medium text-slate-800">{shift.name}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {shift.applicableDays.join(', ')}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
