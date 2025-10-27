export const INCHES_PER_SCENE_UNIT = 24;

export const inchesToSceneUnits = (inches: number): number => inches / INCHES_PER_SCENE_UNIT;

export const sceneUnitsToInches = (units: number): number => units * INCHES_PER_SCENE_UNIT;
