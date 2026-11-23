import { describe, expect, it } from 'vitest';
import { createSampleState } from '@/domain/seed';
import { generateWeekSchedule } from '@/engine/scheduler';
import { generateWhatsAppText } from '../whatsapp';

describe('generateWhatsAppText', () => {
  it('gera mensagem no formato tabular por dia com blocos monoespaçados, plantão de domingo e folgas sem nota de iniciantes', () => {
    const state = createSampleState('2026-11-23');
    state.holidays['2026-11-26'] = {
      date: '2026-11-26',
      name: 'Feriado Municipal',
      mode: 'off_all',
      shiftIds: [],
    };
    const week = generateWeekSchedule({ state, weekStart: '2026-11-23' });
    // Simula cobertura manual em uma célula da segunda-feira
    const camilaCell = week.assignments['emp-camila']?.['2026-11-23'];
    if (camilaCell) {
      week.assignments['emp-camila']['2026-11-23'] = {
        ...camilaCell,
        note: 'COBRE Allan',
      };
    }
    state.weeks['2026-11-23'] = week;

    const text = generateWhatsAppText({
      state,
      weekStart: '2026-11-23',
      groupBy: 'day',
      teamIdFilter: 'team-atendimento',
    });

    expect(text).toContain('📡 *ESCALA EQUIPE ATENDIMENTO*');
    expect(text).toContain('📆 *23/11/2026 a 29/11/2026*');
    expect(text).toContain('📅 *SEGUNDA — 23/11/2026*');
    expect(text).toContain('HORÁRIO         INTERVALO   AGENTE');
    expect(text).toContain('Camila Ferreira ↪️ COBRE Allan');
    expect(text).toContain('📅 *QUINTA — 26/11/2026* — FERIADO MUNICIPAL');
    expect(text).toContain('📋 *SÁBADO — 28/11/2026*');
    expect(text).toContain('HORÁRIO         AGENTE');
    expect(text).toContain('🌙 *DOMINGO — PLANTÃO — 29/11/2026*');
    expect(text).toContain('🌙 *Folga:*');
    expect(text).not.toContain('iniciantes não atuam');
  });

  it('exporta apenas a equipe selecionada no modo por colaborador', () => {
    const state = createSampleState('2026-11-23');
    const week = generateWeekSchedule({ state, weekStart: '2026-11-23' });
    state.weeks['2026-11-23'] = week;

    const text = generateWhatsAppText({
      state,
      weekStart: '2026-11-23',
      groupBy: 'employee',
      teamIdFilter: 'team-atendimento',
    });

    expect(text).toContain('📡 *ESCALA EQUIPE ATENDIMENTO*');
    expect(text).toContain('*Camila Ferreira*');
    expect(text).toContain('Folga (Dom.)');
    expect(text).not.toContain('Rafael Mendes');
  });
});
