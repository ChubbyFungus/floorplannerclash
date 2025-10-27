import { test, expect } from '@playwright/test';
import * as THREE from 'three';

const BASE_URL = '/'; // Navigate to the root URL

test.describe('Corner Cabinet Placement and Yaw', () => {
  test.beforeEach(async ({ page }) => {
    // Set a global flag for Playwright to detect test environment
    await page.evaluate(() => {
      (window as any).Playwright = true;
    });
    // Allow GLB requests to hit the real assets during happy-path tests.
    await page.route('**/*.glb', (route) => route.fallback());
  });

  test('BlindCornerBase should render with default placement and 0 yaw', async ({ page }) => {
    const itemId = 1;
    const width = 24;
    const depth = 24;
    const height = 34.5;
    const blindInset = 12;
    const rotationY = 0; // 0 radians

    await page.goto(
      `${BASE_URL}?test=cornerCabinet&itemId=${itemId}&width=${width}&depth=${depth}&height=${height}&blindInset=${blindInset}&rotationY=${rotationY}`
    );

    // Ensure the 3D canvas is visible
    await expect(page.locator('canvas')).toBeVisible();

    // Wait for the Three.js object to be available
    await page.waitForFunction(
      (id) => (window as any).threeJsGroupRefs?.has(id),
      itemId
    );

    const bboxAndRotation = await page.evaluate((id) => {
      const pivotGroup = (window as any).threeJsGroupRefs.get(id);
      if (pivotGroup && pivotGroup.children.length > 0) {
        const contentGroup = pivotGroup.children[0]; // Assuming contentRef is the first child of pivotRef
        const box = new THREE.Box3().setFromObject(contentGroup);
        return {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          pivotPosition: { x: pivotGroup.position.x, y: pivotGroup.position.y, z: pivotGroup.position.z },
          rotationY: pivotGroup.rotation.y,
        };
      }
      return null;
    }, itemId);

    expect(bboxAndRotation).not.toBeNull();
    expect(bboxAndRotation?.rotationY).toBeCloseTo(rotationY, 3);

    // For rotationY = 0, quarterTurns = 0.
    // px = box.min.x
    // pz = box.min.z
    // py = box.min.y
    // pivot.position = (-px, -py, -pz)

    const expectedPivotX = -bboxAndRotation!.min.x;
    const expectedPivotY = -bboxAndRotation!.min.y;
    const expectedPivotZ = -bboxAndRotation!.min.z;

    expect(bboxAndRotation?.pivotPosition.x).toBeCloseTo(expectedPivotX, 3);
    expect(bboxAndRotation?.pivotPosition.y).toBeCloseTo(expectedPivotY, 3);
    expect(bboxAndRotation?.pivotPosition.z).toBeCloseTo(expectedPivotZ, 3);
  });

  test('BlindCornerBase should render with 90 degree yaw', async ({ page }) => {
    const itemId = 2;
    const width = 24;
    const depth = 24;
    const height = 34.5;
    const blindInset = 12;
    const rotationY = Math.PI / 2; // 90 degrees

    await page.goto(
      `${BASE_URL}?test=cornerCabinet&itemId=${itemId}&width=${width}&depth=${depth}&height=${height}&blindInset=${blindInset}&rotationY=${rotationY}`
    );

    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(
      (id) => (window as any).threeJsGroupRefs?.has(id),
      itemId
    );

    const bboxAndRotation = await page.evaluate((id) => {
      const pivotGroup = (window as any).threeJsGroupRefs.get(id);
      if (pivotGroup && pivotGroup.children.length > 0) {
        const contentGroup = pivotGroup.children[0];
        const box = new THREE.Box3().setFromObject(contentGroup);
        return {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          pivotPosition: { x: pivotGroup.position.x, y: pivotGroup.position.y, z: pivotGroup.position.z },
          rotationY: pivotGroup.rotation.y,
        };
      }
      return null;
    }, itemId);

    expect(bboxAndRotation).not.toBeNull();
    expect(bboxAndRotation?.rotationY).toBeCloseTo(rotationY, 3);

    // For rotationY = Math.PI / 2, quarterTurns = 1.
    // px = box.min.x
    // pz = box.max.z
    // py = box.min.y
    // pivot.position = (-px, -py, -pz)
    const expectedPivotX = -bboxAndRotation!.min.x;
    const expectedPivotY = -bboxAndRotation!.min.y;
    const expectedPivotZ = -bboxAndRotation!.max.z; // This is the change for 90 degrees

    expect(bboxAndRotation?.pivotPosition.x).toBeCloseTo(expectedPivotX, 3);
    expect(bboxAndRotation?.pivotPosition.y).toBeCloseTo(expectedPivotY, 3);
    expect(bboxAndRotation?.pivotPosition.z).toBeCloseTo(expectedPivotZ, 3);
  });

  test('BlindCornerBase should render with 180 degree yaw', async ({ page }) => {
    const itemId = 3;
    const width = 24;
    const depth = 24;
    const height = 34.5;
    const blindInset = 12;
    const rotationY = Math.PI; // 180 degrees

    await page.goto(
      `${BASE_URL}?test=cornerCabinet&itemId=${itemId}&width=${width}&depth=${depth}&height=${height}&blindInset=${blindInset}&rotationY=${rotationY}`
    );

    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(
      (id) => (window as any).threeJsGroupRefs?.has(id),
      itemId
    );

    const bboxAndRotation = await page.evaluate((id) => {
      const pivotGroup = (window as any).threeJsGroupRefs.get(id);
      if (pivotGroup && pivotGroup.children.length > 0) {
        const contentGroup = pivotGroup.children[0];
        const box = new THREE.Box3().setFromObject(contentGroup);
        return {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          pivotPosition: { x: pivotGroup.position.x, y: pivotGroup.position.y, z: pivotGroup.position.z },
          rotationY: pivotGroup.rotation.y,
        };
      }
      return null;
    }, itemId);

    expect(bboxAndRotation).not.toBeNull();
    expect(bboxAndRotation?.rotationY).toBeCloseTo(rotationY, 3);

    // For rotationY = Math.PI, quarterTurns = 2.
    // px = box.max.x
    // pz = box.max.z
    // py = box.min.y
    // pivot.position = (-px, -py, -pz)
    const expectedPivotX = -bboxAndRotation!.max.x;
    const expectedPivotY = -bboxAndRotation!.min.y;
    const expectedPivotZ = -bboxAndRotation!.max.z;

    expect(bboxAndRotation?.pivotPosition.x).toBeCloseTo(expectedPivotX, 3);
    expect(bboxAndRotation?.pivotPosition.y).toBeCloseTo(expectedPivotY, 3);
    expect(bboxAndRotation?.pivotPosition.z).toBeCloseTo(expectedPivotZ, 3);
  });

  test('BlindCornerBase should render with 270 degree yaw', async ({ page }) => {
    const itemId = 4;
    const width = 24;
    const depth = 24;
    const height = 34.5;
    const blindInset = 12;
    const rotationY = (3 * Math.PI) / 2; // 270 degrees

    await page.goto(
      `${BASE_URL}?test=cornerCabinet&itemId=${itemId}&width=${width}&depth=${depth}&height=${height}&blindInset=${blindInset}&rotationY=${rotationY}`
    );

    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(
      (id) => (window as any).threeJsGroupRefs?.has(id),
      itemId
    );

    const bboxAndRotation = await page.evaluate((id) => {
      const pivotGroup = (window as any).threeJsGroupRefs.get(id);
      if (pivotGroup && pivotGroup.children.length > 0) {
        const contentGroup = pivotGroup.children[0];
        const box = new THREE.Box3().setFromObject(contentGroup);
        return {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          pivotPosition: { x: pivotGroup.position.x, y: pivotGroup.position.y, z: pivotGroup.position.z },
          rotationY: pivotGroup.rotation.y,
        };
      }
      return null;
    }, itemId);

    expect(bboxAndRotation).not.toBeNull();
    expect(bboxAndRotation?.rotationY).toBeCloseTo(rotationY, 3);

    // For rotationY = (3 * Math.PI) / 2, quarterTurns = 3.
    // px = box.max.x
    // pz = box.min.z
    // py = box.min.y
    // pivot.position = (-px, -py, -pz)
    const expectedPivotX = -bboxAndRotation!.max.x;
    const expectedPivotY = -bboxAndRotation!.min.y;
    const expectedPivotZ = -bboxAndRotation!.min.z; // This is the change for 270 degrees

    expect(bboxAndRotation?.pivotPosition.x).toBeCloseTo(expectedPivotX, 3);
    expect(bboxAndRotation?.pivotPosition.y).toBeCloseTo(expectedPivotY, 3);
    expect(bboxAndRotation?.pivotPosition.z).toBeCloseTo(expectedPivotZ, 3);
  });
});