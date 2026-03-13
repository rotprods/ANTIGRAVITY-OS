import { test, expect } from '@playwright/test'

// These tests run with a real authenticated session (storageState from auth.setup.js).
// They require PLAYWRIGHT_TEST_EMAIL + PLAYWRIGHT_TEST_PASSWORD set in the environment.
const HAS_AUTH_CREDS = Boolean(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD
)

test.describe('Dashboard (authenticated)', () => {
  test.skip(
    !HAS_AUTH_CREDS,
    'Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD for authenticated flow.'
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/control-tower')
    await page.waitForLoadState('networkidle')
  })

  test('ControlTower loads without redirecting to auth', async ({ page }) => {
    // Should not be on auth page
    await expect(page.locator('input[type="email"]')).not.toBeVisible()
    // URL should be control-tower
    await expect(page).toHaveURL(/control-tower/)
  })

  test('ControlTower shows KPI section', async ({ page }) => {
    // KPI strip or stat cards should be visible
    const kpiArea = page.locator('[class*="kpi"], [class*="stat-card"]').first()
    await expect(kpiArea).toBeVisible({ timeout: 10000 })
  })

  test('sidebar navigation to CRM works', async ({ page }) => {
    await page.getByText('CRM', { exact: false }).first().click()
    await expect(page).toHaveURL(/\/crm/)
    await expect(page.locator('input[type="email"]')).not.toBeVisible()
  })

  test('sidebar navigation to Pipeline works', async ({ page }) => {
    await page.getByText('Pipeline', { exact: false }).first().click()
    await expect(page).toHaveURL(/\/pipeline/)
  })

  test('Copilot panel opens via keyboard shortcut', async ({ page }) => {
    // Trigger ⌘K / Ctrl+K
    await page.keyboard.press('Meta+k')
    // Copilot panel should appear (look for close button or copilot container)
    const copilot = page.locator('[class*="copilot"]').first()
    await expect(copilot).toBeVisible({ timeout: 5000 })
  })
})
