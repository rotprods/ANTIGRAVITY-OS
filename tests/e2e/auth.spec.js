import { test, expect } from '@playwright/test'

// Smoke tests for the auth / login page.
// These run without a real Supabase connection — they only assert
// that the static UI elements are present and visible.

test.describe('Auth page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the OCULOPS logo text', async ({ page }) => {
    await expect(page.getByText('OCULOPS')).toBeVisible()
  })

  test('shows the email input field', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('shows the password input field', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('shows the submit button', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows the magic link option', async ({ page }) => {
    await expect(page.getByText(/magic link/i)).toBeVisible()
  })

  test('page loads without uncaught JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})
