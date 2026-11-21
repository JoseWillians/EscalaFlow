import { useRef, type ChangeEvent, type ReactNode } from 'react';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';
import {
  formatMonthYearPt,
  formatWeekRangeBr,
  getWeekReferenceMonthKey,
} from '@/domain/dates';
import type { SundayCompMode } from '@/domain/schemas';
import { Button } from '@/components/ui/button';
import { SelectInput } from '@/components/ui/form-controls';
import { TabsNav, type TabItem } from '@/components/ui/tabs-nav';

export type MainTab = 'grade' | 'equipe' | 'config' | 'notas' | 'exportar';

export interface AppShellProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  weekStart: string;
  onPrevWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  sundayCompMode: SundayCompMode;
  onSundayCompModeChange: (mode: SundayCompMode) => void;
  activeEmployeesCount: number;
  onExportBackup: () => void;
  onImportBackupFile: (file: File) => void;
  statusBanner?: { tone: 'ok' | 'danger'; message: string } | null;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  weekStart,
  onPrevWeek,
  onCurrentWeek,
  onNextWeek,
  sundayCompMode,
  onSundayCompModeChange,
  activeEmployeesCount,
  onExportBackup,
  onImportBackupFile,
  statusBanner,
  children,
}: AppShellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const monthLabel = formatMonthYearPt(getWeekReferenceMonthKey(weekStart));
  const weekRangeLabel = formatWeekRangeBr(weekStart);

  const tabItems: TabItem[] = [
    { value: 'grade', label: 'Grade Semanal', icon: <CalendarDays className="h-4 w-4" /> },
    {
      value: 'equipe',
      label: 'Equipes',
      icon: <Users className="h-4 w-4" />,
      badge: activeEmployeesCount,
    },
    { value: 'config', label: 'Turnos e Feriados', icon: <SlidersHorizontal className="h-4 w-4" /> },
    { value: 'notas', label: 'Anotações', icon: <FileText className="h-4 w-4" /> },
    { value: 'exportar', label: 'Exportar', icon: <Share2 className="h-4 w-4" /> },
  ];

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackupFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-950">EscalaFlow</h1>
              <p className="text-xs text-slate-500">
                Gestão de turnos local-first · <span className="font-medium text-slate-700">{monthLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5"
              role="group"
              aria-label="Navegação de semanas"
            >
              <Button
                tone="ghost"
                size="icon"
                aria-label="Semana anterior"
                onClick={onPrevWeek}
                data-testid="prev-week-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span
                className="px-2.5 font-mono text-xs font-medium tabular-nums text-slate-800"
                data-testid="week-range-label"
              >
                {weekRangeLabel}
              </span>
              <Button
                tone="ghost"
                size="icon"
                aria-label="Próxima semana"
                onClick={onNextWeek}
                data-testid="next-week-btn"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button tone="outline" size="sm" onClick={onCurrentWeek} title="Ir para semana atual">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Hoje</span>
            </Button>

            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1">
              <label htmlFor="sunday-comp-mode" className="text-xs font-medium text-slate-600">
                Folga Dom.:
              </label>
              <SelectInput
                id="sunday-comp-mode"
                value={sundayCompMode}
                onChange={(e) => onSundayCompModeChange(e.target.value as SundayCompMode)}
                className="h-7 w-auto border-0 bg-transparent px-1 py-0 text-xs font-medium text-slate-900 focus:ring-0"
              >
                <option value="same_week">Mesma semana</option>
                <option value="next_week">Semana seguinte</option>
              </SelectInput>
            </div>

            <div className="flex items-center gap-1.5">
              <Button tone="outline" size="sm" onClick={onExportBackup} title="Exportar backup JSON">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Backup JSON</span>
              </Button>
              <Button
                tone="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title="Importar backup JSON"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Selecionar arquivo JSON de backup"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {statusBanner && (
          <div
            role="status"
            className={
              statusBanner.tone === 'ok'
                ? 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900'
                : 'mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900'
            }
          >
            {statusBanner.message}
          </div>
        )}

        <TabsNav value={activeTab} onValueChange={(val) => onTabChange(val as MainTab)} items={tabItems}>
          <div className="mt-5">{children}</div>
        </TabsNav>
      </main>
    </div>
  );
}
