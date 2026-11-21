import { FileText, Pin } from 'lucide-react';
import { formatWeekRangeBr } from '@/domain/dates';
import { FieldLabel, TextArea } from '@/components/ui/form-controls';

export interface NotesWorkspaceProps {
  weekStart: string;
  weekNote: string;
  pinnedNotes: string;
  onWeekNoteChange: (value: string) => void;
  onPinnedNotesChange: (value: string) => void;
}

export function NotesWorkspace({
  weekStart,
  weekNote,
  pinnedNotes,
  onWeekNoteChange,
  onPinnedNotesChange,
}: NotesWorkspaceProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileText className="h-4 w-4 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Anotações da Semana ({formatWeekRangeBr(weekStart)})
            </h2>
            <p className="text-xs text-slate-500">
              Combinados, justificativas e observações incluídas nas exportações desta semana.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <FieldLabel htmlFor="weekly-note-textarea">Observações da semana exibida</FieldLabel>
          <TextArea
            id="weekly-note-textarea"
            value={weekNote}
            onChange={(e) => onWeekNoteChange(e.target.value)}
            placeholder="Ex.: Feriado na quinta com escala especial; Camila troca turno com Rafael na terça..."
            className="min-h-[200px]"
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Pin className="h-4 w-4 text-emerald-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Notas Fixas (Gerais)</h2>
            <p className="text-xs text-slate-500">
              Orientações permanentes da equipe preservadas entre todas as semanas.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <FieldLabel htmlFor="pinned-notes-textarea">Regras e recados fixos</FieldLabel>
          <TextArea
            id="pinned-notes-textarea"
            value={pinnedNotes}
            onChange={(e) => onPinnedNotesChange(e.target.value)}
            placeholder="Ex.: Tolerância de ponto, contatos de emergência, orientações de abertura e fechamento..."
            className="min-h-[200px]"
          />
        </div>
      </section>
    </div>
  );
}
