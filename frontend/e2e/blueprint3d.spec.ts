import { test, expect } from '@playwright/test'
const HARNESS_ROUTE = '/playwright'

test.beforeEach(async ({ page }) => {
  // Allow GLB requests to hit the real assets during happy-path tests.
  await page.route('**/*.glb', (route) => route.fallback())
})

test('Blueprint3D Component › should load and display the 3D model', async ({ page }) => {
  await page.goto(HARNESS_ROUTE)
  await expect(page.getByTestId('blueprint3d-root')).toBeVisible()

  const canvasWrapper = page.getByTestId('r3f-canvas')
  await expect(canvasWrapper).toBeVisible()
  const sizeOk = await canvasWrapper.locator('canvas').evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) return false
    return node.clientWidth > 0 && node.clientHeight > 0
  })
  expect(sizeOk).toBe(true)
})

test('Blueprint3D Component › should handle model loading errors gracefully', async ({ page }) => {
  const glb404 = (route: any) => route.fulfill({ status: 404 })
  await page.route('**/*.glb', glb404)
  await page.goto(HARNESS_ROUTE)
  await expect(page.getByTestId('model-error')).toBeVisible({ timeout: 15000 })
  await page.unroute('**/*.glb', glb404)
})

test('Blueprint3D Component › should apply transformations to the model', async ({ page }) => {
  await page.goto(HARNESS_ROUTE)

  await page.getByTestId('position-x').fill('1')
  await page.getByTestId('rotation-y').fill('90')
  await page.getByTestId('scale-x').fill('2')
  await page.getByTestId('scale-y').fill('2')
  await page.getByTestId('scale-z').fill('2')

  await expect(page.getByTestId('position-x')).toHaveValue('1')
  await expect(page.getByTestId('rotation-y')).toHaveValue('90')
  await expect(page.getByTestId('scale-x')).toHaveValue('2')
  await expect(page.getByTestId('scale-y')).toHaveValue('2')
  await expect(page.getByTestId('scale-z')).toHaveValue('2')
})

test('Blueprint3D Component › should clean up resources when navigating away', async ({ page }) => {
  await page.goto(HARNESS_ROUTE)
  await expect(page.getByRole('heading', { name: 'Blueprint3D Playwright Harness' })).toBeVisible()
  const canvasWrapper = page.getByTestId('r3f-canvas')
  await expect(canvasWrapper).toBeVisible()
  await Promise.all([
    page.waitForURL('**/playwright/blank'),
    page.getByRole('link', { name: /Go to blank page/i }).click()
  ])
  await expect(canvasWrapper.locator('canvas')).toHaveCount(0)
})
