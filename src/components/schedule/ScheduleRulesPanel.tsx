import { useState } from 'react';
import { Layers, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_SCHEDULE_RULES,
  type ScheduleRules,
  type ShiftTemplate,
  type Team,
} from '@/domain/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLabel, TextInput } from '@/components/ui/form-controls';

export interface ScheduleRulesPanelProps {
  generalRules: ScheduleRules;
  teams: Team[];
  shifts: ShiftTemplate[];
  onChangeGeneral: (nextRules: ScheduleRules) => void;
  onChangeTeamOverride: (teamId: string, override: Partial<ScheduleRules> | undefined) => void;
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

export function ScheduleRulesPanel({
  generalRules,
  teams,
  shifts,
  onChangeGeneral,
  onChangeTeamOverride,
}: ScheduleRulesPanelProps) {
  const activeTeams = teams.filter((t) => t.active);
  const [scope, setScope] = useState<'general' | string>('general');

  const selectedTeam =
    scope !== 'general' ? activeTeams.find((t) => t.id === scope) : undefined;
  const isTeamScope = Boolean(selectedTeam);

  const effectiveRules: ScheduleRules = selectedTeam?.rulesOverride
    ? { ...generalRules, ...selectedTeam.rulesOverride }
    : generalRules;

  const activeShifts = shifts.filter((s) => s.active);
  const usingAllShifts = effectiveRules.selectedShiftIdsForGeneration.length === 0;

  const applyPatch = (patch: Partial<ScheduleRules>) => {
    if (selectedTeam) {
      onChangeTeamOverride(selectedTeam.id, {
        ...selectedTeam.rulesOverride,
        ...patch,
      });
    } else {
      onChangeGeneral({
        ...generalRules,
        ...patch,
      });
    }
  };

  const toggleRule = (key: (typeof RULE_CHECKBOXES)[number]['key']) => {
    applyPatch({ [key]: !effectiveRules[key] });
  };

  const toggleShiftSelection = (shiftId: string) => {
    if (usingAllShifts) {
      const allIds = activeShifts.map((s) => s.id);
      applyPatch({
        selectedShiftIdsForGeneration: allIds.filter((id) => id !== shiftId),
      });
      return;
    }

    const exists = effectiveRules.selectedShiftIdsForGeneration.includes(shiftId);
    const next = exists
      ? effectiveRules.selectedShiftIdsForGeneration.filter((id) => id !== shiftId)
      : [...effectiveRules.selectedShiftIdsForGeneration, shiftId];

    applyPatch({ selectedShiftIdsForGeneration: next });
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
              Configure a regra geral ou personalize por equipe (regras da equipe têm prioridade sobre a geral).
            </p>
          </div>
        </div>

        {isTeamScope && selectedTeam ? (
          selectedTeam.rulesOverride ? (
            <Button
              tone="outline"
              size="sm"
              onClick={() => onChangeTeamOverride(selectedTeam.id, undefined)}
              data-testid="clear-team-override-btn"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Usar regra geral</span>
            </Button>
          ) : null
        ) : (
          <Button
            tone="ghost"
            size="sm"
            onClick={() => onChangeGeneral({ ...DEFAULT_SCHEDULE_RULES })}
            data-testid="reset-rules-btn"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restaurar padrão</span>
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={() => setScope('general')}
          data-testid="rules-scope-general"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            !isTeamScope
              ? 'border-blue-600 bg-blue-50 text-blue-900'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Geral (Padrão)</span>
        </button>

        {activeTeams.map((team) => {
          const active = scope === team.id;
          const customized = Boolean(team.rulesOverride);
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => setScope(team.id)}
              data-testid={`rules-scope-${team.id}`}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{team.name}</span>
              {customized && <Badge tone="info">Personalizada</Badge>}
            </button>
          );
        })}
      </div>

      {selectedTeam && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-xs ${
            selectedTeam.rulesOverride
              ? 'border-blue-200 bg-blue-50/70 text-blue-950'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
          data-testid="team-scope-banner"
        >
          {selectedTeam.rulesOverride ? (
            <span>
              <strong>{selectedTeam.name}</strong> está usando regras próprias (prioridade máxima sobre a configuração geral).
            </span>
          ) : (
            <span>
              <strong>{selectedTeam.name}</strong> está herdando a regra geral. Altere qualquer opção abaixo para criar uma regra exclusiva desta equipe.
            </span>
          )}
        </div>
      )}

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
                  checked={effectiveRules[item.key]}
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
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Quantidade {selectedTeam ? `em ${selectedTeam.name}` : 'por equipe'}: finais de semana e feriados
              </p>
              <p className="text-[11px] text-slate-500">
                Deixe Sábado/Feriado em branco para usar o modo automático (ou informe 0 para sem expediente).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <FieldLabel htmlFor="saturday-staff-count">Sábados</FieldLabel>
                <TextInput
                  id="saturday-staff-count"
                  type="number"
                  min={0}
                  max={50}
                  placeholder="Todos"
                  value={effectiveRules.saturdayStaffCount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    applyPatch({
                      saturdayStaffCount:
                        raw === '' ? null : Math.max(0, Math.min(50, Number(raw) || 0)),
                    });
                  }}
                  className="mt-1 font-mono"
                  data-testid="saturday-staff-count-input"
                />
              </div>

              <div>
                <FieldLabel htmlFor="sunday-staff-count">Domingos</FieldLabel>
                <TextInput
                  id="sunday-staff-count"
                  type="number"
                  min={0}
                  max={50}
                  value={effectiveRules.sundayStaffCount}
                  onChange={(e) =>
                    applyPatch({
                      sundayStaffCount: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                    })
                  }
                  className="mt-1 font-mono"
                  data-testid="sunday-staff-count-input"
                />
              </div>

              <div>
                <FieldLabel htmlFor="holiday-staff-count">Feriados</FieldLabel>
                <TextInput
                  id="holiday-staff-count"
                  type="number"
                  min={0}
                  max={50}
                  placeholder="Auto"
                  value={effectiveRules.holidayStaffCount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    applyPatch({
                      holidayStaffCount:
                        raw === '' ? null : Math.max(0, Math.min(50, Number(raw) || 0)),
                    });
                  }}
                  className="mt-1 font-mono"
                  data-testid="holiday-staff-count-input"
                />
              </div>
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
                    onClick={() => applyPatch({ selectedShiftIdsForGeneration: [] })}
                  >
                    Usar todos os ativos
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2 grid max-h-40 gap-1.5 overflow-y-auto pr-1 text-xs">
              {activeShifts.map((shift) => {
                const checked =
                  usingAllShifts ||
                  effectiveRules.selectedShiftIdsForGeneration.includes(shift.id);
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
