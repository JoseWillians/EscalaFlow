import { expect, test } from '@playwright/test';

test.describe('EscalaFlow — Fluxos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('favicon/logo, recolhimento de equipe, regras e turnos configuráveis, validação de troca e exportação por equipe selecionada', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'EscalaFlow' })).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /favicon\.svg$/);

    // 1. Cria equipe e cadastra colaborador com tag Iniciante na sessão da equipe + testa recolhimento
    await page.getByRole('tab', { name: /Equipes/i }).click();
    await page.getByLabel('Nome da equipe').fill('Equipe Comercial');
    await page.getByLabel('Descrição (opcional)').fill('Vendas e pós-venda');
    await page.getByTestId('add-team-btn').click();

    const teamSection = page.locator('section', { hasText: 'Equipe Comercial' });
    await expect(teamSection).toBeVisible();

    await teamSection.getByLabel('Nome do colaborador').fill('Eduardo Novato');
    await teamSection.getByLabel('Função').fill('Consultor');
    await teamSection
      .getByRole('switch', { name: /Marcar novo colaborador de Equipe Comercial como Iniciante/i })
      .click();
    await teamSection.getByRole('button', { name: /Adicionar/i }).click();

    await expect(teamSection.getByText('Eduardo Novato')).toBeVisible();
    await expect(teamSection.getByText('Função: Consultor')).toBeVisible();
    await expect(
      teamSection.getByRole('listitem').locator('span', { hasText: /^Iniciante$/ }),
    ).toBeVisible();
    await expect(page.getByText('Veterano')).toHaveCount(0);

    // Recolhe e reexpande a seção da equipe
    const collapseTeamBtn = teamSection.locator('button[aria-expanded]');
    await collapseTeamBtn.click();
    await expect(collapseTeamBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(teamSection.getByText('Eduardo Novato')).toHaveCount(0);
    await collapseTeamBtn.click();
    await expect(collapseTeamBtn).toHaveAttribute('aria-expanded', 'true');

    // 2. Carrega dados de exemplo (2 equipes separadas) e verifica grade + recolhimento
    await page.getByRole('tab', { name: /Grade Semanal/i }).click();
    await page.getByTestId('load-sample-btn').click();

    await expect(page.getByTestId('grid-team-team-atendimento')).toBeVisible();
    await expect(page.getByTestId('grid-team-team-suporte')).toBeVisible();
    await expect(page.getByTestId('equity-panel')).toBeVisible();

    await page.getByTestId('toggle-grid-collapse-team-atendimento').click();
    await expect(page.getByTestId('toggle-grid-collapse-team-atendimento')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByTestId('toggle-grid-collapse-team-atendimento').click();

    // Verifica que na Equipe Atendimento há 2 pessoas no domingo (08:00 às 18:00)
    const atendimentoSundayCells = page
      .getByTestId('grid-team-team-atendimento')
      .locator('tbody tr td:last-child');
    await expect(atendimentoSundayCells.filter({ hasText: '08:00 às 18:00 (Dom)' })).toHaveCount(2);

    // Verifica que Juliana Costa (iniciante) não tem 12:00 às 22:00, nem domingo, nem folga em Seg-Sáb
    const julianaRow = page
      .getByTestId('grid-team-team-atendimento')
      .locator('tbody tr', { hasText: 'Juliana Costa' });
    await expect(julianaRow).not.toContainText('12:00 às 22:00');
    await expect(julianaRow.locator('td').last()).toContainText('Folga');
    for (let colIdx = 1; colIdx <= 6; colIdx += 1) {
      await expect(julianaRow.locator('td').nth(colIdx)).not.toContainText('Folga');
    }

    // 3. Abre painel Regras e Turnos, altera quantidade de domingo para 3, gera e restaura para 2
    await page.getByTestId('toggle-rules-panel-btn').click();
    await expect(page.getByTestId('schedule-rules-panel')).toBeVisible();
    await page.getByTestId('sunday-staff-count-input').fill('3');
    await page.getByTestId('generate-schedule-btn').click();
    await expect(atendimentoSundayCells.filter({ hasText: '08:00 às 18:00 (Dom)' })).toHaveCount(3);
    await page.getByTestId('reset-rules-btn').click();
    await page.getByTestId('generate-schedule-btn').click();
    await expect(atendimentoSundayCells.filter({ hasText: '08:00 às 18:00 (Dom)' })).toHaveCount(2);

    // 4. Troca de turno via modal com validação em tempo real + confirmação de exceção + histórico
    await page.getByTestId('open-swap-modal-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dayOptions = await page.locator('#swap-date-a option').all();
    const sundayValue = await dayOptions[dayOptions.length - 1].getAttribute('value');
    expect(sundayValue).toBeTruthy();

    await page.locator('#swap-date-a').selectOption(sundayValue!);
    await page.locator('#swap-date-b').selectOption(sundayValue!);

    const empSelectA = page.locator('#swap-emp-a');
    const empSelectB = page.locator('#swap-emp-b');
    await empSelectB.selectOption('emp-juliana');

    const vetIds = ['emp-camila', 'emp-bruno', 'emp-patricia', 'emp-diego'];
    let triggeredWarning = false;
    for (const vetId of vetIds) {
      await empSelectA.selectOption(vetId);
      if ((await page.getByTestId('swap-warning-banner').count()) > 0) {
        triggeredWarning = true;
        break;
      }
    }
    expect(triggeredWarning).toBe(true);

    await expect(page.getByTestId('confirm-swap-btn')).toBeDisabled();
    await page.getByTestId('approve-exception-checkbox').check();
    await expect(page.getByTestId('confirm-swap-btn')).toBeEnabled();
    await page.getByLabel('Observação (opcional)').fill('Cobertura emergencial autorizada');
    await page.getByTestId('confirm-swap-btn').click();

    await expect(page.getByTestId('swap-history-panel')).toContainText('Exceção');
    await expect(page.getByTestId('swap-history-panel')).toContainText(
      'Cobertura emergencial autorizada',
    );

    // 5. Central de Exportação: somente a equipe selecionada (WhatsApp, Excel .xlsx e PNG)
    await page.getByRole('tab', { name: /Exportar/i }).click();
    await page.getByTestId('export-team-select').selectOption('team-atendimento');
    const whatsappBox = page.getByTestId('whatsapp-textarea');
    await expect(whatsappBox).toContainText('*[Equipe Atendimento]*');
    await expect(whatsappBox).not.toContainText('*[Equipe Suporte]*');

    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-xlsx-btn').click(),
    ]);
    expect(xlsxDownload.suggestedFilename()).toMatch(
      /^escala-equipe-atendimento-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );

    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-png-btn').click(),
    ]);
    expect(pngDownload.suggestedFilename()).toMatch(
      /^escala-equipe-atendimento-\d{4}-\d{2}-\d{2}\.png$/,
    );

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('tab', { name: /Grade Semanal/i }).click();
    await expect(page.getByRole('heading', { name: 'EscalaFlow' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
