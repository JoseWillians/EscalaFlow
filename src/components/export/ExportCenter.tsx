import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, FileSpreadsheet, Image as ImageIcon, MessageSquare } from 'lucide-react';
import type { AppState, WeekSchedule } from '@/domain/schemas';
import { downloadElementAsPng } from '@/exporters/png';
import { generateWhatsAppText, type WhatsAppGroupBy } from '@/exporters/whatsapp';
import { Button } from '@/components/ui/button';
import { SelectInput, TextArea } from '@/components/ui/form-controls';
import { PrintableScheduleCard } from './PrintableScheduleCard';

export interface ExportCenterProps {
  state: AppState;
  weekStart: string;
  week: WeekSchedule;
}

function slugifyTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ExportCenter({ state, weekStart, week }: ExportCenterProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [groupBy, setGroupBy] = useState<WhatsAppGroupBy>('day');
  const activeTeams = useMemo(() => state.teams.filter((t) => t.active), [state.teams]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    () => activeTeams[0]?.id ?? '',
  );
  const [includeNotes, setIncludeNotes] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const effectiveTeamId = useMemo(() => {
    if (activeTeams.length === 0) return undefined;
    if (activeTeams.some((t) => t.id === selectedTeamId)) return selectedTeamId;
    return activeTeams[0].id;
  }, [activeTeams, selectedTeamId]);

  const selectedTeam = useMemo(
    () => activeTeams.find((t) => t.id === effectiveTeamId),
    [activeTeams, effectiveTeamId],
  );

  const teamSlug = selectedTeam ? slugifyTeamName(selectedTeam.name) : '';

  const generatedMessage = useMemo(
    () =>
      generateWhatsAppText({
        state: {
          ...state,
          weeks: { ...state.weeks, [weekStart]: week },
        },
        weekStart,
        groupBy,
        includeNotes,
        teamIdFilter: effectiveTeamId,
      }),
    [state, weekStart, week, groupBy, includeNotes, effectiveTeamId],
  );

  const [editableMessage, setEditableMessage] = useState(generatedMessage);

  useEffect(() => {
    setEditableMessage(generatedMessage);
  }, [generatedMessage]);

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(editableMessage);
      setCopied(true);
      setExportFeedback('Mensagem copiada para a área de transferência.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setExportFeedback('Não foi possível copiar automaticamente; selecione o texto e copie.');
    }
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setPngBusy(true);
    const filename = teamSlug ? `escala-${teamSlug}-${weekStart}.png` : `escala-${weekStart}.png`;
    try {
      await downloadElementAsPng(cardRef.current, filename);
      setExportFeedback(`Imagem PNG gerada (${filename}).`);
    } catch {
      setExportFeedback('Falha ao gerar imagem PNG.');
    } finally {
      setPngBusy(false);
    }
  };

  const handleDownloadXlsx = async () => {
    setXlsxBusy(true);
    const filename = teamSlug ? `escala-${teamSlug}-${weekStart}.xlsx` : `escala-${weekStart}.xlsx`;
    try {
      const { downloadScheduleXlsx } = await import('@/exporters/excel');
      await downloadScheduleXlsx({
        state: {
          ...state,
          weeks: { ...state.weeks, [weekStart]: week },
        },
        weekStart,
        teamIdFilter: effectiveTeamId,
        fileNameSuffix: teamSlug || undefined,
      });
      setExportFeedback(`Planilha Excel gerada (${filename}).`);
    } catch {
      setExportFeedback('Falha ao gerar planilha Excel.');
    } finally {
      setXlsxBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {activeTeams.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">Equipe selecionada para exportação</p>
            <p className="text-[11px] text-slate-500">
              A mensagem WhatsApp, a planilha Excel (.xlsx) e a imagem PNG serão geradas exclusivamente para esta equipe.
            </p>
          </div>
          <SelectInput
            aria-label="Equipe para exportação"
            value={effectiveTeamId ?? ''}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="h-8 w-auto text-xs"
            data-testid="export-team-select"
          >
            {activeTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </SelectInput>
        </div>
      )}

      {exportFeedback && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-900"
          data-testid="export-feedback"
        >
          {exportFeedback}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Mensagem para WhatsApp</h2>
                <p className="text-xs text-slate-500">
                  Formatação nativa (*negrito*) editável antes de copiar
                </p>
              </div>
            </div>

            <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setGroupBy('day')}
                className={`rounded px-2.5 py-1 font-medium ${
                  groupBy === 'day' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600'
                }`}
              >
                Por dia
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('employee')}
                className={`rounded px-2.5 py-1 font-medium ${
                  groupBy === 'employee'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Por colaborador
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
              />
              <span>Incluir observações da semana e notas gerais</span>
            </label>

            <TextArea
              aria-label="Texto formatado para WhatsApp"
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              className="min-h-[280px] font-mono text-xs leading-relaxed"
              data-testid="whatsapp-textarea"
            />

            <Button
              tone="emerald"
              onClick={handleCopyWhatsApp}
              className="w-full"
              data-testid="copy-whatsapp-btn"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copiado para WhatsApp!' : 'Copiar para WhatsApp'}</span>
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">Arquivos para Download</h2>
            <p className="text-xs text-slate-500">
              Planilha Excel (.xlsx) e imagem PNG em alta resolução (2x) da equipe selecionada
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-semibold">Planilha Excel (.xlsx)</h3>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">
                2 abas formatadas: <em>Escala Semanal</em> (cores pastel, bordas, painéis congelados) e{' '}
                <em>Anotações e Trocas</em>.
              </p>
              <Button
                tone="primary"
                onClick={handleDownloadXlsx}
                disabled={xlsxBusy}
                className="mt-4 w-full"
                data-testid="export-xlsx-btn"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{xlsxBusy ? 'Gerando Excel...' : 'Baixar Excel (.xlsx)'}</span>
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <ImageIcon className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-semibold">Imagem PNG (2x)</h3>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">
                Cartão limpo de alta resolução otimizado para leitura rápida no celular e envio em grupos.
              </p>
              <Button
                tone="outline"
                onClick={handleDownloadPng}
                disabled={pngBusy}
                className="mt-4 w-full"
                data-testid="export-png-btn"
              >
                <ImageIcon className="h-4 w-4" />
                <span>{pngBusy ? 'Gerando PNG...' : 'Baixar Imagem (PNG)'}</span>
              </Button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-700">
              Pré-visualização do cartão PNG (role horizontalmente se necessário)
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-3">
              <PrintableScheduleCard
                ref={cardRef}
                state={{
                  ...state,
                  weeks: { ...state.weeks, [weekStart]: week },
                }}
                weekStart={weekStart}
                week={week}
                teamIdFilter={effectiveTeamId}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
