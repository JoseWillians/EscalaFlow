import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, ShieldCheck } from 'lucide-react';
import type { Team } from '@/domain/schemas';
import type { EmployeeEquitySummary } from '@/engine/equity';
import { Badge } from '@/components/ui/badge';

export interface EquityPanelProps {
  monthLabel: string;
  summaries: EmployeeEquitySummary[];
  teams: Team[];
  teamIdFilter?: string;
}

export function EquityPanel({ monthLabel, summaries, teams, teamIdFilter }: EquityPanelProps) {
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});
  const filteredSummaries = teamIdFilter
    ? summaries.filter((s) => s.teamId === teamIdFilter)
    : summaries;
  const pendingVeterans = filteredSummaries.filter((s) => s.nightShiftStatus === 'pending').length;

  const teamSections = teams
    .filter((t) => t.active && (!teamIdFilter || t.id === teamIdFilter))
    .map((team) => ({
      id: team.id,
      name: team.name,
      items: filteredSummaries.filter((s) => s.teamId === team.id),
    }))
    .filter((sec) => sec.items.length > 0);

  const fallbackSections =
    teamSections.length > 0
      ? teamSections
      : filteredSummaries.length > 0
        ? [{ id: 'default', name: 'Equipe', items: filteredSummaries }]
        : [];

  return (
    <section
      aria-label="Equidade do Mês"
      className="rounded-lg border border-slate-200 bg-white p-4"
      data-testid="equity-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Equidade do Mês</h2>
          <p className="text-xs text-slate-500">
            Rodízio 12h–22h e domingos em {monthLabel}
          </p>
        </div>
        {pendingVeterans > 0 ? (
          <Badge tone="warn">
            <Clock3 className="h-3 w-3" />
            <span>{pendingVeterans} pendente(s) no 12h–22h</span>
          </Badge>
        ) : (
          <Badge tone="ok">
            <CheckCircle2 className="h-3 w-3" />
            <span>Rodízio 12h–22h completo</span>
          </Badge>
        )}
      </div>

      {fallbackSections.length === 0 ? (
        <p className="py-4 text-xs text-slate-500">
          Cadastre equipes e colaboradores ativos para acompanhar a equidade mensal.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {fallbackSections.map((section) => {
            const isExpanded = !collapsedTeams[section.id];
            return (
              <div key={section.id} className="overflow-x-auto rounded-md border border-slate-100">
                {fallbackSections.length > 1 && (
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setCollapsedTeams((prev) => ({
                        ...prev,
                        [section.id]: !prev[section.id],
                      }))
                    }
                    className="flex w-full items-center justify-between bg-slate-50/80 px-2.5 py-1.5 text-left text-xs font-semibold text-blue-800 hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <span>{section.name}</span>
                    </span>
                    <span className="font-mono text-[11px] font-normal text-slate-500">
                      {section.items.length} pessoa(s)
                    </span>
                  </button>
                )}

                {isExpanded && (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="px-2 py-1.5 font-medium">Colaborador</th>
                        <th className="px-2 py-1.5 text-center font-medium">12h–22h</th>
                        <th className="px-2 py-1.5 text-center font-medium">Dom.</th>
                        <th className="px-2 py-1.5 text-center font-medium">Folga (Dom.)</th>
                        <th className="px-2 py-1.5 text-right font-medium">Status 12h–22h</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {section.items.map((item) => (
                        <tr key={item.employeeId} className="hover:bg-slate-50/70">
                          <td className="px-2 py-2 font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.isBeginner && <Badge tone="beginner">Iniciante</Badge>}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-700">
                            {item.nightShiftCount}
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-700">
                            {item.sundayCount}
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-700">
                            {item.compOffCount}
                          </td>
                          <td className="px-2 py-2 text-right">
                            {item.nightShiftStatus === 'exempt' && (
                              <Badge tone="neutral">
                                <ShieldCheck className="h-3 w-3" />
                                <span>Restrito</span>
                              </Badge>
                            )}
                            {item.nightShiftStatus === 'ok' && (
                              <Badge tone="ok">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Cumprido</span>
                              </Badge>
                            )}
                            {item.nightShiftStatus === 'pending' && (
                              <Badge tone="warn">
                                <Clock3 className="h-3 w-3" />
                                <span>Pendente</span>
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
