import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, getTodayIsoDate, getWeekStartMonday } from '@/domain/dates';
import type {
  AppState,
  Employee,
  Holiday,
  ScheduleRules,
  ShiftTemplate,
  SundayCompMode,
  Team,
  Unavailability,
  WeekSchedule,
} from '@/domain/schemas';
import { createSampleState } from '@/domain/seed';
import { clearUnlockedCells, generateWeekSchedule } from '@/engine/scheduler';
import {
  exportBackupJson,
  importBackupJson,
  loadState,
  saveState,
} from '@/storage/repository';
import { ShiftsAndHolidays } from '@/components/config/ShiftsAndHolidays';
import { ExportCenter } from '@/components/export/ExportCenter';
import { AppShell, type MainTab } from '@/components/layout/AppShell';
import { NotesWorkspace } from '@/components/notes/NotesWorkspace';
import { ScheduleWorkspace } from '@/components/schedule/ScheduleWorkspace';
import { TeamManager } from '@/components/team/TeamManager';
import { TabPanel } from '@/components/ui/tabs-nav';

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const generationNonceRef = useRef(0);
  const [weekStart, setWeekStart] = useState<string>(() =>
    getWeekStartMonday(getTodayIsoDate()),
  );
  const [activeTab, setActiveTab] = useState<MainTab>('grade');
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'ok' | 'danger';
    message: string;
  } | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const currentWeek: WeekSchedule = useMemo(
    () =>
      state.weeks[weekStart] ?? {
        weekStart,
        assignments: {},
        note: '',
        swaps: [],
      },
    [state.weeks, weekStart],
  );

  const updateCurrentWeek = (nextWeek: WeekSchedule) => {
    setState((prev) => ({
      ...prev,
      weeks: {
        ...prev.weeks,
        [weekStart]: nextWeek,
      },
    }));
  };

  const handleGenerateWeek = () => {
    const previousSerialized = JSON.stringify(currentWeek.assignments);
    const baseSeed = ((++generationNonceRef.current * 2654435761) ^ (Date.now() & 0xfffffff)) >>> 0;

    let generated = generateWeekSchedule({
      state,
      weekStart,
      existingWeek: currentWeek,
      seed: baseSeed,
    });

    for (let offset = 1; offset <= 4; offset += 1) {
      if (JSON.stringify(generated.assignments) !== previousSerialized) break;
      generated = generateWeekSchedule({
        state,
        weekStart,
        existingWeek: currentWeek,
        seed: (baseSeed + offset) >>> 0,
      });
    }

    updateCurrentWeek(generated);
    setStatusBanner({
      tone: 'ok',
      message: 'Escala semanal gerada com respeito às travas, iniciantes e equidade mensal.',
    });
  };

  const handleClearUnlocked = () => {
    const cleared = clearUnlockedCells({
      state,
      weekStart,
      existingWeek: currentWeek,
    });
    updateCurrentWeek(cleared);
    setStatusBanner({
      tone: 'ok',
      message: 'Células não travadas foram limpas (travas manuais e feriados preservados).',
    });
  };

  const handleLoadSampleData = () => {
    const sample = createSampleState(weekStart);
    const generated = generateWeekSchedule({
      state: sample,
      weekStart,
      existingWeek: sample.weeks[weekStart],
      seed: ++generationNonceRef.current,
    });
    setState({
      ...sample,
      weeks: {
        ...sample.weeks,
        [weekStart]: generated,
      },
    });
    setStatusBanner({
      tone: 'ok',
      message: 'Dados de exemplo carregados (2 equipes, 10 colaboradores sendo 2 iniciantes) e escala inicial gerada.',
    });
  };

  const handleSundayCompModeChange = (mode: SundayCompMode) => {
    setState((prev) => ({
      ...prev,
      sundayCompMode: mode,
    }));
  };

  const handleUpdateTeams = (teams: Team[]) => {
    setState((prev) => ({ ...prev, teams }));
  };

  const handleUpdateEmployees = (employees: Employee[]) => {
    setState((prev) => ({ ...prev, employees }));
  };

  const handleUpdateUnavailabilities = (unavailabilities: Unavailability[]) => {
    setState((prev) => ({ ...prev, unavailabilities }));
  };

  const handleUpdateShifts = (shifts: ShiftTemplate[]) => {
    setState((prev) => ({ ...prev, shifts }));
  };

  const handleUpdateHolidays = (holidays: Record<string, Holiday>) => {
    setState((prev) => ({ ...prev, holidays }));
  };

  const handleUpdateScheduleRules = (scheduleRules: ScheduleRules) => {
    setState((prev) => ({ ...prev, scheduleRules }));
  };

  const handleUpdateTeamRulesOverride = (
    teamId: string,
    rulesOverride: Partial<ScheduleRules> | undefined,
  ) => {
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) =>
        t.id === teamId ? { ...t, rulesOverride } : t,
      ),
    }));
  };

  const handleExportBackup = () => {
    const json = exportBackupJson(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `escalaflow-backup-${getTodayIsoDate()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusBanner({ tone: 'ok', message: 'Backup JSON exportado com sucesso.' });
  };

  const handleImportBackupFile = async (file: File) => {
    try {
      const content = await file.text();
      const result = importBackupJson(content);
      if (!result.ok) {
        setStatusBanner({ tone: 'danger', message: result.error });
        return;
      }
      setState(result.state);
      setStatusBanner({
        tone: 'ok',
        message: 'Backup JSON restaurado e validado com sucesso.',
      });
    } catch {
      setStatusBanner({
        tone: 'danger',
        message: 'Erro ao ler o arquivo selecionado.',
      });
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      weekStart={weekStart}
      onPrevWeek={() => setWeekStart((prev) => addDays(prev, -7))}
      onCurrentWeek={() => setWeekStart(getWeekStartMonday(getTodayIsoDate()))}
      onNextWeek={() => setWeekStart((prev) => addDays(prev, 7))}
      sundayCompMode={state.sundayCompMode}
      onSundayCompModeChange={handleSundayCompModeChange}
      activeEmployeesCount={state.employees.filter((e) => e.active).length}
      onExportBackup={handleExportBackup}
      onImportBackupFile={handleImportBackupFile}
      statusBanner={statusBanner}
    >
      <TabPanel value="grade">
        <ScheduleWorkspace
          state={state}
          weekStart={weekStart}
          week={currentWeek}
          onGenerateWeek={handleGenerateWeek}
          onClearUnlocked={handleClearUnlocked}
          onLoadSampleData={handleLoadSampleData}
          onUpdateWeek={updateCurrentWeek}
          onUpdateScheduleRules={handleUpdateScheduleRules}
          onUpdateTeamRulesOverride={handleUpdateTeamRulesOverride}
        />
      </TabPanel>

      <TabPanel value="equipe">
        <TeamManager
          state={state}
          onUpdateTeams={handleUpdateTeams}
          onUpdateEmployees={handleUpdateEmployees}
          onUpdateUnavailabilities={handleUpdateUnavailabilities}
        />
      </TabPanel>

      <TabPanel value="config">
        <ShiftsAndHolidays
          state={state}
          onUpdateShifts={handleUpdateShifts}
          onUpdateHolidays={handleUpdateHolidays}
        />
      </TabPanel>

      <TabPanel value="notas">
        <NotesWorkspace
          weekStart={weekStart}
          weekNote={currentWeek.note}
          pinnedNotes={state.pinnedNotes}
          onWeekNoteChange={(note) => updateCurrentWeek({ ...currentWeek, note })}
          onPinnedNotesChange={(pinnedNotes) => setState((prev) => ({ ...prev, pinnedNotes }))}
        />
      </TabPanel>

      <TabPanel value="exportar">
        <ExportCenter state={state} weekStart={weekStart} week={currentWeek} />
      </TabPanel>
    </AppShell>
  );
}

export default App;
