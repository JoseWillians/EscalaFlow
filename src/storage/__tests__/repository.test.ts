import { describe, expect, it } from 'vitest';
import { createSampleState } from '@/domain/seed';
import { exportBackupJson, importBackupJson, parseStoredState } from '../repository';

describe('storage repository', () => {
  it('exporta e reimporta backup JSON válido preservando equipes e colaboradores', () => {
    const state = createSampleState('2026-11-09');
    const json = exportBackupJson(state);
    const parsed = importBackupJson(json);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.teams).toHaveLength(state.teams.length);
      expect(parsed.state.employees).toHaveLength(state.employees.length);
      expect(parsed.state.shifts).toHaveLength(state.shifts.length);
    }
  });

  it('migra estado legado sem lista de equipes criando equipe padrão', () => {
    const legacyJson = JSON.stringify({
      version: 1,
      sundayCompMode: 'same_week',
      shifts: [],
      employees: [{ id: 'e1', name: 'Carlos', isBeginner: false, active: true }],
      unavailabilities: [],
      holidays: {},
      weeks: {},
      pinnedNotes: '',
    });

    const parsed = importBackupJson(legacyJson);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.teams.length).toBeGreaterThanOrEqual(1);
      expect(parsed.state.employees[0].teamId).toBe(parsed.state.teams[0].id);
    }
  });

  it('rejeita JSON corrompido ou fora do schema sem lançar exceção', () => {
    expect(importBackupJson('{invalido').ok).toBe(false);
    expect(importBackupJson(JSON.stringify({ version: 99 })).ok).toBe(false);
    const fallback = parseStoredState('{invalido');
    expect(fallback.version).toBe(1);
    expect(fallback.shifts.length).toBeGreaterThan(0);
  });
});
