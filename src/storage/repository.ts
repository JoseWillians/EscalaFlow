import { AppStateSchema, type AppState, type Team } from '@/domain/schemas';
import { createInitialEmptyState } from '@/domain/seed';

export const STORAGE_KEY = 'escalaflow:state:v1';

export function normalizeAppState(state: AppState): AppState {
  let teams: Team[] = [...state.teams];
  if (state.employees.length > 0 && teams.length === 0) {
    teams = [{ id: 'team-default', name: 'Equipe Principal', active: true }];
  }

  const validTeamIds = new Set(teams.map((t) => t.id));
  const fallbackTeamId = teams[0]?.id ?? 'team-default';

  const employees = state.employees.map((emp) => {
    if (validTeamIds.has(emp.teamId)) {
      return emp;
    }
    return { ...emp, teamId: fallbackTeamId };
  });

  if (employees.some((e) => e.teamId === 'team-default') && !validTeamIds.has('team-default')) {
    teams.unshift({ id: 'team-default', name: 'Equipe Principal', active: true });
  }

  return {
    ...state,
    teams,
    employees,
  };
}

export function parseStoredState(raw: string | null): AppState {
  if (!raw) {
    return createInitialEmptyState();
  }
  try {
    const parsedJson: unknown = JSON.parse(raw);
    const validated = AppStateSchema.safeParse(parsedJson);
    if (validated.success) {
      return normalizeAppState(validated.data);
    }
    return createInitialEmptyState();
  } catch {
    return createInitialEmptyState();
  }
}

export function loadState(): AppState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialEmptyState();
  }
  return parseStoredState(window.localStorage.getItem(STORAGE_KEY));
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportBackupJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importBackupJson(
  rawJson: string,
): { ok: true; state: AppState } | { ok: false; error: string } {
  try {
    const parsedJson: unknown = JSON.parse(rawJson);
    const validated = AppStateSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        ok: false,
        error: 'Arquivo JSON incompatível com a versão atual do EscalaFlow.',
      };
    }
    return { ok: true, state: normalizeAppState(validated.data) };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível ler o JSON selecionado. Verifique a formatação do arquivo.',
    };
  }
}
