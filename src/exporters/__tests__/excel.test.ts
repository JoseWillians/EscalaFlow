import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createSampleState } from '@/domain/seed';
import { generateWeekSchedule } from '@/engine/scheduler';
import { buildScheduleWorkbook, exportScheduleToXlsxBuffer } from '../excel';

describe('excel exporter', () => {
  it('gera workbook com abas Escala Semanal e Anotações e Trocas formatadas', async () => {
    const state = createSampleState('2026-11-09');
    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    week.note = 'Escala validada pelo líder.';
    week.swaps.push({
      id: 'sw-1',
      timestamp: '2026-11-09T10:00:00.000Z',
      dateA: '2026-11-10',
      employeeIdA: 'emp-camila',
      dateB: '2026-11-10',
      employeeIdB: 'emp-rafael',
      summary: 'Camila Ferreira <-> Rafael Mendes (10/11)',
      reason: 'Consulta médica',
      hadWarnings: false,
      approvedException: false,
      warnings: [],
    });
    state.weeks['2026-11-09'] = week;

    const wb = await buildScheduleWorkbook({ state, weekStart: '2026-11-09' });
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Escala Semanal',
      'Anotações e Trocas',
    ]);

    const mainSheet = wb.getWorksheet('Escala Semanal')!;
    expect(String(mainSheet.getCell('A1').value)).toContain('Escala Semanal');
    expect(mainSheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 4 });

    const buffer = await exportScheduleToXlsxBuffer({ state, weekStart: '2026-11-09' });
    expect(buffer.byteLength).toBeGreaterThan(1000);

    // Verifica que o buffer é um xlsx legível pelo próprio ExcelJS
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer.buffer as ArrayBuffer);
    expect(reloaded.getWorksheet('Anotações e Trocas')).toBeDefined();
  });
});
