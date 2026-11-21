import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Database,
  Eraser,
  History,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react';
import {
  formatMonthYearPt,
  formatShortDateBr,
  getWeekReferenceMonthKey,
} from '@/domain/dates';
import type {
  AppState,
  CellAssignment,
  ScheduleRules,
  SwapRecord,
  WeekSchedule,
} from '@/domain/schemas';
import { computeMonthlyEquity } from '@/engine/equity';
import { getScheduleRules, validateSwap, validateWeekSchedule } from '@/engine/validator';
import { describeCellForText } from '@/exporters/whatsapp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectInput } from '@/components/ui/form-controls';
import { EquityPanel } from './EquityPanel';
import { GridByEmployee } from './GridByEmployee';
import { GridByShift } from './GridByShift';
import { ScheduleRulesPanel } from './ScheduleRulesPanel';
import { SwapModal } from './SwapModal';

export interface ScheduleWorkspaceProps {
  state: AppState;
  weekStart: string;
  week: WeekSchedule;
  onGenerateWeek: () => void;
  onClearUnlocked: () => void;
  onLoadSampleData: () => void;
  onUpdateWeek: (nextWeek: WeekSchedule) => void;
  onUpdateScheduleRules: (rules: ScheduleRules) => void;
}

export function ScheduleWorkspace({
  state,
  weekStart,
  week,
  onGenerateWeek,
  onClearUnlocked,
  onLoadSampleData,
  onUpdateWeek,
  onUpdateScheduleRules,
}: ScheduleWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'employee' | 'shift'>('employee');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapInitial, setSwapInitial] = useState<{
    employeeIdA: string;
    dateA: string;
    employeeIdB?: string;
    dateB?: string;
  } | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);

  const monthKey = getWeekReferenceMonthKey(weekStart);
  const monthLabel = formatMonthYearPt(monthKey);
  const activeTeams = useMemo(() => state.teams.filter((t) => t.active), [state.teams]);
  const effectiveTeamFilter =
    teamFilter !== 'all' && activeTeams.some((t) => t.id === teamFilter)
      ? teamFilter
      : undefined;

  const issues = useMemo(
    () => validateWeekSchedule({ state, weekStart, week }),
    [state, weekStart, week],
  );

  const filteredIssues = useMemo(
    () =>
      effectiveTeamFilter
        ? issues.filter((i) => !i.teamId || i.teamId === effectiveTeamFilter)
        : issues,
    [issues, effectiveTeamFilter],
  );

  const blockingOrWarningIssues = useMemo(
    () => filteredIssues.filter((i) => i.severity !== 'info'),
    [filteredIssues],
  );
  const infoIssues = useMemo(
    () => filteredIssues.filter((i) => i.severity === 'info'),
    [filteredIssues],
  );

  const equitySummaries = useMemo(
    () =>
      computeMonthlyEquity({
        state,
        monthKey,
        currentWeekOverride: week,
      }),
    [state, monthKey, week],
  );

  const shiftsById = useMemo(
    () => new Map(state.shifts.map((s) => [s.id, s])),
    [state.shifts],
  );

  const handleCellChange = (
    employeeId: string,
    date: string,
    nextCell: CellAssignment,
  ) => {
    const prevEmpDays = week.assignments[employeeId] ?? {};
    onUpdateWeek({
      ...week,
      assignments: {
        ...week.assignments,
        [employeeId]: {
          ...prevEmpDays,
          [date]: nextCell,
        },
      },
    });
  };

  const handleDragSwapRequest = (
    employeeIdA: string,
    dateA: string,
    employeeIdB: string,
    dateB: string,
  ) => {
    const validation = validateSwap({
      state,
      week,
      dateA,
      employeeIdA,
      dateB,
      employeeIdB,
    });

    if (validation.valid) {
      const empA = state.employees.find((e) => e.id === employeeIdA)?.name ?? employeeIdA;
      const empB = state.employees.find((e) => e.id === employeeIdB)?.name ?? employeeIdB;
      const labelA = describeCellForText(
        week.assignments[employeeIdA]?.[dateA],
        shiftsById,
        state.holidays[dateA]?.name,
        state.holidays[dateA]?.mode,
      );
      const labelB = describeCellForText(
        week.assignments[employeeIdB]?.[dateB],
        shiftsById,
        state.holidays[dateB]?.name,
        state.holidays[dateB]?.mode,
      );
      const summary =
        dateA === dateB
          ? `${empA} (${labelA}) <-> ${empB} (${labelB}) em ${formatShortDateBr(dateA)}`
          : `${empA} [${formatShortDateBr(dateA)}] <-> ${empB} [${formatShortDateBr(dateB)}]`;

      const record: SwapRecord = {
        id: `swap-${Date.now()}`,
        timestamp: new Date().toISOString(),
        dateA,
        employeeIdA,
        dateB,
        employeeIdB,
        summary,
        reason: 'Troca rápida por arrastar e soltar',
        hadWarnings: false,
        approvedException: false,
        warnings: [],
      };
      onUpdateWeek({
        ...validation.simulatedWeek,
        swaps: [record, ...(validation.simulatedWeek.swaps ?? [])],
      });
      setSwapFeedback(`Troca registrada: ${summary}`);
      return;
    }

    setSwapInitial({ employeeIdA, dateA, employeeIdB, dateB });
    setSwapOpen(true);
  };

  const handleConfirmSwapModal = (nextWeek: WeekSchedule, record: SwapRecord) => {
    onUpdateWeek(nextWeek);
    setSwapFeedback(`Troca registrada: ${record.summary}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            tone="primary"
            onClick={onGenerateWeek}
            disabled={state.employees.filter((e) => e.active).length === 0}
            data-testid="generate-schedule-btn"
          >
            <Wand2 className="h-4 w-4" />
            <span>Gerar Escala Automaticamente</span>
          </Button>
          <Button tone="outline" onClick={onClearUnlocked} data-testid="clear-unlocked-btn">
            <Eraser className="h-4 w-4" />
            <span>Limpar Células Não Travadas</span>
          </Button>
          <Button
            tone="secondary"
            onClick={onLoadSampleData}
            data-testid="load-sample-btn"
          >
            <Database className="h-4 w-4" />
            <span>Carregar Dados de Exemplo</span>
          </Button>
          <Button
            tone="outline"
            onClick={() => {
              setSwapInitial(null);
              setSwapOpen(true);
            }}
            disabled={state.employees.filter((e) => e.active).length < 2}
            data-testid="open-swap-modal-btn"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Trocar Turno</span>
          </Button>
          <Button
            tone={rulesOpen ? 'secondary' : 'outline'}
            onClick={() => setRulesOpen((prev) => !prev)}
            aria-expanded={rulesOpen}
            data-testid="toggle-rules-panel-btn"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Regras e Turnos</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTeams.length > 0 && (
            <SelectInput
              aria-label="Filtrar por equipe"
              value={effectiveTeamFilter ?? 'all'}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="h-8 w-auto text-xs"
              data-testid="schedule-team-filter"
            >
              <option value="all">Todas as equipes ({activeTeams.length})</option>
              {activeTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </SelectInput>
          )}

          <div
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
            role="group"
            aria-label="Modo de visualização da grade"
          >
            <button
              type="button"
              onClick={() => setViewMode('employee')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'employee'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Por Colaborador</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('shift')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'shift'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Por Turno</span>
            </button>
          </div>
        </div>
      </div>

      {rulesOpen && (
        <ScheduleRulesPanel
          rules={getScheduleRules(state)}
          shifts={state.shifts}
          onChange={onUpdateScheduleRules}
        />
      )}

      {swapFeedback && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-900"
        >
          <span>{swapFeedback}</span>
          <button
            type="button"
            onClick={() => setSwapFeedback(null)}
            className="font-medium underline"
          >
            Fechar
          </button>
        </div>
      )}

      {blockingOrWarningIssues.length > 0 && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950"
          data-testid="schedule-alerts"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span>Alertas de Regras ({blockingOrWarningIssues.length})</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockingOrWarningIssues.map((issue, idx) => (
              <li key={`${issue.code}-${idx}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {viewMode === 'employee' ? (
        <GridByEmployee
          state={state}
          week={week}
          issues={filteredIssues}
          teamIdFilter={effectiveTeamFilter}
          onCellChange={handleCellChange}
          onDragSwapRequest={handleDragSwapRequest}
        />
      ) : (
        <GridByShift state={state} week={week} teamIdFilter={effectiveTeamFilter} />
      )}

      {infoIssues.length > 0 && Object.keys(week.assignments).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600">
          <span className="font-medium text-slate-800">
            Cobertura abaixo da meta em {infoIssues.length} faixa(s):
          </span>{' '}
          {infoIssues
            .slice(0, 4)
            .map((i) => i.message)
            .join(' · ')}
          {infoIssues.length > 4 ? ` (+${infoIssues.length - 4})` : ''}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityPanel
            monthLabel={monthLabel}
            summaries={equitySummaries}
            teams={state.teams}
            teamIdFilter={effectiveTeamFilter}
          />
        </div>

        <section
          aria-label="Histórico de Trocas da Semana"
          className="rounded-lg border border-slate-200 bg-white p-4"
          data-testid="swap-history-panel"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="h-4 w-4 text-slate-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Histórico de Trocas da Semana
              </h2>
              <p className="text-xs text-slate-500">Permutas e exceções registradas</p>
            </div>
          </div>

          {(week.swaps ?? []).length === 0 ? (
            <p className="py-4 text-xs text-slate-500">
              Nenhuma troca realizada nesta semana. Arraste células ou clique em Trocar Turno.
            </p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2.5 overflow-y-auto pr-1 text-xs">
              {week.swaps.map((swap) => (
                <li
                  key={swap.id}
                  className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{swap.summary}</p>
                    {swap.approvedException && <Badge tone="warn">Exceção</Badge>}
                  </div>
                  {swap.reason && <p className="mt-1 text-slate-600">Obs.: {swap.reason}</p>}
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    {new Date(swap.timestamp).toLocaleString('pt-BR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <SwapModal
        open={swapOpen}
        onOpenChange={setSwapOpen}
        state={state}
        week={week}
        initialSelection={swapInitial}
        onConfirmSwap={handleConfirmSwapModal}
      />
    </div>
  );
}
