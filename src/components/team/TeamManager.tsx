import { useState, type FormEvent } from 'react';
import {
  CalendarOff,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Layers,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { formatShortDateBr, getTodayIsoDate } from '@/domain/dates';
import {
  UNAVAILABILITY_LABELS,
  type AppState,
  type Employee,
  type Team,
  type Unavailability,
  type UnavailabilityType,
} from '@/domain/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/form-controls';
import { SwitchControl } from '@/components/ui/switch-control';

export interface TeamManagerProps {
  state: AppState;
  onUpdateTeams: (teams: Team[]) => void;
  onUpdateEmployees: (employees: Employee[]) => void;
  onUpdateUnavailabilities: (unavailabilities: Unavailability[]) => void;
}

interface TeamSectionCardProps {
  team: Team;
  employees: Employee[];
  expanded: boolean;
  onToggleExpand: (teamId: string) => void;
  onToggleTeamActive: (teamId: string, active: boolean) => void;
  onDeleteTeam: (teamId: string) => void;
  onAddEmployee: (teamId: string, name: string, role: string, isBeginner: boolean) => void;
  onToggleBeginner: (empId: string, isBeginner: boolean) => void;
  onToggleEmployeeActive: (empId: string, active: boolean) => void;
  onDeleteEmployee: (empId: string) => void;
}

function TeamSectionCard({
  team,
  employees,
  expanded,
  onToggleExpand,
  onToggleTeamActive,
  onDeleteTeam,
  onAddEmployee,
  onToggleBeginner,
  onToggleEmployeeActive,
  onDeleteEmployee,
}: TeamSectionCardProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isBeginner, setIsBeginner] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddEmployee(team.id, trimmed, role.trim(), isBeginner);
    setName('');
    setRole('');
    setIsBeginner(false);
  };

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white"
      data-testid={`team-section-${team.id}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
          expanded ? 'border-b border-slate-100' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleExpand(team.id)}
          aria-expanded={expanded}
          data-testid={`toggle-team-collapse-${team.id}`}
          className="flex flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{team.name}</h3>
              <Badge tone="neutral">{employees.length} membro(s)</Badge>
              {!team.active && <Badge tone="warn">Equipe inativa</Badge>}
            </div>
            {team.description && <p className="text-xs text-slate-500">{team.description}</p>}
          </div>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <SwitchControl
              id={`team-act-${team.id}`}
              checked={team.active}
              onCheckedChange={(checked) => onToggleTeamActive(team.id, checked)}
              ariaLabel={`Ativar ou inativar equipe ${team.name}`}
            />
            <label htmlFor={`team-act-${team.id}`} className="text-xs text-slate-700">
              Ativa
            </label>
          </div>
          <Button
            tone="ghost"
            size="icon"
            aria-label={`Excluir equipe ${team.name}`}
            onClick={() => onDeleteTeam(team.id)}
            className="text-slate-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 pt-3">
          <form
            onSubmit={handleSubmit}
            className="grid gap-2.5 rounded-md border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-5">
              <FieldLabel htmlFor={`emp-name-${team.id}`}>Nome do colaborador</FieldLabel>
              <TextInput
                id={`emp-name-${team.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Mariana Azevedo"
                required
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-4">
              <FieldLabel htmlFor={`emp-role-${team.id}`}>Função</FieldLabel>
              <TextInput
                id={`emp-role-${team.id}`}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex.: Atendimento"
                className="mt-1"
              />
            </div>
            <div className="flex items-end sm:col-span-3">
              <Button
                type="submit"
                tone="primary"
                size="md"
                className="w-full"
                data-testid={`add-employee-btn-${team.id}`}
              >
                <UserPlus className="h-4 w-4" />
                <span>Adicionar</span>
              </Button>
            </div>
            <div className="flex items-center gap-2 sm:col-span-12">
              <SwitchControl
                id={`new-beg-${team.id}`}
                checked={isBeginner}
                onCheckedChange={setIsBeginner}
                ariaLabel={`Marcar novo colaborador de ${team.name} como Iniciante`}
              />
              <label htmlFor={`new-beg-${team.id}`} className="text-xs text-slate-700">
                Marcar como <strong>Iniciante</strong> (bloqueia 12h–22h, domingos e feriados com expediente)
              </label>
            </div>
          </form>

          {employees.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-500">
              Nenhum colaborador nesta equipe. Adicione acima para começar.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {employees.map((emp) => (
                <li
                  key={emp.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          emp.active ? 'text-slate-900' : 'text-slate-400 line-through'
                        }`}
                      >
                        {emp.name}
                      </span>
                      {emp.isBeginner && <Badge tone="beginner">Iniciante</Badge>}
                      {!emp.active && <Badge tone="neutral">Inativo</Badge>}
                    </div>
                    {emp.role && <p className="text-xs text-slate-500">Função: {emp.role}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <SwitchControl
                        id={`beg-${emp.id}`}
                        checked={emp.isBeginner}
                        onCheckedChange={(checked) => onToggleBeginner(emp.id, checked)}
                        ariaLabel={`Alternar tag Iniciante para ${emp.name}`}
                      />
                      <label htmlFor={`beg-${emp.id}`} className="text-xs text-slate-700">
                        Iniciante
                      </label>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <SwitchControl
                        id={`act-${emp.id}`}
                        checked={emp.active}
                        onCheckedChange={(checked) => onToggleEmployeeActive(emp.id, checked)}
                        ariaLabel={`Ativar ou inativar ${emp.name}`}
                      />
                      <label htmlFor={`act-${emp.id}`} className="text-xs text-slate-700">
                        Ativo
                      </label>
                    </div>

                    <Button
                      tone="ghost"
                      size="icon"
                      aria-label={`Excluir ${emp.name}`}
                      onClick={() => onDeleteEmployee(emp.id)}
                      className="text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function TeamManager({
  state,
  onUpdateTeams,
  onUpdateEmployees,
  onUpdateUnavailabilities,
}: TeamManagerProps) {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});

  const [unavailEmpId, setUnavailEmpId] = useState(state.employees[0]?.id ?? '');
  const [unavailStart, setUnavailStart] = useState(getTodayIsoDate());
  const [unavailEnd, setUnavailEnd] = useState(getTodayIsoDate());
  const [unavailType, setUnavailType] = useState<UnavailabilityType>('PRE_OFF');
  const [unavailNote, setUnavailNote] = useState('');

  const handleAddTeam = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = teamName.trim();
    if (!trimmed) return;
    const nextTeam: Team = {
      id: `team-${Date.now()}`,
      name: trimmed,
      description: teamDescription.trim() || undefined,
      active: true,
    };
    onUpdateTeams([...state.teams, nextTeam]);
    setTeamName('');
    setTeamDescription('');
  };

  const handleToggleTeamActive = (teamId: string, active: boolean) => {
    onUpdateTeams(state.teams.map((t) => (t.id === teamId ? { ...t, active } : t)));
  };

  const handleDeleteTeam = (teamId: string) => {
    const removedEmpIds = new Set(
      state.employees.filter((e) => e.teamId === teamId).map((e) => e.id),
    );
    onUpdateTeams(state.teams.filter((t) => t.id !== teamId));
    onUpdateEmployees(state.employees.filter((e) => e.teamId !== teamId));
    onUpdateUnavailabilities(state.unavailabilities.filter((u) => !removedEmpIds.has(u.employeeId)));
  };

  const handleAddEmployeeToTeam = (
    teamId: string,
    name: string,
    role: string,
    isBeginner: boolean,
  ) => {
    const next: Employee = {
      id: `emp-${Date.now()}`,
      name,
      teamId,
      role: role || undefined,
      isBeginner,
      active: true,
    };
    onUpdateEmployees([...state.employees, next]);
    if (!unavailEmpId) setUnavailEmpId(next.id);
  };

  const toggleBeginner = (id: string, checked: boolean) => {
    onUpdateEmployees(
      state.employees.map((emp) => (emp.id === id ? { ...emp, isBeginner: checked } : emp)),
    );
  };

  const toggleActive = (id: string, checked: boolean) => {
    onUpdateEmployees(
      state.employees.map((emp) => (emp.id === id ? { ...emp, active: checked } : emp)),
    );
  };

  const removeEmployee = (id: string) => {
    onUpdateEmployees(state.employees.filter((emp) => emp.id !== id));
    onUpdateUnavailabilities(state.unavailabilities.filter((u) => u.employeeId !== id));
  };

  const handleAddUnavailability = (e: FormEvent) => {
    e.preventDefault();
    const targetEmpId = unavailEmpId || state.employees[0]?.id;
    if (!targetEmpId || !unavailStart || !unavailEnd) return;
    const startDate = unavailStart <= unavailEnd ? unavailStart : unavailEnd;
    const endDate = unavailStart <= unavailEnd ? unavailEnd : unavailStart;
    const next: Unavailability = {
      id: `unav-${Date.now()}`,
      employeeId: targetEmpId,
      startDate,
      endDate,
      type: unavailType,
      note: unavailNote.trim() || undefined,
    };
    onUpdateUnavailabilities([...state.unavailabilities, next]);
    setUnavailNote('');
  };

  const toggleExpand = (teamId: string) => {
    setCollapsedTeams((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const setAllExpanded = (expanded: boolean) => {
    const next: Record<string, boolean> = {};
    for (const t of state.teams) {
      next[t.id] = !expanded;
    }
    setCollapsedTeams(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FolderPlus className="h-4 w-4 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Criar Nova Equipe</h2>
              <p className="text-xs text-slate-500">
                Crie primeiro a equipe para depois cadastrar os colaboradores e suas funções em cada sessão.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddTeam} className="mt-3 grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <FieldLabel htmlFor="team-name">Nome da equipe</FieldLabel>
              <TextInput
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ex.: Equipe Atendimento"
                required
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-4">
              <FieldLabel htmlFor="team-desc">Descrição (opcional)</FieldLabel>
              <TextInput
                id="team-desc"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="Ex.: Balcão e WhatsApp"
                className="mt-1"
              />
            </div>
            <div className="flex items-end sm:col-span-3">
              <Button type="submit" tone="primary" className="w-full" data-testid="add-team-btn">
                <Plus className="h-4 w-4" />
                <span>Criar equipe</span>
              </Button>
            </div>
          </form>
        </section>

        {state.teams.length > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button tone="outline" size="sm" onClick={() => setAllExpanded(true)}>
              Expandir todas
            </Button>
            <Button tone="outline" size="sm" onClick={() => setAllExpanded(false)}>
              Recolher todas
            </Button>
          </div>
        )}

        {state.teams.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-800">Nenhuma equipe criada ainda</p>
            <p className="mt-1 text-xs text-slate-500">
              Crie sua primeira equipe acima (ex.: Atendimento, Suporte) ou carregue os dados de exemplo na aba Grade Semanal.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {state.teams.map((team) => (
              <TeamSectionCard
                key={team.id}
                team={team}
                employees={state.employees.filter((e) => e.teamId === team.id)}
                expanded={!collapsedTeams[team.id]}
                onToggleExpand={toggleExpand}
                onToggleTeamActive={handleToggleTeamActive}
                onDeleteTeam={handleDeleteTeam}
                onAddEmployee={handleAddEmployeeToTeam}
                onToggleBeginner={toggleBeginner}
                onToggleEmployeeActive={toggleActive}
                onDeleteEmployee={removeEmployee}
              />
            ))}
          </div>
        )}
      </div>

      <section className="h-fit rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <CalendarOff className="h-4 w-4 text-amber-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Indisponibilidades Pontuais</h2>
            <p className="text-xs text-slate-500">Férias, atestados e folgas pré-combinadas</p>
          </div>
        </div>

        <form onSubmit={handleAddUnavailability} className="mt-3 space-y-3">
          <div>
            <FieldLabel htmlFor="unav-emp">Colaborador</FieldLabel>
            <SelectInput
              id="unav-emp"
              value={unavailEmpId || state.employees[0]?.id || ''}
              onChange={(e) => setUnavailEmpId(e.target.value)}
              className="mt-1"
              disabled={state.employees.length === 0}
            >
              {state.teams.map((team) => {
                const members = state.employees.filter((e) => e.teamId === team.id);
                if (members.length === 0) return null;
                return (
                  <optgroup key={team.id} label={team.name}>
                    {members.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </SelectInput>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel htmlFor="unav-start">Início</FieldLabel>
              <TextInput
                id="unav-start"
                type="date"
                value={unavailStart}
                onChange={(e) => setUnavailStart(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="unav-end">Fim</FieldLabel>
              <TextInput
                id="unav-end"
                type="date"
                value={unavailEnd}
                onChange={(e) => setUnavailEnd(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="unav-type">Motivo</FieldLabel>
            <SelectInput
              id="unav-type"
              value={unavailType}
              onChange={(e) => setUnavailType(e.target.value as UnavailabilityType)}
              className="mt-1"
            >
              <option value="VACATION">Férias</option>
              <option value="SICK_LEAVE">Atestado</option>
              <option value="PRE_OFF">Folga combinada</option>
            </SelectInput>
          </div>

          <div>
            <FieldLabel htmlFor="unav-note">Observação (opcional)</FieldLabel>
            <TextInput
              id="unav-note"
              value={unavailNote}
              onChange={(e) => setUnavailNote(e.target.value)}
              placeholder="Detalhes do afastamento"
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            tone="outline"
            className="w-full"
            disabled={state.employees.length === 0}
          >
            <Plus className="h-4 w-4" />
            <span>Registrar indisponibilidade</span>
          </Button>
        </form>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold text-slate-700">Registros ativos</h3>
          {state.unavailabilities.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Nenhuma indisponibilidade lançada.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {state.unavailabilities.map((u) => {
                const emp = state.employees.find((e) => e.id === u.employeeId);
                return (
                  <li
                    key={u.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {emp?.name ?? 'Colaborador'} · {UNAVAILABILITY_LABELS[u.type]}
                      </p>
                      <p className="font-mono text-[11px] text-slate-600">
                        {formatShortDateBr(u.startDate)}
                        {u.startDate !== u.endDate ? ` a ${formatShortDateBr(u.endDate)}` : ''}
                      </p>
                      {u.note && <p className="text-slate-500">{u.note}</p>}
                    </div>
                    <Button
                      tone="ghost"
                      size="icon"
                      aria-label="Remover indisponibilidade"
                      onClick={() =>
                        onUpdateUnavailabilities(
                          state.unavailabilities.filter((item) => item.id !== u.id),
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-red-600" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
