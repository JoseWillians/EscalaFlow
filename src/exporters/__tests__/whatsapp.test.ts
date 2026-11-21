import { describe, expect, it } from 'vitest';
import { createSampleState } from '@/domain/seed';
import { generateWeekSchedule } from '@/engine/scheduler';
import { generateWhatsAppText } from '../whatsapp';

describe('generateWhatsAppText', () => {
  it('gera mensagem formatada agrupada por dia com negrito WhatsApp, feriados e anotações', () => {
    const state = createSampleState('2026-11-09');
    state.holidays['2026-11-12'] = {
      date: '2026-11-12',
      name: 'Feriado Municipal',
      mode: 'off_all',
      shiftIds: [],
    };
    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    week.note = 'Atenção para abertura pontual às 08h.';
    state.weeks['2026-11-09'] = week;

    const text = generateWhatsAppText({
      state,
      weekStart: '2026-11-09',
      groupBy: 'day',
      includeNotes: true,
    });

    expect(text).toContain('*Escala Semanal');
    expect(text).toContain('*[Equipe Atendimento]*');
    expect(text).toContain('09/11 a 15/11');
    expect(text).toContain('*Quinta-feira (12/11)*');
    expect(text).toContain('Feriado Municipal');
    expect(text).toContain('Atenção para abertura pontual às 08h.');
  });

  it('gera mensagem formatada agrupada por colaborador destacando folga compensatória', () => {
    const state = createSampleState('2026-11-09');
    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    state.weeks['2026-11-09'] = week;

    const text = generateWhatsAppText({
      state,
      weekStart: '2026-11-09',
      groupBy: 'employee',
    });

    expect(text).toContain('*Camila Ferreira*');
    expect(text).toContain('Folga (Dom.)');
  });

  it('exporta apenas a equipe selecionada quando teamIdFilter é informado', () => {
    const state = createSampleState('2026-11-09');
    const week = generateWeekSchedule({ state, weekStart: '2026-11-09' });
    state.weeks['2026-11-09'] = week;

    const text = generateWhatsAppText({
      state,
      weekStart: '2026-11-09',
      groupBy: 'employee',
      teamIdFilter: 'team-atendimento',
    });

    expect(text).toContain('*[Equipe Atendimento]*');
    expect(text).toContain('*Camila Ferreira*');
    expect(text).not.toContain('*[Equipe Suporte]*');
    expect(text).not.toContain('Rafael Mendes');
  });
});
