import ExcelJS from 'exceljs';
import {
  formatMonthYearPt,
  formatShortDateBr,
  formatWeekRangeBr,
  getWeekDays,
  getWeekReferenceMonthKey,
  getWeekdayShortPt,
} from '@/domain/dates';
import {
  UNAVAILABILITY_LABELS,
  type AppState,
  type CellAssignment,
  type ShiftTemplate,
} from '@/domain/schemas';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

function getCellVisual(
  cell: CellAssignment | undefined,
  shiftsById: Map<string, ShiftTemplate>,
  holidayName?: string,
): { text: string; fillArgb: string; fontColorArgb: string; bold: boolean } {
  if (!cell || cell.kind === 'OFF') {
    return {
      text: 'Folga',
      fillArgb: 'FFF1F5F9',
      fontColorArgb: 'FF475569',
      bold: false,
    };
  }
  if (cell.kind === 'COMP_OFF') {
    return {
      text: 'Folga (Dom.)',
      fillArgb: 'FFCCFBF1',
      fontColorArgb: 'FF115E59',
      bold: true,
    };
  }
  if (cell.kind === 'HOLIDAY_OFF') {
    return {
      text: holidayName ? `Feriado: ${holidayName}` : 'Feriado (Folga)',
      fillArgb: 'FFFFE4E6',
      fontColorArgb: 'FF9F1239',
      bold: true,
    };
  }
  if (cell.kind === 'UNAVAILABLE') {
    const label = cell.unavailabilityType
      ? UNAVAILABILITY_LABELS[cell.unavailabilityType]
      : 'Indisponível';
    return {
      text: label,
      fillArgb: 'FFFEF9C3',
      fontColorArgb: 'FF854D0E',
      bold: true,
    };
  }

  const shift = cell.shiftId ? shiftsById.get(cell.shiftId) : undefined;
  if (!shift) {
    return {
      text: 'Turno',
      fillArgb: 'FFE2E8F0',
      fontColorArgb: 'FF0F172A',
      bold: false,
    };
  }

  const breakInfo =
    shift.breakDurationMinutes > 0
      ? shift.breakWindow
        ? `\nInt: ${shift.breakWindow}`
        : `\nInt: ${shift.breakDurationMinutes}min`
      : '\nSem intervalo';

  return {
    text: `${shift.name}${breakInfo}`,
    fillArgb: hexToArgb(shift.color),
    fontColorArgb: 'FF0F172A',
    bold: shift.isNightShift,
  };
}

function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 15, maxWidth = 34): void {
  worksheet.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const raw = String(cell.value ?? '');
      const longestLine = raw
        .split('\n')
        .reduce((acc, line) => Math.max(acc, line.length), 0);
      if (longestLine + 4 > maxLen) {
        maxLen = longestLine + 4;
      }
    });
    column.width = Math.min(maxWidth, maxLen);
  });
}

