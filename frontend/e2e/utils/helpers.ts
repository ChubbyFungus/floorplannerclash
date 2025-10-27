import { Page } from '@playwright/test'

export async function waitForModelLoad(page: Page): Promise<void> {
    // Wait for the canvas to be present and visible
    await page.waitForSelector('canvas', { state: 'visible' })

    // Wait for loading indicator to disappear (if exists)
    const loadingIndicator = await page.locator('[data-testid="loading-indicator"]')
    if (await loadingIndicator.count() > 0) {
        await loadingIndicator.waitFor({ state: 'hidden' })
    }
}

export async function setModelTransform(
    page: Page,
    transform: {
        position?: [number, number, number]
        rotation?: [number, number, number]
        scale?: [number, number, number]
    }
): Promise<void> {
    const { position, rotation, scale } = transform

    if (position) {
        await page.fill('[data-testid="position-x"]', position[0].toString())
        await page.fill('[data-testid="position-y"]', position[1].toString())
        await page.fill('[data-testid="position-z"]', position[2].toString())
    }

    if (rotation) {
        await page.fill('[data-testid="rotation-x"]', rotation[0].toString())
        await page.fill('[data-testid="rotation-y"]', rotation[1].toString())
        await page.fill('[data-testid="rotation-z"]', rotation[2].toString())
    }

    if (scale) {
        await page.fill('[data-testid="scale-x"]', scale[0].toString())
        await page.fill('[data-testid="scale-y"]', scale[1].toString())
        await page.fill('[data-testid="scale-z"]', scale[2].toString())
    }
}

export async function takeScreenshotWithName(
    page: Page,
    name: string
): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await page.screenshot({
        path: `e2e/screenshots/${name}-${timestamp}.png`,
        fullPage: true
    })
} 