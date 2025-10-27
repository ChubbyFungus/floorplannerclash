import { test, expect } from '@playwright/test'
import path from 'node:path'

const glbPath = path.resolve('apps/frontend/tests/fixtures/cube.glb')

test.beforeEach(async ({ page }) => {
  await page.route('**/*.glb', (route) => {
    const currentUrl = page.url()
    if (currentUrl.includes('/modern-blueprint3d') || currentUrl.includes('/playwright')) {
      return route.fulfill({ path: glbPath, headers: { 'content-type': 'model/gltf-binary' } })
    }
    return route.fallback()
  })
})

test('compass renders on editor', async ({ page }) => {
  await page.goto('/modern-blueprint3d')
  await expect(page.getByTestId('r3f-canvas')).toBeVisible()
  await expect(page.getByTestId('compass')).toBeVisible()
})
