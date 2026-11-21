# EscalaFlow — Gestão e Distribuição Automatizada de Escalas

Aplicação web **local-first**, estática e responsiva para montagem, validação e exportação de escalas semanais de turnos de equipe.

## Recursos Principais

- **Motor de Distribuição Determinístico (`src/engine/`):**
  - Respeita restrição de **Iniciantes** (nunca em turno noturno, domingo ou feriado com expediente).
  - Garante **Folga Compensatória de Domingo** (`Folga (Dom.)`) configurável na mesma semana ou na semana seguinte.
  - Prioriza **Rodízio Mensal do Turno Noturno (`12:00–22:00`)** para que todo veterano elegível cumpra ao menos 1 vez no mês.
  - Promove **Equidade de Domingos** evitando domingos consecutivos quando há outro veterano elegível.
  - Suporta **Feriados** (Folga Geral ou Expediente Especial) e **Travas/Indisponibilidades** (cadeado por célula, férias, atestado, folga combinada).
  - Alerta de **Interjornada (< 11h)** (ex.: saída às `22:00` e entrada às `08:00` no dia seguinte).
- **Grade Semanal Interativa:**
  - Visualização **Por Colaborador** e **Por Turno**.
  - Drag-and-drop entre células e modal dedicado de **Trocar Turno** com validação em tempo real, confirmação de exceção pelo líder e **Histórico de Trocas da Semana**.
  - Painel de **Equidade do Mês**.
- **Central de Exportação:**
  - **PNG em alta resolução** (`pixelRatio: 2`) otimizado para leitura no celular.
  - **Excel `.xlsx` formatado** com duas abas (*Escala Semanal* e *Anotações e Trocas*).
  - **Mensagem para WhatsApp** com formatação nativa (`*negrito*`), agrupamento por dia ou por colaborador, edição prévia e cópia rápida.
- **Persistência Local + Backup JSON:**
  - Dados salvos no navegador com validação Zod e exportação/importação de backup `.json`.

## Scripts

```bash
npm install
npm run dev        # Servidor de desenvolvimento
npm run build      # Build estático (Vercel / GitHub Pages)
npm test           # Testes unitários (Vitest)
npx playwright test # Testes E2E (Playwright)
```

## Direitos Reservados

Copyright (c) 2026 **José Willians** (`JoseWillians`). Todos os direitos reservados.

Este código-fonte e sua aplicação são proprietários. Nenhuma parte deste repositório pode ser copiada, redistribuída, modificada ou utilizada sem autorização prévia por escrito do autor. Consulte o arquivo [LICENSE](./LICENSE).

