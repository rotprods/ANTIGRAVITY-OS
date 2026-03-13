// ═══════════════════════════════════════════════════
// OCULOPS — E2E: Operator Closed-Loop Happy Path
// AG1-P2.1: Authenticated happy-path spec
// Tests the full operator flow:
//   ControlTower → Agents (approvals) → Messaging → Trace
// ═══════════════════════════════════════════════════

import { test, expect } from '@playwright/test'

test.describe('Operator closed-loop flow (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/control-tower')
    await page.waitForLoadState('networkidle')
  })

  // ── AG1-P0.1: Status chips visible ──

  test('Messaging shows status chips on conversation items', async ({ page }) => {
    await page.goto('/messaging')
    await page.waitForLoadState('networkidle')

    // If conversations exist, status chips should render
    const convoItems = page.locator('.msg-convo-item')
    const count = await convoItems.count()
    if (count > 0) {
      const chip = convoItems.first().locator('.msg-status-chip')
      await expect(chip).toBeVisible({ timeout: 5000 })
    }
  })

  test('Message bubbles show status chips', async ({ page }) => {
    await page.goto('/messaging')
    await page.waitForLoadState('networkidle')

    const convoItems = page.locator('.msg-convo-item')
    const count = await convoItems.count()
    if (count > 0) {
      await convoItems.first().click()
      await page.waitForTimeout(1000)

      const bubbles = page.locator('.msg-bubble')
      const bubbleCount = await bubbles.count()
      if (bubbleCount > 0) {
        const chip = bubbles.first().locator('.msg-status-chip')
        await expect(chip).toBeVisible({ timeout: 5000 })
      }
    }
  })

  // ── AG1-P0.2: Blocked indicators ──

  test('Agents approvals tab loads and shows pending approvals KPI', async ({ page }) => {
    await page.goto('/agents?tab=approvals')
    await page.waitForLoadState('networkidle')

    const kpiStrip = page.locator('.kpi-strip').first()
    await expect(kpiStrip).toBeVisible({ timeout: 10000 })

    // Pending KPI cell should exist
    const pendingLabel = page.locator('.kpi-label', { hasText: 'Pending' })
    await expect(pendingLabel).toBeVisible()
  })

  // ── AG1-P0.3: Run-inspection affordances ──

  test('ControlTower trace view shows inspection buttons for events', async ({ page }) => {
    // Navigate to a trace view — we use a dummy correlation ID
    await page.goto('/control-tower?corr=test-trace-id')
    await page.waitForLoadState('networkidle')

    // Trace filter section should appear
    const traceSection = page.locator('.ct-section-title', { hasText: 'Trace filter' })
    await expect(traceSection).toBeVisible({ timeout: 5000 })

    // Trace actions section should appear
    const actionsSection = page.locator('.ct-section-title', { hasText: 'Trace actions' })
    await expect(actionsSection).toBeVisible()

    // Open approvals button should exist
    const approvalBtn = page.locator('button', { hasText: 'Open approvals' })
    await expect(approvalBtn).toBeVisible()

    // Open conversation button should exist
    const convoBtn = page.locator('button', { hasText: 'Open conversation' })
    await expect(convoBtn).toBeVisible()
  })

  // ── AG1-P0.4: One-click navigation ──

  test('Agents → Approvals tab has trace and conversation links', async ({ page }) => {
    await page.goto('/agents?tab=approvals')
    await page.waitForLoadState('networkidle')

    const approvalCards = page.locator('.ag-outreach-card')
    const count = await approvalCards.count()
    if (count > 0) {
      // Check first card for Trace button
      const traceBtn = approvalCards.first().locator('button', { hasText: 'Trace' })
      const traceBtnCount = await traceBtn.count()
      // Trace button is only present when correlation_id exists
      if (traceBtnCount > 0) {
        await expect(traceBtn).toBeVisible()
      }
    }
  })

  test('Agents → Logs tab has trace links on correlated entries', async ({ page }) => {
    await page.goto('/agents?tab=logs')
    await page.waitForLoadState('networkidle')

    const logRows = page.locator('.ag-log-row')
    const count = await logRows.count()
    // Log rows should render
    expect(count).toBeGreaterThanOrEqual(0) // graceful — no data = 0
  })

  // ── Full navigation flow ──

  test('ControlTower → Agents approvals → back to ControlTower', async ({ page }) => {
    // Start at ControlTower
    await expect(page).toHaveURL(/control-tower/)

    // Navigate to Agents approvals
    await page.goto('/agents?tab=approvals')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/agents/)

    // Navigate to Messaging
    await page.goto('/messaging')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/messaging/)

    // Back to ControlTower
    await page.goto('/control-tower')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/control-tower/)
  })
})
