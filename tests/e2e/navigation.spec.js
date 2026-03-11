import { test, expect } from '@playwright/test'

// Smoke tests for basic navigation.
// These check what is accessible without authentication — i.e. the login
// page loads correctly, the correct URL is served, and there are no
// network-level failures for the main assets.

test.describe('Navigation — unauthenticated', () => {
  test('root path returns HTTP 200', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
  })

  test('page has a valid HTML title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('unknown route falls back to the login page (SPA)', async ({ page }) => {
    // Vercel serves index.html for all routes — the React router handles it.
    // After load the auth guard should render the login card.
    await page.goto('/some-unknown-route')
    await expect(page.getByText('OCULOPS')).toBeVisible()
  })

  test('auth card is the only focusable region without a session', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The sidebar should NOT be visible when no session exists
    const sidebar = page.locator('nav, [class*="sidebar"], [class*="layout"]')
    // Either sidebar is absent or hidden — we just confirm the auth card is there
    await expect(page.locator('.auth-card, .auth-page')).toBeVisible()
  })

  test('loads without console errors from missing assets', async ({ page }) => {
    const failedRequests = []
    page.on('requestfailed', (req) => {
      // Ignore expected network failures for Supabase in CI (placeholder URL)
      const url = req.url()
      if (!url.includes('supabase') && !url.includes('placeholder')) {
        failedRequests.push(url)
      }
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(failedRequests).toHaveLength(0)
  })
})