export async function buildScheduleWorkbook(params: {
  state: AppState;
  weekStart: string;
  teamIdFilter?: string;
}): Promise<ExcelJS.Workbook> {
  const { state, weekStart, teamIdFilter } = params;
  const days = getWeekDays(weekStart);
  const week = state.weeks[weekStart];
  const shiftsById = new Map(state.shifts.map((s) => [s.id, s]));
  const employeesById = new Map(state.employees.map((e) => [e.id, e]));

  const activeTeams = state.teams.filter(
    (t) => t.active && (!teamIdFilter || t.id === teamIdFilter),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EscalaFlow';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Escala Semanal', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }],
  });

  const periodLabel = formatWeekRangeBr(weekStart);
  const monthLabel = formatMonthYearPt(getWeekReferenceMonthKey(weekStart));

  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Escala Semanal (${periodLabel})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  const holidaysInWeek = days
    .map((d) => ({ d, h: state.holidays[d] }))
    .filter((item): item is { d: string; h: NonNullable<typeof item.h> } => Boolean(item.h));

  sheet.mergeCells('A2:H2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value =
    holidaysInWeek.length > 0
      ? `Referência: ${monthLabel} | Feriados: ${holidaysInWeek
          .map((x) => `${formatShortDateBr(x.d)} (${x.h.name || 'Feriado'})`)
          .join(', ')}`
      : `Referência: ${monthLabel}`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  const headers = [
    'Colaborador',
    ...days.map((d) => {
      const h = state.holidays[d];
      const base = `${getWeekdayShortPt(d)} ${formatShortDateBr(d)}`;
      return h ? `${base}\n(${h.name || 'Feriado'})` : base;
    }),
  ];

  const headerRow = sheet.getRow(4);
  headerRow.height = 28;
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });

  const sections =
    activeTeams.length > 0
      ? activeTeams.map((t) => ({
          teamName: t.name,
          employees: state.employees.filter((e) => e.active && e.teamId === t.id),
        }))
      : [
          {
            teamName: 'Equipe',
            employees: state.employees.filter((e) => e.active),
          },
        ];

  let currentRowIdx = 5;
  for (const section of sections) {
    if (section.employees.length === 0) continue;

    sheet.mergeCells(`A${currentRowIdx}:H${currentRowIdx}`);
    const secCell = sheet.getCell(`A${currentRowIdx}`);
    secCell.value = section.teamName;
    secCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    secCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(currentRowIdx).height = 22;
    currentRowIdx += 1;

    for (const emp of section.employees) {
      const row = sheet.getRow(currentRowIdx);
      row.height = 34;

      const nameCell = row.getCell(1);
      const roleSuffix = emp.role ? `\n${emp.role}` : '';
      const begSuffix = emp.isBeginner ? ' (Iniciante)' : '';
      nameCell.value = `${emp.name}${begSuffix}${roleSuffix}`;
      nameCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      nameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      nameCell.border = THIN_BORDER;

      days.forEach((date, dayIdx) => {
        const assignment = week?.assignments[emp.id]?.[date];
        const holiday = state.holidays[date];
        const visual = getCellVisual(assignment, shiftsById, holiday?.name);
        const cell = row.getCell(2 + dayIdx);
        cell.value = visual.text;
        cell.font = {
          name: 'Calibri',
          size: 9.5,
          bold: visual.bold,
          color: { argb: visual.fontColorArgb },
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: visual.fillArgb } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
      });

      currentRowIdx += 1;
    }
  }

  autoFitColumns(sheet, 16, 30);
  sheet.getColumn(1).width = 28;

  const notesSheet = workbook.addWorksheet('Anotações e Trocas');
  notesSheet.mergeCells('A1:D1');
  const notesTitle = notesSheet.getCell('A1');
  notesTitle.value = `Anotações, Feriados e Trocas (${periodLabel})`;
  notesTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  notesTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  notesTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  notesSheet.getRow(1).height = 26;

  notesSheet.getCell('A3').value = 'Anotações da Semana';
  notesSheet.getCell('A3').font = { bold: true, size: 11 };
  notesSheet.mergeCells('A4:D4');
  notesSheet.getCell('A4').value = week?.note?.trim() || 'Sem anotações registradas nesta semana.';
  notesSheet.getCell('A4').alignment = { wrapText: true, vertical: 'top' };
  notesSheet.getRow(4).height = 40;

  notesSheet.getCell('A6').value = 'Notas Fixas (Gerais)';
  notesSheet.getCell('A6').font = { bold: true, size: 11 };
  notesSheet.mergeCells('A7:D7');
  notesSheet.getCell('A7').value = state.pinnedNotes.trim() || 'Sem notas gerais fixas.';
  notesSheet.getCell('A7').alignment = { wrapText: true, vertical: 'top' };
  notesSheet.getRow(7).height = 36;

  notesSheet.getCell('A9').value = 'Feriados da Semana';
  notesSheet.getCell('A9').font = { bold: true, size: 11 };
  if (holidaysInWeek.length === 0) {
    notesSheet.getCell('A10').value = 'Nenhum feriado configurado nesta semana.';
  } else {
    holidaysInWeek.forEach((item, i) => {
      const row = notesSheet.getRow(10 + i);
      row.getCell(1).value = formatShortDateBr(item.d);
      row.getCell(2).value = item.h.name || 'Feriado';
      row.getCell(3).value =
        item.h.mode === 'off_all' ? 'Folga Geral' : 'Expediente Especial';
    });
  }

  const swapHeaderRowIdx = 12 + Math.max(1, holidaysInWeek.length);
  notesSheet.getCell(`A${swapHeaderRowIdx}`).value = 'Histórico de Trocas da Semana';
  notesSheet.getCell(`A${swapHeaderRowIdx}`).font = { bold: true, size: 11 };

  const swapTableHeader = notesSheet.getRow(swapHeaderRowIdx + 1);
  ['Data/Hora', 'Permuta', 'Observação', 'Exceção Autorizada'].forEach((title, idx) => {
    const cell = swapTableHeader.getCell(idx + 1);
    cell.value = title;
    cell.font = { bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const swaps = week?.swaps ?? [];
  if (swaps.length === 0) {
    const emptyRow = notesSheet.getRow(swapHeaderRowIdx + 2);
    emptyRow.getCell(1).value = 'Nenhuma troca registrada nesta semana.';
  } else {
    swaps.forEach((swap, idx) => {
      const row = notesSheet.getRow(swapHeaderRowIdx + 2 + idx);
      const empA = employeesById.get(swap.employeeIdA)?.name ?? swap.employeeIdA;
      const empB = employeesById.get(swap.employeeIdB)?.name ?? swap.employeeIdB;
      row.getCell(1).value = new Date(swap.timestamp).toLocaleString('pt-BR');
      row.getCell(2).value = swap.summary || `${empA} <-> ${empB}`;
      row.getCell(3).value = swap.reason || '-';
      row.getCell(4).value = swap.approvedException
        ? `Sim (${swap.warnings.join('; ')})`
        : 'Não';
      for (let c = 1; c <= 4; c += 1) {
        row.getCell(c).border = THIN_BORDER;
        row.getCell(c).alignment = { wrapText: true, vertical: 'middle' };
      }
    });
  }

  autoFitColumns(notesSheet, 18, 42);
  return workbook;
}

export async function exportScheduleToXlsxBuffer(params: {
  state: AppState;
  weekStart: string;
  teamIdFilter?: string;
}): Promise<Uint8Array> {
  const workbook = await buildScheduleWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer({
    useSharedStrings: true,
    useStyles: true,
  });
  return new Uint8Array(buffer);
}

export async function downloadScheduleXlsx(params: {
  state: AppState;
  weekStart: string;
  teamIdFilter?: string;
}): Promise<void> {
  const bytes = await exportScheduleToXlsxBuffer(params);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `escala-${params.weekStart}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
